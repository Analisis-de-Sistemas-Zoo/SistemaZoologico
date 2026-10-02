/**
 * Clínico — Consultas: historial filtrable y registro de nuevas consultas con
 * los medicamentos, vacunas o vitaminas aplicados.
 * Contrato: docs/api/clinico.md → Consultas
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const puedeRegistrar = Zoo.sesion.puede('clinico.registrar');
  const parametros = new URLSearchParams(location.search);
  if (!puedeRegistrar) $('btnNueva').remove();

  const [animales, veterinarios] = await Promise.all([
    Zoo.api.get('/api/comun/animales'),
    Zoo.api.get('/api/comun/veterinarios'),
  ]);
  const textoAnimal = (a) => `${a.nombre} (${a.especie}, ${a.codigo})`;

  // ------------------------------------------------------------- Filtros
  $('fDesde').value = Zoo.ui.hoy(-30);
  $('fHasta').value = Zoo.ui.hoy();
  Zoo.ui.opciones($('fAnimal'), animales, { vacio: 'Todos', texto: textoAnimal });
  Zoo.ui.opciones($('fVeterinario'), veterinarios, { vacio: 'Todos' });
  Zoo.ui.opciones($('fTipo'), E.opciones('tipoConsulta'), { vacio: 'Todos' });
  if (parametros.get('animal_id') && !parametros.has('nueva')) $('fAnimal').value = parametros.get('animal_id');

  // ------------------------------------------------------------- Detalle
  async function ver(consulta) {
    try {
      const detalle = await Zoo.api.get(`/api/clinico/consultas/${consulta.id}`);
      $('tituloDetalle').textContent = `Consulta de ${detalle.animal}`;
      $('cuerpoDetalle').innerHTML = Clinico.consultaHtml(detalle);
      bootstrap.Modal.getOrCreateInstance('#modalDetalle').show();
    } catch (err) {
      Zoo.ui.error(err);
    }
  }

  const crud = Zoo.crud({
    url: '/api/clinico/consultas',
    nombre: 'consulta',
    femenino: true,
    puedeEditar: false,
    icono: 'bi-clipboard2-pulse',
    vacio: 'No hay consultas con esos filtros.',
    acciones: { ver },
    fila: (c) => `
      <tr>
        <td class="text-nowrap">${esc(Zoo.ui.fecha(c.fecha))}<div class="small text-secondary">${esc(Zoo.ui.hora(String(c.fecha).slice(11)))}</div></td>
        <td><div class="fw-semibold">${esc(c.animal)}</div><div class="small text-secondary">${esc(c.especie)}</div></td>
        <td>${E.estado('tipoConsulta', c.tipo)}</td>
        <td><div>${esc(c.motivo)}</div>${c.diagnostico ? `<div class="small text-secondary text-truncate" style="max-width: 22rem">${esc(c.diagnostico)}</div>` : ''}</td>
        <td>${E.estado('estadoSalud', c.estado_salud_resultante)}</td>
        <td>${esc(c.veterinario)}</td>
        <td class="acciones"><button class="btn btn-sm btn-light" data-accion="ver" data-id="${c.id}" title="Ver consulta"><i class="bi bi-eye"></i><span class="visually-hidden">Ver consulta</span></button></td>
      </tr>`,
  });

  // ------------------------------------------------------ Nueva consulta
  const form = $('formConsulta');
  const modal = new bootstrap.Modal('#modalConsulta');
  const filas = $('filasAplicacion');
  let insumos = [];

  Zoo.ui.opciones($('cAnimal'), animales, { vacio: 'Selecciona el animal', texto: textoAnimal });
  Zoo.ui.opciones($('cTipo'), E.opciones('tipoConsulta'));
  Zoo.ui.opciones($('cEstado'), E.opciones('estadoSalud'), { vacio: 'Selecciona' });

  const actualizarAvisoVacio = () => $('sinAplicaciones').classList.toggle('d-none', filas.children.length > 0);

  function agregarFila() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><select class="form-select form-select-sm" data-campo="insumo_clinico_id" aria-label="Producto"></select></td>
      <td><div class="input-group input-group-sm">
        <input class="form-control" type="number" min="0.01" step="0.01" data-campo="dosis" aria-label="Dosis">
        <span class="input-group-text" data-texto-unidad>—</span></div></td>
      <td><select class="form-select form-select-sm" data-campo="via" aria-label="Vía"></select></td>
      <td><input class="form-control form-control-sm" type="date" data-campo="proxima_dosis" aria-label="Próxima dosis"></td>
      <td class="text-end"><button class="btn btn-sm btn-light" type="button" data-quitar aria-label="Quitar"><i class="bi bi-x-lg"></i></button></td>`;
    const select = tr.querySelector('[data-campo="insumo_clinico_id"]');
    Clinico.opcionesInsumos(select, insumos);
    Zoo.ui.opciones(tr.querySelector('[data-campo="via"]'), E.opciones('via'), { vacio: 'Vía' });
    select.addEventListener('change', () => {
      const opcion = select.selectedOptions[0];
      tr.querySelector('[data-texto-unidad]').textContent = opcion?.dataset.unidad ? E.texto('unidadClinica', opcion.dataset.unidad) : '—';
      // Vacunas: sugerir la próxima dosis según su intervalo de refuerzo.
      const intervalo = Number(opcion?.dataset.intervalo);
      const proxima = tr.querySelector('[data-campo="proxima_dosis"]');
      if (intervalo && !proxima.value && $('cFecha').value) proxima.value = Clinico.sumarDias($('cFecha').value, intervalo);
    });
    tr.querySelector('[data-quitar]').addEventListener('click', () => { tr.remove(); actualizarAvisoVacio(); });
    filas.appendChild(tr);
    actualizarAvisoVacio();
  }

  $('btnAgregarAplicacion').addEventListener('click', agregarFila);

  async function abrirNueva(animalId) {
    form.reset();
    Zoo.ui.limpiarErrores(form);
    filas.innerHTML = '';
    actualizarAvisoVacio();
    $('cFecha').value = Clinico.ahoraLocal();
    $('cFecha').max = Clinico.ahoraLocal();
    $('cRevision').min = Zoo.ui.hoy();
    if (animalId) {
      $('cAnimal').value = String(animalId);
      const animal = animales.find((a) => String(a.id) === String(animalId));
      if (animal) $('cEstado').value = animal.estado_salud;
    }
    try {
      insumos = await Zoo.api.get('/api/clinico/inventario', { activo: 1 });
    } catch {
      insumos = [];
    }
    modal.show();
  }

  $('cAnimal').addEventListener('change', () => {
    const animal = animales.find((a) => String(a.id) === $('cAnimal').value);
    if (animal && !$('cEstado').value) $('cEstado').value = animal.estado_salud;
  });

  function leerAplicaciones() {
    return [...filas.children].map((tr) => {
      const valor = (campo) => tr.querySelector(`[data-campo="${campo}"]`).value;
      return {
        insumo_clinico_id: valor('insumo_clinico_id') ? Number(valor('insumo_clinico_id')) : null,
        dosis: valor('dosis') ? Number(valor('dosis')) : null,
        via: valor('via'),
        proxima_dosis: valor('proxima_dosis'),
      };
    });
  }

  /** Marca en la fila correspondiente los errores tipo "aplicaciones[1].dosis". */
  function marcarErroresDeFilas(err) {
    (err.errores || []).forEach(({ campo, mensaje }) => {
      const m = /^aplicaciones\[(\d+)\]\.(\w+)$/.exec(campo);
      if (!m) return;
      const control = filas.children[Number(m[1])]?.querySelector(`[data-campo="${m[2]}"]`);
      if (control) {
        control.classList.add('is-invalid');
        control.title = mensaje;
      }
    });
  }

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const datos = { ...Zoo.ui.leerFormulario(form), aplicaciones: leerAplicaciones() };
    const boton = form.querySelector('[type="submit"]');
    Zoo.ui.cargando(boton, true);
    try {
      await Zoo.api.post('/api/clinico/consultas', datos);
      modal.hide();
      Zoo.ui.toast('Consulta registrada. El estado de salud del animal quedó actualizado.', 'exito');
      crud.recargar();
    } catch (err) {
      Zoo.ui.error(err, form);
      marcarErroresDeFilas(err);
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  });

  if (puedeRegistrar) {
    $('btnNueva').addEventListener('click', () => abrirNueva());
    if (parametros.has('nueva')) abrirNueva(parametros.get('animal_id'));
  }

  crud.recargar();
});
