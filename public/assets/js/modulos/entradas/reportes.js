/**
 * Entradas — Reportes: ventas por día, por tipo de entrada y uso de promociones.
 * Contrato: docs/api/entradas.md → Reportes
 */
Zoo.listo(() => {
  const { esc } = Zoo.ui;
  const $ = (id) => document.getElementById(id);
  const form = $('formFiltros');

  form.desde.value = Zoo.reportes.inicioDeMes();
  form.hasta.value = Zoo.ui.hoy();
  const num = (v) => Zoo.ui.numero(v ?? 0);
  const q = (v) => Zoo.ui.moneda(v ?? 0);

  const REPORTES = {
    diarias: {
      titulo: 'Ventas de entradas por día',
      url: '/api/entradas/reportes/ventas-diarias',
      encabezado: 'encDiarias',
      tbody: 'tablaDiarias',
      columnas: [
        { titulo: 'Fecha', campo: 'fecha', formato: (v) => (/^\d{4}-/.test(v) ? Zoo.ui.fecha(v) : v) },
        { titulo: 'Ventas taquilla', campo: 'ventas_taquilla', alinear: 'right', formato: num },
        { titulo: 'Compras en línea', campo: 'ventas_web', alinear: 'right', formato: num },
        { titulo: 'Entradas', campo: 'entradas', alinear: 'right', formato: num },
        { titulo: 'Subtotal', campo: 'subtotal', alinear: 'right', formato: q },
        { titulo: 'Descuentos', campo: 'descuento', alinear: 'right', formato: q },
        { titulo: 'Total', campo: 'total', alinear: 'right', formato: q },
      ],
      total: (f) => ({ fecha: 'Total', ...Zoo.reportes.sumar(f, ['ventas_taquilla', 'ventas_web', 'entradas', 'subtotal', 'descuento', 'total']) }),
    },
    tipos: {
      titulo: 'Ventas por tipo de entrada',
      url: '/api/entradas/reportes/por-tipo',
      encabezado: 'encTipos',
      tbody: 'tablaTipos',
      columnas: [
        { titulo: 'Tipo de entrada', campo: 'tipo_entrada' },
        { titulo: 'Entradas vendidas', campo: 'cantidad', alinear: 'right', formato: num },
        { titulo: 'Usadas', campo: 'usadas', alinear: 'right', formato: num },
        { titulo: 'Subtotal', campo: 'subtotal', alinear: 'right', formato: q },
        { titulo: 'Descuentos', campo: 'descuento', alinear: 'right', formato: q },
        { titulo: 'Total', campo: 'total', alinear: 'right', formato: q },
        { titulo: '% de ingresos', campo: 'porcentaje', alinear: 'right', formato: (v) => (v == null ? '' : `${Zoo.ui.numero(v, 1)}%`) },
      ],
      total: (f) => ({ tipo_entrada: 'Total', ...Zoo.reportes.sumar(f, ['cantidad', 'usadas', 'subtotal', 'descuento', 'total']) }),
    },
    promociones: {
      titulo: 'Uso de promociones',
      url: '/api/entradas/reportes/promociones',
      encabezado: 'encPromos',
      tbody: 'tablaPromos',
      columnas: [
        { titulo: 'Promoción', campo: 'promocion' },
        { titulo: 'Cupón', campo: 'codigo', html: (v) => (v ? `<code>${esc(v)}</code>` : '') },
        { titulo: 'Descuento', campo: 'descuento_porcentaje', alinear: 'right', formato: (v) => (v == null ? '' : `${Zoo.ui.numero(v, Number(v) % 1 ? 2 : 0)}%`) },
        { titulo: 'Compras', campo: 'compras', alinear: 'right', formato: num },
        { titulo: 'Entradas', campo: 'entradas', alinear: 'right', formato: num },
        { titulo: 'Total descontado', campo: 'descuento_total', alinear: 'right', formato: q },
      ],
      total: (f) => ({ promocion: 'Total', ...Zoo.reportes.sumar(f, ['compras', 'entradas', 'descuento_total']) }),
    },
  };

  const datos = {};
  let activo = 'diarias';

  Object.values(REPORTES).forEach((r) => {
    $(r.encabezado).innerHTML = r.columnas.map((c) => `<th class="${c.alinear === 'right' ? 'text-end' : ''}">${esc(c.titulo)}</th>`).join('');
  });

  async function cargar(clave) {
    const r = REPORTES[clave];
    const tbody = $(r.tbody);
    if (!form.desde.value || !form.hasta.value || form.desde.value > form.hasta.value) {
      tbody.innerHTML = `<tr><td colspan="${r.columnas.length}"><div class="tabla-vacia">Elige un periodo válido.</div></td></tr>`;
      return;
    }
    try {
      datos[clave] = await Zoo.api.get(r.url, { desde: form.desde.value, hasta: form.hasta.value });
      Zoo.reportes.pintar(tbody, r.columnas, datos[clave], { total: r.total ? r.total(datos[clave]) : null });
    } catch (err) {
      datos[clave] = null;
      if (err.pendiente) Zoo.ui.tablaPendiente(tbody, err);
      else Zoo.ui.error(err);
    }
  }

  document.querySelectorAll('[data-reporte]').forEach((tab) =>
    tab.addEventListener('shown.bs.tab', () => {
      activo = tab.dataset.reporte;
      cargar(activo);
    })
  );
  form.addEventListener('change', () => cargar(activo));

  async function exportar(tipo, boton) {
    const r = REPORTES[activo];
    const filas = datos[activo];
    if (!filas) {
      Zoo.ui.toast('Primero genera el reporte.', 'aviso');
      return;
    }
    Zoo.ui.cargando(boton, true);
    try {
      const opciones = {
        titulo: r.titulo,
        subtitulo: `Del ${Zoo.ui.fecha(form.desde.value)} al ${Zoo.ui.fecha(form.hasta.value)}`,
        columnas: r.columnas,
        filas: [...filas, ...(r.total ? [r.total(filas)] : [])],
        orientacion: 'landscape',
      };
      if (tipo === 'pdf') Zoo.reportes.pdf(opciones);
      else await Zoo.reportes.excel(opciones);
    } catch (err) {
      Zoo.ui.error(err);
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  }
  $('btnPdf').addEventListener('click', (e) => exportar('pdf', e.currentTarget));
  $('btnExcel').addEventListener('click', (e) => exportar('excel', e.currentTarget));

  cargar(activo);
});
