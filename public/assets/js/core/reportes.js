/**
 * Zoo.reportes — Exportación de reportes a PDF y Excel desde el navegador.
 *
 * Requiere cargar en la página (antes de este archivo):
 *   <script src="/vendor/jspdf/jspdf.umd.min.js" defer></script>
 *   <script src="/vendor/jspdf-autotable/jspdf.plugin.autotable.min.js" defer></script>
 *   <script src="/vendor/exceljs/exceljs.min.js" defer></script>
 *   <script src="/assets/js/core/reportes.js" defer></script>
 *
 * Uso:
 *   const columnas = [
 *     { titulo: 'Producto', campo: 'nombre' },
 *     { titulo: 'Existencia', campo: 'stock', formato: (v) => Zoo.ui.numero(v, 2), alinear: 'right' },
 *   ];
 *   Zoo.reportes.pdf({ titulo: 'Stock crítico', subtitulo: 'Al 01/10/2026', columnas, filas });
 *   Zoo.reportes.excel({ titulo: 'Stock crítico', columnas, filas });
 */
(function () {
  const Zoo = (window.Zoo = window.Zoo || {});

  const VERDE = [47, 107, 69];
  const SELVA = [30, 58, 43];
  const INSTITUCION = 'Zoológico "Mirada Salvaje"';

  function valorCelda(columna, fila) {
    const crudo = typeof columna.campo === 'function' ? columna.campo(fila) : fila[columna.campo];
    return columna.formato ? columna.formato(crudo, fila) : crudo ?? '';
  }

  function nombreArchivo(titulo, extension) {
    const base = titulo
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    return `${base}_${Zoo.ui.hoy()}.${extension}`;
  }

  function generadoPor() {
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-GT');
    const hora = ahora.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
    const usuario = Zoo.sesion?.usuario?.nombre;
    return `Generado el ${fecha} a las ${hora}${usuario ? ` por ${usuario}` : ''}`;
  }

  function pdf({ titulo, subtitulo = '', columnas, filas, orientacion = 'portrait', archivo }) {
    if (!window.jspdf) throw new Error('Falta cargar jsPDF en esta página.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: orientacion, unit: 'pt', format: 'letter' });
    const ancho = doc.internal.pageSize.getWidth();
    const margen = 40;

    // Encabezado
    doc.setFillColor(...SELVA);
    doc.rect(0, 0, ancho, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...VERDE);
    doc.text(INSTITUCION, margen, 34);
    doc.setFontSize(16);
    doc.setTextColor(...SELVA);
    doc.text(titulo, margen, 56);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90);
    let y = 72;
    if (subtitulo) {
      doc.text(subtitulo, margen, y);
      y += 13;
    }
    doc.text(generadoPor(), margen, y);

    const opciones = {
      startY: y + 14,
      margin: { left: margen, right: margen, bottom: 40 },
      head: [columnas.map((c) => c.titulo)],
      body: filas.map((f) => columnas.map((c) => String(valorCelda(c, f)))),
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, lineColor: [213, 222, 214], lineWidth: 0.5 },
      headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 249, 245] },
      columnStyles: Object.fromEntries(
        columnas.map((c, i) => [i, { halign: c.alinear || 'left', cellWidth: c.anchoPdf || 'auto' }])
      ),
      didDrawPage: () => {
        const alto = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`${INSTITUCION} — Sistema de control`, margen, alto - 20);
        doc.text(`Página ${doc.getNumberOfPages()}`, ancho - margen, alto - 20, { align: 'right' });
      },
    };

    if (typeof window.autoTable === 'function') window.autoTable(doc, opciones);
    else doc.autoTable(opciones);

    if (filas.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text('No hay registros para los filtros seleccionados.', margen, y + 60);
    }

    doc.save(archivo || nombreArchivo(titulo, 'pdf'));
  }

  async function excel({ titulo, subtitulo = '', columnas, filas, hoja = 'Reporte', archivo }) {
    if (!window.ExcelJS) throw new Error('Falta cargar ExcelJS en esta página.');
    const libro = new ExcelJS.Workbook();
    libro.creator = INSTITUCION;
    libro.created = new Date();
    const ws = libro.addWorksheet(hoja.slice(0, 31));

    const ultimaColumna = Math.max(columnas.length, 1);
    ws.mergeCells(1, 1, 1, ultimaColumna);
    ws.getCell(1, 1).value = `${INSTITUCION} — ${titulo}`;
    ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF1E3A2B' } };
    ws.mergeCells(2, 1, 2, ultimaColumna);
    ws.getCell(2, 1).value = [subtitulo, generadoPor()].filter(Boolean).join('  |  ');
    ws.getCell(2, 1).font = { size: 9, color: { argb: 'FF56655C' } };

    const encabezado = ws.getRow(4);
    columnas.forEach((c, i) => {
      const celda = encabezado.getCell(i + 1);
      celda.value = c.titulo;
      celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F6B45' } };
      celda.alignment = { vertical: 'middle' };
    });

    filas.forEach((fila, indice) => {
      const r = ws.getRow(5 + indice);
      columnas.forEach((c, i) => {
        // En Excel se guarda el valor crudo si es número, para poder sumar.
        const crudo = typeof c.campo === 'function' ? c.campo(fila) : fila[c.campo];
        const usarCrudo = typeof crudo === 'number' && !c.formatoExcel;
        r.getCell(i + 1).value = usarCrudo ? crudo : c.formatoExcel ? c.formatoExcel(crudo, fila) : String(valorCelda(c, fila));
        if (c.alinear) r.getCell(i + 1).alignment = { horizontal: c.alinear };
      });
    });

    columnas.forEach((c, i) => {
      const largo = Math.max(c.titulo.length, ...filas.slice(0, 200).map((f) => String(valorCelda(c, f)).length));
      ws.getColumn(i + 1).width = c.anchoExcel || Math.min(50, Math.max(10, largo + 2));
    });
    ws.views = [{ state: 'frozen', ySplit: 4 }];
    if (filas.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: ultimaColumna } };

    const buffer = await libro.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = archivo || nombreArchivo(titulo, 'xlsx');
    document.body.appendChild(enlace);
    enlace.click();
    setTimeout(() => {
      URL.revokeObjectURL(enlace.href);
      enlace.remove();
    }, 1000);
  }

  Zoo.reportes = { pdf, excel };
})();
