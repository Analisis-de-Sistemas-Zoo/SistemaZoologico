/**
 * Clínico — Vacunas y tratamientos: dosis pendientes, historial y registro de aplicaciones.
 * Contrato: docs/api/clinico.md → Aplicaciones
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const puedeRegistrar = Zoo.sesion.puede('clinico.registrar');
  const parametros = new URLSearchParams(location.search);
  if (!puedeRegistrar) $('btnNueva').remove();

  const animales = await Zoo.api.get('/api/comun/animales');
  const textoAnimal = (a) => `${a.nombre} (${a.especie}, ${a.codigo})`;

  // ---------------------------------------------------------- Pendientes
  let pendientes = [];
  async function cargarPendientes() {
    const tbody = $('tablaPendientes');
    try {
      pendientes = await Zoo.api.get('/api/clinico/aplicaciones/pendientes', { dias: $('diasPendientes').value });
      Zoo.ui.tabla(tbody, pendientes, (p, i) => `
        <tr>
          <td>${E.estado('estadoDosis', p.estado)}</td>
          <td class="text-nowrap">${esc(Zoo.ui.fecha(p.proxima_dosis))}<div class="small text-secondary">${esc(Clinico.textoDias(p.dias))}</div></td>
          <td><div class="fw-semibold">${esc(p.animal)}</div><div class="small text-secondary">${esc(p.especie)}</div></td>
          <td>${esc(p.insumo)} ${E.estado('tipoInsumoClinico', p.tipo_insumo)}</td>
          <td class="text-nowrap">${esc(Zoo.ui.fecha(p.ultima_aplicacion))}<div class="small text-secondary">${esc(Clinico.cantidad(p.ultima_dosis, p.unidad_medida))}</div></td>
          <td class="acciones">${puedeRegistrar ? `<button class="btn btn-sm btn-primary" data-pendiente="${i}">Aplicar</button>` : ''}</td>
        </tr>`, { vacio: 'No hay dosis vencidas ni próximas en ese periodo.', icono: 'bi-calendar-check' });
    } catch (err) {
      if (err.pendiente) Zoo.ui.tablaPendiente(tbody, err);
      else Zoo.ui.error(err);
    }
  }
  $('diasPendientes').addEventListener('change', cargarPendientes);
  $('tablaPendientes').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-pendiente]');
    if (boton) abrir(pendientes[Number(boton.dataset.pendiente)]);
  });

  // ----------------------------------------------------------- Historial
  const formFiltros = $('formFiltros');
  $('fDesde').value = Zoo.ui.hoy(-90);
  $('fHasta').value = Zoo.ui.hoy();
  Zoo.ui.opciones($('fAnimal'), animales, { vacio: 'Todos', texto: textoAnimal });
  Zoo.ui.opciones($('fTipo'), E.opciones('tipoInsumoClinico'), { vacio: 'Todos' });

  async function cargarHistorial() {
    const contenedor = $('historial');
    try {
      const aplicaciones = await Zoo.api.get('/api/clinico/aplicaciones', Zoo.ui.leerFormulario(formFiltros));
      contenedor.innerHTML = aplicaciones.length
        ? Clinico.tablaAplicaciones(aplicaciones, { conAnimal: true })
        : '<div class="tabla-vacia"><i class="bi bi-eyedropper"></i>No hay aplicaciones con esos filtros.</div>';
    } catch (err) {
      contenedor.innerHTML = err.pendiente ? `<div class="p-3">${Zoo.ui.pendienteHtml(err.message)}</div>` : '';
      if (!err.pendiente) Zoo.ui.error(err);
    }
  }
  formFiltros.addEventListener('change', cargarHistorial);
  formFiltros.addEventListener('submit', (e) => e.preventDefault());

  // ------------------------------------------------------------ Registro
  const form = $('formAplicacion');
  const modal = new bootstrap.Modal('#modalAplicacion');
  let insumos = [];

  Zoo.ui.opciones($('aAnimal'), animales, { vacio: 'Selecciona el animal', texto: textoAnimal });
  Zoo.ui.opciones($('aVia'), E.opciones('via'), { vacio: 'Selecciona' });

  function alCambiarInsumo() {
    const insumo = insumos.find((i) => String(i.id) === $('aInsumo').value);
    $('aUnidad').textContent = insumo ? E.texto('unidadClinica', insumo.unidad_medida) : '—';
    const ayuda = [];
    if (insumo?.dosis_recomendada) ayuda.push(`Dosis recomendada: ${insumo.dosis_recomendada}`);
    if (insumo?.enfermedad_previene) ayuda.push(`Previene: ${insumo.enfermedad_previene}`);
    if (insumo?.intervalo_refuerzo_dias) ayuda.push(`Refuerzo cada ${insumo.intervalo_refuerzo_dias} días`);
    $('aInsumoAyuda').textContent = ayuda.join('. ');
    if (insumo?.intervalo_refuerzo_dias && $('aFecha').value) {
      $('aProxima').value = Clinico.sumarDias($('aFecha').value, insumo.intervalo_refuerzo_dias);
    }
  }
  $('aInsumo').addEventListener('change', alCambiarInsumo);

  async function abrir(prellenado = {}) {
    form.reset();
    Zoo.ui.limpiarErrores(form);
    try {
      insumos = await Zoo.api.get('/api/clinico/inventario', { activo: 1 });
    } catch {
      insumos = [];
    }
    Clinico.opcionesInsumos($('aInsumo'), insumos, 'Selecciona el producto');
    $('aFecha').value = Clinico.ahoraLocal();
    $('aFecha').max = Clinico.ahoraLocal();
    if (prellenado.animal_id) $('aAnimal').value = String(prellenado.animal_id);
    if (prellenado.insumo_clinico_id) $('aInsumo').value = String(prellenado.insumo_clinico_id);
    if (prellenado.ultima_dosis) $('aDosis').value = prellenado.ultima_dosis;
    if (prellenado.via) $('aVia').value = prellenado.via;
    alCambiarInsumo();
    $('tituloAplicacion').textContent = prellenado.insumo ? `Aplicar ${prellenado.insumo} a ${prellenado.animal}` : 'Registrar aplicación';
    modal.show();
  }

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const boton = form.querySelector('[type="submit"]');
    Zoo.ui.cargando(boton, true);
    try {
      await Zoo.api.post('/api/clinico/aplicaciones', Zoo.ui.leerFormulario(form));
      modal.hide();
      Zoo.ui.toast('Aplicación registrada y descontada del inventario.', 'exito');
      cargarPendientes();
      cargarHistorial();
    } catch (err) {
      Zoo.ui.error(err, form);
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  });

  if (puedeRegistrar) {
    $('btnNueva').addEventListener('click', () => abrir());
    if (parametros.has('nueva')) abrir({ animal_id: parametros.get('animal_id') });
  }

  cargarPendientes();
  cargarHistorial();
});
