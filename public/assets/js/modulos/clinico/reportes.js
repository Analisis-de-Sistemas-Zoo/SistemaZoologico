/**
 * Clínico — Reportes: atenciones por veterinario, consumo de insumos y vacunación.
 * Contrato: docs/api/clinico.md → Reportes
 */
Zoo.listo(() => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const form = $('formFiltros');

  form.desde.value = Zoo.reportes.inicioDeMes();
  form.hasta.value = Zoo.ui.hoy();
  const num = (decimales = 0) => (v) => Zoo.ui.numero(v ?? 0, decimales);

  const REPORTES = {
    atenciones: {
      titulo: 'Atenciones veterinarias',
      url: '/api/clinico/reportes/atenciones',
      encabezado: 'encAtenciones',
      tbody: 'tablaAtenciones',
      columnas: [
        { titulo: 'Veterinario', campo: 'veterinario' },
        { titulo: 'Rutina', campo: 'rutina', alinear: 'right' },
        { titulo: 'Emergencia', campo: 'emergencia', alinear: 'right' },
        { titulo: 'Seguimiento', campo: 'seguimiento', alinear: 'right' },
        { titulo: 'Ingreso', campo: 'ingreso', alinear: 'right' },
        { titulo: 'Total de consultas', campo: 'total', alinear: 'right' },
        { titulo: 'Aplicaciones', campo: 'aplicaciones', alinear: 'right' },
      ],
      total: (f) => ({ veterinario: 'Total', ...Zoo.reportes.sumar(f, ['rutina', 'emergencia', 'seguimiento', 'ingreso', 'total', 'aplicaciones']) }),
    },
    consumo: {
      titulo: 'Consumo de medicamentos, vacunas y vitaminas',
      url: '/api/clinico/reportes/consumo',
      encabezado: 'encConsumo',
      tbody: 'tablaConsumo',
      columnas: [
        { titulo: 'Producto', campo: 'nombre' },
        { titulo: 'Tipo', campo: (f) => E.texto('tipoInsumoClinico', f.tipo), html: (_v, f) => E.estado('tipoInsumoClinico', f.tipo) },
        { titulo: 'Unidad', campo: (f) => E.texto('unidadClinica', f.unidad_medida) },
        { titulo: 'Entradas', campo: 'entradas', alinear: 'right', formato: num(2) },
        { titulo: 'Aplicado', campo: 'salidas', alinear: 'right', formato: num(2) },
        { titulo: 'Mermas', campo: 'mermas', alinear: 'right', formato: num(2) },
        { titulo: 'Existencia actual', campo: 'stock_actual', alinear: 'right', formato: num(2),
          html: (v, f) => `${esc(Zoo.ui.numero(v, 2))}${Number(f.stock_actual) <= Number(f.stock_minimo) ? ' <span class="estado estado-alerta ms-1">Bajo</span>' : ''}` },
      ],
      total: null,
    },
    vacunacion: {
      titulo: 'Vacunas aplicadas',
      url: '/api/clinico/reportes/vacunacion',
      encabezado: 'encVacunacion',
      tbody: 'tablaVacunacion',
      columnas: [
        { titulo: 'Fecha', campo: 'fecha_aplicacion', formato: Zoo.ui.fechaHora },
        { titulo: 'Animal', campo: (f) => `${f.animal} (${f.animal_codigo})` },
        { titulo: 'Especie', campo: 'especie' },
        { titulo: 'Vacuna', campo: 'vacuna' },
        { titulo: 'Previene', campo: 'enfermedad_previene' },
        { titulo: 'Veterinario', campo: 'veterinario' },
        { titulo: 'Próxima dosis', campo: 'proxima_dosis', formato: Zoo.ui.fecha },
      ],
      total: null,
    },
  };

  const datos = {};
  let activo = 'atenciones';

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
