/**
 * Limpieza — Insumos.
 * EJEMPLO COMPLETO: listar, crear, editar y activar/desactivar ya funcionan.
 * Movimientos e historial esperan su backend (docs/api/limpieza.md).
 */
Zoo.listo(() => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const puedeGestionar = Zoo.sesion.puede('limpieza.insumos.gestionar');

  Zoo.ui.opciones($('iUnidad'), E.opciones('unidadInsumo'));

  function nivel(i) {
    if (Number(i.stock_actual) <= 0) return '<span class="estado estado-peligro">Agotado</span>';
    if (Number(i.bajo_minimo)) return '<span class="estado estado-alerta">Bajo el mínimo</span>';
    return '<span class="estado estado-ok">Suficiente</span>';
  }

  // ------------------------------------------------------- Movimientos
  const formMov = $('formMovimiento');
  const modalMov = new bootstrap.Modal('#modalMovimiento');
  let insumoMov = null;

  function abrirMovimiento(insumo) {
    insumoMov = insumo;
    formMov.reset();
    Zoo.ui.limpiarErrores(formMov);
    $('tituloMovimiento').textContent = insumo.nombre;
    $('existenciaMovimiento').textContent = `Existencia actual: ${Limpieza.cantidad(insumo.stock_actual, insumo.unidad_medida)}`;
    $('mUnidad').textContent = E.texto('unidadCorta', insumo.unidad_medida);
    modalMov.show();
  }

  formMov.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const boton = formMov.querySelector('[type="submit"]');
    Zoo.ui.cargando(boton, true);
    try {
      await Zoo.api.post(`/api/limpieza/insumos/${insumoMov.id}/movimientos`, Zoo.ui.leerFormulario(formMov));
      modalMov.hide();
      Zoo.ui.toast('Movimiento registrado.', 'exito');
      crud.recargar();
    } catch (err) {
      Zoo.ui.error(err, formMov);
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  });

  // ---------------------------------------------------------- Historial
  async function verHistorial(insumo) {
    const tbody = $('tablaHistorial');
    $('tituloHistorial').textContent = `Historial: ${insumo.nombre}`;
    tbody.innerHTML = '';
    bootstrap.Modal.getOrCreateInstance('#modalHistorial').show();
    try {
      const movimientos = await Zoo.api.get(`/api/limpieza/insumos/${insumo.id}/movimientos`);
      Zoo.ui.tabla(tbody, movimientos, (m) => `
        <tr>
          <td class="text-nowrap">${esc(Zoo.ui.fechaHora(m.fecha))}</td>
          <td>${E.estado('movimientoInsumo', m.tipo)}</td>
          <td class="text-end text-nowrap">${m.tipo === 'entrada' ? '+' : '−'}${esc(Limpieza.cantidad(m.cantidad, insumo.unidad_medida))}</td>
          <td>${m.area ? `Tarea en ${esc(m.area)}` : esc(m.motivo || '')}</td>
          <td>${esc(m.usuario)}</td>
        </tr>`, { vacio: 'Este insumo no tiene movimientos.', icono: 'bi-clock-history' });
    } catch (err) {
      if (err.pendiente) Zoo.ui.tablaPendiente(tbody, err);
      else Zoo.ui.error(err);
    }
  }

  // --------------------------------------------------------------- Lista
  const crud = Zoo.crud({
    url: '/api/limpieza/insumos',
    nombre: 'insumo',
    puedeEditar: puedeGestionar,
    icono: 'bi-droplet',
    acciones: { movimiento: abrirMovimiento, historial: verHistorial },
    alAbrir: (insumo) => {
      // La existencia solo se captura al crear; después cambia con movimientos.
      $('grupoInicial').classList.toggle('d-none', Boolean(insumo));
      $('iInicial').disabled = Boolean(insumo);
    },
    alCargar: (items) => {
      const bajos = items.filter((i) => Number(i.activo) && Number(i.bajo_minimo));
      const aviso = $('avisoBajos');
      aviso.classList.toggle('d-none', bajos.length === 0);
      aviso.innerHTML = bajos.length
        ? `<i class="bi bi-exclamation-triangle-fill me-2"></i><strong>${bajos.length} ${bajos.length === 1 ? 'insumo está' : 'insumos están'} en o bajo el mínimo:</strong> ${bajos.map((i) => esc(i.nombre)).join(', ')}.`
        : '';
    },
    fila: (i, puedeEditar) => {
      const boton = (accion, icono, titulo) =>
        `<button class="btn btn-sm btn-light" data-accion="${accion}" data-id="${i.id}" title="${titulo}"><i class="bi ${icono}"></i><span class="visually-hidden">${titulo}</span></button>`;
      const extra = [
        puedeEditar && Number(i.activo) ? boton('movimiento', 'bi-arrow-left-right', 'Registrar entrada o merma') : '',
        boton('historial', 'bi-clock-history', 'Ver historial'),
      ].join(' ');
      return `
        <tr>
          <td><div class="fw-semibold">${esc(i.nombre)}</div>${i.descripcion ? `<div class="small text-secondary">${esc(i.descripcion)}</div>` : ''}</td>
          <td>${esc(E.texto('unidadInsumo', i.unidad_medida))}</td>
          <td class="text-end fw-semibold">${esc(Zoo.ui.numero(i.stock_actual, 2))}</td>
          <td class="text-end">${esc(Zoo.ui.numero(i.stock_minimo, 2))}</td>
          <td>${nivel(i)}</td>
          <td>${E.estado('activo', i.activo)}</td>
          <td class="acciones">${Zoo.crud.botones(i, { editar: puedeEditar, estado: puedeEditar, extra })}</td>
        </tr>`;
    },
  });

  crud.recargar();
});
