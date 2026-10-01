/**
 * Boletos — funciones compartidas por el portal de compra y el sistema interno:
 * resumen de la cotización, entradas con código QR e impresión.
 *
 * Requiere /vendor/qrcode/qrcode.js (librería qrcode-generator).
 */
window.Boletos = (function () {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const ZOO = 'Zoológico Mirada Salvaje';

  /** SVG del código QR para un texto. */
  function qrSvg(texto, celda = 4) {
    const qr = qrcode(0, 'M');
    qr.addData(String(texto));
    qr.make();
    return qr.createSvgTag({ cellSize: celda, margin: 2, scalable: true });
  }

  /** Fecha larga: "sábado 4 de octubre de 2026" */
  function fechaLarga(fecha) {
    return new Date(`${String(fecha).slice(0, 10)}T12:00:00`).toLocaleDateString('es-GT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  /** Tabla con las líneas de una cotización o venta y sus totales. */
  function resumenHtml(c) {
    if (!c?.lineas?.length && !c?.detalle?.length) return '<p class="text-secondary mb-0">Elige las entradas para ver el total.</p>';
    const lineas = c.lineas || c.detalle;
    return `
      <table class="table table-sm mb-2 resumen-compra">
        <tbody>
          ${lineas.map((l) => `
            <tr>
              <td>${esc(l.cantidad)} × ${esc(l.tipo_entrada)}<div class="small text-secondary">${esc(Zoo.ui.moneda(l.precio_unitario))} c/u</div>
                ${l.promocion ? `<div class="small text-success"><i class="bi bi-tag-fill me-1"></i>${esc(l.promocion)}</div>` : ''}</td>
              <td class="text-end text-nowrap">${esc(Zoo.ui.moneda(Number(l.cantidad) * Number(l.precio_unitario)))}
                ${Number(l.descuento) > 0 ? `<div class="small text-success">−${esc(Zoo.ui.moneda(l.descuento))}</div>` : ''}</td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          ${Number(c.descuento) > 0 ? `
            <tr><td class="text-secondary">Subtotal</td><td class="text-end">${esc(Zoo.ui.moneda(c.subtotal))}</td></tr>
            <tr><td class="text-success">Descuentos</td><td class="text-end text-success">−${esc(Zoo.ui.moneda(c.descuento))}</td></tr>` : ''}
          <tr class="total"><td>Total</td><td class="text-end">${esc(Zoo.ui.moneda(c.total))}</td></tr>
        </tfoot>
      </table>`;
  }

  /** Entradas imprimibles con su QR. `venta` = objeto venta del contrato con `entradas`. */
  function boletosHtml(venta) {
    return `<div class="boletos">${(venta.entradas || [])
      .map((e, i) => `
        <article class="boleto ${e.estado !== 'vigente' ? 'no-vigente' : ''}">
          <div class="boleto-info">
            <div class="boleto-zoo">${ZOO}</div>
            <div class="boleto-tipo">${esc(e.tipo_entrada)}</div>
            <div class="boleto-fecha">${esc(fechaLarga(venta.fecha_visita))}</div>
            <div class="boleto-datos">Compra ${esc(venta.codigo)}, entrada ${i + 1} de ${venta.entradas.length}</div>
            ${e.estado !== 'vigente' ? `<div class="mt-2">${E.estado('estadoEntrada', e.estado)}</div>` : ''}
          </div>
          <div class="boleto-qr" aria-label="Código QR de la entrada">${qrSvg(e.codigo_qr)}
            <div class="boleto-codigo">${esc(e.codigo_qr.slice(-8).toUpperCase())}</div>
          </div>
        </article>`)
      .join('')}</div>`;
  }

  /** Imprime solo el contenedor indicado. */
  function imprimir(contenedor) {
    document.querySelectorAll('.area-impresion').forEach((n) => n.classList.remove('area-impresion'));
    contenedor.classList.add('area-impresion');
    document.body.classList.add('imprimiendo');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('imprimiendo');
      contenedor.classList.remove('area-impresion');
    }, 500);
  }

  /** Días en que el zoológico abre (cerrado los lunes). */
  const abreEse = (fecha) => new Date(`${fecha}T12:00:00`).getDay() !== 1;

  return { qrSvg, fechaLarga, resumenHtml, boletosHtml, imprimir, abreEse };
})();
