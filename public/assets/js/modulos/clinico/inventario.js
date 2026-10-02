/**
 * Clínico — Inventario de medicamentos, vacunas y vitaminas.
 * EJEMPLO COMPLETO: listar, crear, editar y activar/desactivar ya funcionan.
 * Movimientos e historial esperan su backend (docs/api/clinico.md).
 */
Zoo.listo(() => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const puedeGestionar = Zoo.sesion.puede('clinico.inventario.gestionar');

  Zoo.ui.opciones($('fTipo'), E.opciones('tipoInsumoClinico'), { vacio: 'Todos' });
  Zoo.ui.opciones($('iTipo'), E.opciones('tipoInsumoClinico'));
  Zoo.ui.opciones($('iUnidad'), E.opciones('unidadClinica'));

  // Los campos de vacuna solo se muestran para vacunas.
  function mostrarCamposVacuna() {
    const esVacuna = $('iTipo').value === 'vacuna';
    document.querySelectorAll('.grupo-vacuna').forEach((g) => {
      g.classList.toggle('d-none', !esVacuna);
      g.querySelectorAll('input').forEach((i) => (i.disabled = !esVacuna));
    });
  }
  $('iTipo').addEventListener('change', mostrarCamposVacuna);

  function nivel(i) {
    if (Number(i.stock_actual) <= 0) return '<span class="estado estado-peligro">Agotado</span>';
    if (Number(i.bajo_minimo)) return '<span class="estado estado-alerta">Bajo el mínimo</span>';
    return '<span class="estado estado-ok">Suficiente</span>';
  }

  // ------------------------------------------------------- Movimientos
  const formMov = $('formMovimiento');
  const modalMov = new bootstrap.Modal('#modalMovimiento');
  let insumoMov = null;

  const mostrarCamposEntrada = () => {
    const entrada = formMov.tipo.value === 'entrada';
    formMov.querySelectorAll('.solo-entrada').forEach((g) => {
      g.classList.toggle('d-none', !entrada);
      g.querySelectorAll('input').forEach((i) => (i.disabled = !entrada));
    });
  };
  formMov.addEventListener('change', mostrarCamposEntrada);

  function abrirMovimiento(insumo) {
    insumoMov = insumo;
    formMov.reset();
    Zoo.ui.limpiarErrores(formMov);
    mostrarCamposEntrada();
    $('tituloMovimiento').textContent = insumo.nombre;
    $('existenciaMovimiento').textContent = `Existencia actual: ${Clinico.cantidad(insumo.stock_actual, insumo.unidad_medida)}`;
    $('mUnidad').textContent = E.texto('unidadClinica', insumo.unidad_medida);
    $('mVence').min = Zoo.ui.hoy();
    modalMov.show();
  }

  formMov.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const boton = formMov.querySelector('[type="submit"]');
    Zoo.ui.cargando(boton, true);
    try {
      await Zoo.api.post(`/api/clinico/inventario/${insumoMov.id}/movimientos`, Zoo.ui.leerFormulario(formMov));
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
      const movimientos = await Zoo.api.get(`/api/clinico/inventario/${insumo.id}/movimientos`);
      Zoo.ui.tabla(tbody, movimientos, (m) => `
        <tr>
          <td class="text-nowrap">${esc(Zoo.ui.fechaHora(m.fecha))}</td>
          <td>${E.estado('movimientoClinico', m.tipo)}</td>
          <td class="text-end text-nowrap">${m.tipo === 'entrada' ? '+' : '−'}${esc(Clinico.cantidad(m.cantidad, insumo.unidad_medida))}</td>
          <td>${m.animal ? `Aplicado a ${esc(m.animal)}` : esc([m.motivo, m.numero_lote ? `lote ${m.numero_lote}` : '', m.fecha_vencimiento ? `vence ${Zoo.ui.fecha(m.fecha_vencimiento)}` : ''].filter(Boolean).join(', '))}</td>
          <td>${esc(m.usuario)}</td>
        </tr>`, { vacio: 'Este producto no tiene movimientos.', icono: 'bi-clock-history' });
    } catch (err) {
      if (err.pendiente) Zoo.ui.tablaPendiente(tbody, err);
      else Zoo.ui.error(err);
    }
  }

  // --------------------------------------------------------------- Lista
  const crud = Zoo.crud({
    url: '/api/clinico/inventario',
    nombre: 'producto',
    puedeEditar: puedeGestionar,
    icono: 'bi-capsule',
    acciones: { movimiento: abrirMovimiento, historial: verHistorial },
    alAbrir: (insumo) => {
      $('grupoInicial').classList.toggle('d-none', Boolean(insumo));
      $('iInicial').disabled = Boolean(insumo);
      mostrarCamposVacuna();
    },
    alCargar: (items) => {
      const bajos = items.filter((i) => Number(i.activo) && Number(i.bajo_minimo));
      const aviso = $('avisoBajos');
      aviso.classList.toggle('d-none', bajos.length === 0);
      aviso.innerHTML = bajos.length
        ? `<i class="bi bi-exclamation-triangle-fill me-2"></i><strong>${bajos.length} ${bajos.length === 1 ? 'producto está' : 'productos están'} en o bajo el mínimo:</strong> ${bajos.map((i) => esc(i.nombre)).join(', ')}.`
        : '';
    },
    fila: (i, puedeEditar) => {
      const boton = (accion, icono, titulo) =>
        `<button class="btn btn-sm btn-light" data-accion="${accion}" data-id="${i.id}" title="${titulo}"><i class="bi ${icono}"></i><span class="visually-hidden">${titulo}</span></button>`;
      const extra = [
        puedeEditar && Number(i.activo) ? boton('movimiento', 'bi-arrow-left-right', 'Registrar entrada o merma') : '',
        boton('historial', 'bi-clock-history', 'Ver historial'),
      ].join(' ');
      const detalle = [i.presentacion, i.enfermedad_previene ? `Previene ${i.enfermedad_previene}` : ''].filter(Boolean).join('. ');
      return `
        <tr>
          <td><div class="fw-semibold">${esc(i.nombre)}</div>${detalle ? `<div class="small text-secondary">${esc(detalle)}</div>` : ''}</td>
          <td>${E.estado('tipoInsumoClinico', i.tipo)}</td>
          <td class="text-end fw-semibold text-nowrap">${esc(Clinico.cantidad(i.stock_actual, i.unidad_medida))}</td>
          <td class="text-end text-nowrap">${esc(Zoo.ui.numero(i.stock_minimo, Number(i.stock_minimo) % 1 ? 2 : 0))}</td>
          <td>${nivel(i)}</td>
          <td>${E.estado('activo', i.activo)}</td>
          <td class="acciones">${Zoo.crud.botones(i, { editar: puedeEditar, estado: puedeEditar, extra })}</td>
        </tr>`;
    },
  });

  crud.recargar();
});
