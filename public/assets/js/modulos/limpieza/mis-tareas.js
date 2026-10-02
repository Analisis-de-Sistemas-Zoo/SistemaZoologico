/**
 * Limpieza — Mis tareas (personal de limpieza, pensada para el teléfono).
 * Ver, iniciar y completar las tareas asignadas, registrando los insumos usados.
 * Contrato de la API: docs/api/limpieza.md
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);

  const lista = $('listaTareas');
  const campoFecha = $('fecha');
  let tareas = [];
  let insumos = [];
  let completando = null;

  // ------------------------------------------------------------ Fechas
  function sumarDias(fecha, dias) {
    const d = new Date(`${fecha}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  function textoFecha(fecha) {
    const hoy = Zoo.ui.hoy();
    if (fecha === hoy) return 'Hoy';
    if (fecha === Zoo.ui.hoy(-1)) return 'Ayer';
    if (fecha === Zoo.ui.hoy(1)) return 'Mañana';
    const texto = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  campoFecha.value = Zoo.ui.hoy();
  $('btnAnterior').addEventListener('click', () => { campoFecha.value = sumarDias(campoFecha.value, -1); cargar(); });
  $('btnSiguiente').addEventListener('click', () => { campoFecha.value = sumarDias(campoFecha.value, 1); cargar(); });
  campoFecha.addEventListener('change', cargar);

  // ------------------------------------------------------------ Tarjetas
  function tarjeta(t) {
    const esDeOtroDia = t.fecha_programada !== campoFecha.value;
    let acciones = '';
    if (t.estado === 'pendiente') {
      acciones = `<button class="btn btn-primary w-100" data-accion="iniciar" data-id="${t.id}"><i class="bi bi-play-fill me-2"></i>Iniciar tarea</button>`;
    } else if (t.estado === 'en_proceso') {
      acciones = `<button class="btn btn-acento w-100" data-accion="completar" data-id="${t.id}"><i class="bi bi-check2-circle me-2"></i>Completar tarea</button>`;
    }
    let nota = '';
    if (t.estado === 'completada') nota = '<div class="nota">Esperando la verificación del supervisor.</div>';
    if (t.estado === 'rechazada') nota = `<div class="nota rechazo"><strong>Rechazada:</strong> ${esc(t.observacion_verificacion || 'Sin observación')}</div>`;
    if (t.estado === 'cancelada') nota = `<div class="nota">Cancelada: ${esc(t.observacion_verificacion || '')}</div>`;
    if (t.estado === 'en_proceso' && t.inicio_real) nota = `<div class="nota">Iniciada a las ${esc(Zoo.ui.hora(t.inicio_real.slice(11)))}</div>`;

    return `
      <article class="tarea ${esc(t.estado)}">
        <div class="tarea-encabezado">
          <div>
            <div class="hora">${esc(Zoo.ui.hora(t.hora_programada))}</div>
            ${esDeOtroDia ? `<div class="small text-danger fw-semibold mt-1">Atrasada desde el ${esc(Zoo.ui.fecha(t.fecha_programada))}</div>` : ''}
          </div>
          ${E.estado('estadoTarea', t.estado)}
        </div>
        <div>
          <div class="lugar">${esc(t.area)}</div>
          <div class="detalle">${esc(E.texto('tipoLimpieza', t.tipo))}${t.descripcion ? `: ${esc(t.descripcion)}` : ''}</div>
        </div>
        ${nota}
        ${acciones}
      </article>`;
  }

  async function cargar() {
    $('textoFecha').textContent = textoFecha(campoFecha.value);
    try {
      tareas = await Zoo.api.get('/api/limpieza/mis-tareas', { fecha: campoFecha.value });
    } catch (err) {
      $('resumenDia').textContent = '';
      lista.innerHTML = err.pendiente ? Zoo.ui.pendienteHtml(err.message) : '';
      if (!err.pendiente) Zoo.ui.error(err);
      return;
    }
    const hechas = tareas.filter((t) => ['completada', 'verificada'].includes(t.estado)).length;
    $('resumenDia').textContent = tareas.length
      ? `${tareas.length} ${tareas.length === 1 ? 'tarea' : 'tareas'}, ${hechas} ${hechas === 1 ? 'completada' : 'completadas'}.`
      : '';
    lista.innerHTML = tareas.length
      ? tareas.map(tarjeta).join('')
      : `<div class="tabla-vacia panel"><i class="bi bi-emoji-smile"></i>No tienes tareas asignadas para este día.</div>`;
  }

  // ------------------------------------------------------------ Iniciar
  async function iniciar(tarea, boton) {
    Zoo.ui.cargando(boton, true);
    try {
      await Zoo.api.patch(`/api/limpieza/mis-tareas/${tarea.id}/iniciar`);
      Zoo.ui.toast('Tarea iniciada.', 'exito');
      cargar();
    } catch (err) {
      Zoo.ui.error(err);
      Zoo.ui.cargando(boton, false);
    }
  }

  // ---------------------------------------------------------- Completar
  const form = $('formCompletar');
  const modal = new bootstrap.Modal('#modalCompletar');
  const filas = $('filasInsumos');

  function filaInsumo() {
    const div = document.createElement('div');
    div.className = 'input-group';
    div.innerHTML = `
      <select class="form-select" data-campo="insumo" aria-label="Insumo">
        <option value="">Insumo</option>
        ${insumos.map((i) => `<option value="${i.id}" data-unidad="${esc(i.unidad_medida)}">${esc(i.nombre)} (hay ${esc(Limpieza.cantidad(i.stock_actual, i.unidad_medida))})</option>`).join('')}
      </select>
      <input class="form-control" style="max-width: 6.5rem" type="number" min="0.01" step="0.01" data-campo="cantidad" placeholder="Cant." aria-label="Cantidad">
      <span class="input-group-text" data-campo="unidad">u.</span>
      <button class="btn btn-outline-secondary" type="button" data-quitar aria-label="Quitar"><i class="bi bi-x-lg"></i></button>`;
    div.querySelector('select').addEventListener('change', (e) => {
      const unidad = e.target.selectedOptions[0]?.dataset.unidad;
      div.querySelector('[data-campo="unidad"]').textContent = unidad ? E.texto('unidadCorta', unidad) : 'u.';
    });
    div.querySelector('[data-quitar]').addEventListener('click', () => div.remove());
    filas.appendChild(div);
  }

  $('btnAgregarInsumo').addEventListener('click', filaInsumo);

  async function abrirCompletar(tarea) {
    completando = tarea;
    form.reset();
    Zoo.ui.limpiarErrores(form);
    filas.innerHTML = '';
    $('lugarCompletar').textContent = `${tarea.area}, ${E.texto('tipoLimpieza', tarea.tipo).toLowerCase()}.`;
    try {
      insumos = await Zoo.api.get('/api/limpieza/insumos', { activo: 1 });
    } catch {
      insumos = [];
    }
    modal.show();
  }

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const usados = [];
    let incompleto = false;
    filas.querySelectorAll('.input-group').forEach((fila) => {
      const id = Number(fila.querySelector('[data-campo="insumo"]').value);
      const cantidad = Number(fila.querySelector('[data-campo="cantidad"]').value);
      if (!id && !cantidad) return;
      if (!id || !(cantidad > 0)) incompleto = true;
      else usados.push({ insumo_limpieza_id: id, cantidad });
    });
    if (incompleto) {
      Zoo.ui.error({ message: 'Revisa los insumos: cada uno necesita el producto y una cantidad mayor a 0.' }, form);
      return;
    }
    const repetidos = usados.length !== new Set(usados.map((u) => u.insumo_limpieza_id)).size;
    if (repetidos) {
      Zoo.ui.error({ message: 'Hay un insumo repetido. Suma las cantidades en una sola fila.' }, form);
      return;
    }

    const boton = form.querySelector('[type="submit"]');
    Zoo.ui.cargando(boton, true);
    try {
      await Zoo.api.patch(`/api/limpieza/mis-tareas/${completando.id}/completar`, {
        observaciones: form.observaciones.value.trim(),
        insumos: usados,
      });
      modal.hide();
      Zoo.ui.toast('Tarea completada. Quedó pendiente de verificación.', 'exito');
      cargar();
    } catch (err) {
      Zoo.ui.error(err, form);
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  });

  lista.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-accion]');
    if (!boton) return;
    const tarea = tareas.find((t) => String(t.id) === boton.dataset.id);
    if (!tarea) return;
    if (boton.dataset.accion === 'iniciar') iniciar(tarea, boton);
    if (boton.dataset.accion === 'completar') abrirCompletar(tarea);
  });

  cargar();
});
