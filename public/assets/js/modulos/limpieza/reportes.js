/**
 * Limpieza — Reportes: cumplimiento por área, consumo de insumos y desempeño del personal.
 * Contrato de la API: docs/api/limpieza.md → "Reportes"
 */
Zoo.listo(() => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const form = $('formFiltros');

  form.desde.value = Zoo.reportes.inicioDeMes();
  form.hasta.value = Zoo.ui.hoy();

  /** % de tareas verificadas sobre las que no se cancelaron. */
  const cumplimiento = (f) => {
    const base = Number(f.programadas) - Number(f.canceladas || 0);
    return base > 0 ? Math.round((Number(f.verificadas) / base) * 100) : 0;
  };
  const barra = (pct) => `<div class="barra-porcentaje"><div class="barra"><span class="${pct < 80 ? 'bajo' : ''}" style="width:${pct}%"></span></div><span>${pct}%</span></div>`;
  const num = (decimales = 0) => (v) => Zoo.ui.numero(v ?? 0, decimales);

  const REPORTES = {
    cumplimiento: {
      titulo: 'Cumplimiento de limpieza por área',
      url: '/api/limpieza/reportes/cumplimiento',
      encabezado: 'encCumplimiento',
      tbody: 'tablaCumplimiento',
      columnas: [
        { titulo: 'Área', campo: 'area' },
        { titulo: 'Tipo', campo: (f) => (f.tipo_area ? E.texto('tipoArea', f.tipo_area) : '') },
        { titulo: 'Programadas', campo: 'programadas', alinear: 'right' },
        { titulo: 'Verificadas', campo: 'verificadas', alinear: 'right' },
        { titulo: 'Por verificar', campo: 'completadas', alinear: 'right' },
        { titulo: 'Rechazadas', campo: 'rechazadas', alinear: 'right' },
        { titulo: 'Pendientes', campo: 'pendientes', alinear: 'right' },
        { titulo: 'Canceladas', campo: 'canceladas', alinear: 'right' },
        { titulo: 'Cumplimiento', campo: cumplimiento, formato: (v) => `${v}%`, html: barra },
      ],
      total: (filas) => ({ area: 'Total', ...Zoo.reportes.sumar(filas, ['programadas', 'verificadas', 'completadas', 'rechazadas', 'pendientes', 'canceladas']) }),
    },
    consumo: {
      titulo: 'Consumo de insumos de limpieza',
      url: '/api/limpieza/reportes/consumo-insumos',
      encabezado: 'encConsumo',
      tbody: 'tablaConsumo',
      columnas: [
        { titulo: 'Insumo', campo: 'nombre' },
        { titulo: 'Unidad', campo: (f) => E.texto('unidadInsumo', f.unidad_medida) },
        { titulo: 'Entradas', campo: 'entradas', alinear: 'right', formato: num(2) },
        { titulo: 'Usado en tareas', campo: 'salidas', alinear: 'right', formato: num(2) },
        { titulo: 'Mermas', campo: 'mermas', alinear: 'right', formato: num(2) },
        { titulo: 'Existencia actual', campo: 'stock_actual', alinear: 'right', formato: num(2),
          html: (v, f) => `${esc(Zoo.ui.numero(v, 2))}${Number(f.stock_actual) <= Number(f.stock_minimo) ? ' <span class="estado estado-alerta ms-1">Bajo</span>' : ''}` },
      ],
      total: null,
    },
    personal: {
      titulo: 'Desempeño del personal de limpieza',
      url: '/api/limpieza/reportes/personal',
      encabezado: 'encPersonal',
      tbody: 'tablaPersonal',
      columnas: [
        { titulo: 'Persona', campo: 'nombre' },
        { titulo: 'Asignadas', campo: 'asignadas', alinear: 'right' },
        { titulo: 'Completadas', campo: 'completadas', alinear: 'right' },
        { titulo: 'Verificadas', campo: 'verificadas', alinear: 'right' },
        { titulo: 'Rechazadas', campo: 'rechazadas', alinear: 'right' },
        { titulo: 'Tiempo promedio', campo: 'minutos_promedio', alinear: 'right', formato: (v) => (v ? `${Math.round(v)} min` : '') },
      ],
      total: (filas) => ({ nombre: 'Total', ...Zoo.reportes.sumar(filas, ['asignadas', 'completadas', 'verificadas', 'rechazadas']) }),
    },
  };

  const datos = {};
  let activo = 'cumplimiento';

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
      const total = r.total ? [r.total(filas)] : [];
      const opciones = {
        titulo: r.titulo,
        subtitulo: `Del ${Zoo.ui.fecha(form.desde.value)} al ${Zoo.ui.fecha(form.hasta.value)}`,
        columnas: r.columnas,
        filas: [...filas, ...total],
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
