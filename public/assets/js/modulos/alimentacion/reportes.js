/**
 * Alimentación — Reportes: consumo por alimento, por especie, cumplimiento de raciones,
 * compras por proveedor y lotes por vencer. Se exportan a PDF y Excel.
 */
Zoo.listo(() => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const A = window.Alimentacion;
  const form = $('formFiltros');

  form.desde.value = Zoo.ui.hoy(-6); // última semana
  form.hasta.value = Zoo.ui.hoy();
  const num = (v) => (v === null || v === undefined ? '' : Zoo.ui.numero(v));
  const q = (v) => Zoo.ui.moneda(v ?? 0);
  const cant = (campo) => (_v, f) => (f.unidad_medida ? A.cantidad(f[campo], f.unidad_medida) : '');
  const pct = (v) => (v === null || v === undefined ? '' : `${Zoo.ui.numero(v, 1)} %`);

  const REPORTES = {
    consumo: {
      titulo: 'Consumo de alimentos',
      url: '/api/alimentacion/reportes/consumo-alimentos',
      encabezado: 'encConsumo',
      tbody: 'tablaConsumo',
      nota: 'Entradas, consumo por raciones y mermas de cada alimento en el periodo. El costo se calcula con el precio del lote de donde salió.',
      columnas: [
        { titulo: 'Alimento', campo: 'alimento' },
        { titulo: 'Categoría', campo: (f) => (f.categoria ? E.texto('categoriaAlimento', f.categoria) : '') },
        { titulo: 'Raciones', campo: 'raciones', alinear: 'right', formato: num },
        { titulo: 'Entradas', campo: 'entradas', alinear: 'right', formato: cant('entradas') },
        { titulo: 'Consumido', campo: 'consumido', alinear: 'right', formato: cant('consumido') },
        { titulo: 'Merma', campo: 'merma', alinear: 'right', formato: cant('merma') },
        { titulo: 'Costo del consumo', campo: 'costo_consumo', alinear: 'right', formato: q },
        { titulo: 'Costo de la merma', campo: 'costo_merma', alinear: 'right', formato: q },
      ],
      total: (f) => ({ alimento: 'Total', ...Zoo.reportes.sumar(f, ['raciones', 'costo_consumo', 'costo_merma']) }),
    },
    especies: {
      titulo: 'Consumo por especie',
      url: '/api/alimentacion/reportes/consumo-especies',
      encabezado: 'encEspecies',
      tbody: 'tablaEspecies',
      nota: 'Lo que se sirvió a cada especie según las raciones registradas, y cuántas veces dejaron comida.',
      columnas: [
        { titulo: 'Especie', campo: 'especie' },
        { titulo: 'Alimento', campo: 'alimento' },
        { titulo: 'Animales', campo: 'animales', alinear: 'right', formato: num },
        { titulo: 'Raciones', campo: 'raciones', alinear: 'right', formato: num },
        { titulo: 'Cantidad servida', campo: 'cantidad', alinear: 'right', formato: cant('cantidad') },
        { titulo: 'Comieron una parte', campo: 'parciales', alinear: 'right', formato: num },
        { titulo: 'No comieron', campo: 'rechazadas', alinear: 'right', formato: num },
      ],
      total: (f) => ({ especie: 'Total', ...Zoo.reportes.sumar(f, ['raciones', 'parciales', 'rechazadas']) }),
    },
    cumplimiento: {
      titulo: 'Cumplimiento de raciones por jaula',
      url: '/api/alimentacion/reportes/cumplimiento',
      encabezado: 'encCumplimiento',
      tbody: 'tablaCumplimiento',
      nota: 'Raciones programadas según horarios y dietas, contra las registradas. De hoy solo cuentan los turnos cuya hora ya pasó. Máximo 62 días.',
      columnas: [
        { titulo: 'Jaula', campo: 'area' },
        { titulo: 'Cuidadores', campo: 'cuidadores' },
        { titulo: 'Turnos', campo: 'turnos', alinear: 'right', formato: num },
        { titulo: 'Programadas', campo: 'programadas', alinear: 'right', formato: num },
        { titulo: 'Registradas', campo: 'registradas', alinear: 'right', formato: num },
        { titulo: 'Sin registrar', campo: 'pendientes', alinear: 'right', formato: num },
        { titulo: 'Comieron una parte', campo: 'parciales', alinear: 'right', formato: num },
        { titulo: 'No comieron', campo: 'rechazadas', alinear: 'right', formato: num },
        { titulo: 'Cumplimiento', campo: 'cumplimiento', alinear: 'right', formato: pct,
          html: (v) => (v === null ? '' : `<div class="barra-porcentaje justify-content-end"><div class="barra" style="max-width:6rem"><span class="${v < 80 ? 'bajo' : ''}" style="width:${v}%"></span></div><span class="fw-semibold">${esc(pct(v))}</span></div>`) },
      ],
      total: (f) => {
        const t = Zoo.reportes.sumar(f, ['turnos', 'programadas', 'registradas', 'pendientes', 'parciales', 'rechazadas']);
        return { area: 'Total', ...t, cumplimiento: t.programadas ? Math.round((t.registradas / t.programadas) * 1000) / 10 : null };
      },
    },
    compras: {
      titulo: 'Compras por proveedor',
      url: '/api/alimentacion/reportes/compras',
      encabezado: 'encCompras',
      tbody: 'tablaCompras',
      nota: 'Entregas recibidas en el periodo, según la fecha de ingreso de cada lote.',
      columnas: [
        { titulo: 'Proveedor', campo: 'proveedor' },
        { titulo: 'NIT', campo: 'nit' },
        { titulo: 'Entregas', campo: 'entregas', alinear: 'right', formato: num },
        { titulo: 'Alimentos', campo: 'detalle' },
        { titulo: 'Última entrega', campo: 'ultima_entrega', formato: (v) => (/^\d{4}-/.test(v || '') ? Zoo.ui.fecha(v) : '') },
        { titulo: 'Total', campo: 'total', alinear: 'right', formato: q },
      ],
      total: (f) => ({ proveedor: 'Total', ...Zoo.reportes.sumar(f, ['entregas', 'total']) }),
    },
    vencimientos: {
      titulo: 'Lotes vencidos y por vencer',
      url: '/api/alimentacion/reportes/vencimientos',
      encabezado: 'encVencimientos',
      tbody: 'tablaVencimientos',
      sinRango: true,
      nota: 'Lotes con existencia que ya vencieron o vencen en los próximos 30 días (no depende de las fechas de arriba).',
      columnas: [
        { titulo: 'Vence', campo: 'fecha_vencimiento', formato: (v) => (/^\d{4}-/.test(v || '') ? Zoo.ui.fecha(v) : v) },
        { titulo: 'Días', campo: 'dias_para_vencer', alinear: 'right', formato: (v) => (v === undefined ? '' : String(v)) },
        { titulo: 'Alimento', campo: 'alimento' },
        { titulo: 'Lote', campo: 'numero_lote' },
        { titulo: 'Proveedor', campo: 'proveedor' },
        { titulo: 'Disponible', campo: 'cantidad_disponible', alinear: 'right', formato: cant('cantidad_disponible') },
        { titulo: 'Valor', campo: 'valor', alinear: 'right', formato: q },
        { titulo: 'Estado', campo: (f) => (f.estado ? E.texto('estadoLote', f.estado) : ''), html: (_v, f) => E.estado('estadoLote', f.estado) },
      ],
      total: (f) => ({ fecha_vencimiento: 'Total', ...Zoo.reportes.sumar(f, ['valor']) }),
    },
  };

  const datos = {};
  let activo = 'consumo';

  Object.values(REPORTES).forEach((r) => {
    $(r.encabezado).innerHTML = r.columnas.map((c) => `<th class="${c.alinear === 'right' ? 'text-end' : ''}">${esc(c.titulo)}</th>`).join('');
  });

  async function cargar(clave) {
    const r = REPORTES[clave];
    const tbody = $(r.tbody);
    $('notaReporte').textContent = r.nota || '';
    if (!form.desde.value || !form.hasta.value || form.desde.value > form.hasta.value) {
      tbody.innerHTML = `<tr><td colspan="${r.columnas.length}"><div class="tabla-vacia">Elige un periodo válido.</div></td></tr>`;
      return;
    }
    try {
      datos[clave] = await Zoo.api.get(r.url, r.sinRango ? {} : { desde: form.desde.value, hasta: form.hasta.value });
      Zoo.reportes.pintar(tbody, r.columnas, datos[clave], { total: r.total ? r.total(datos[clave]) : null });
    } catch (err) {
      datos[clave] = null;
      if (err.pendiente) Zoo.ui.tablaPendiente(tbody, err);
      else {
        Zoo.ui.error(err, form);
        tbody.innerHTML = `<tr><td colspan="${r.columnas.length}"><div class="tabla-vacia">${esc(err.errores?.[0]?.mensaje || err.message)}</div></td></tr>`;
      }
    }
  }

  document.querySelectorAll('[data-reporte]').forEach((tab) =>
    tab.addEventListener('shown.bs.tab', () => {
      activo = tab.dataset.reporte;
      cargar(activo);
    })
  );
  form.addEventListener('change', () => { Zoo.ui.limpiarErrores(form); cargar(activo); });

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
        subtitulo: r.sinRango ? `Al ${Zoo.ui.fecha(Zoo.ui.hoy())}` : `Del ${Zoo.ui.fecha(form.desde.value)} al ${Zoo.ui.fecha(form.hasta.value)}`,
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
