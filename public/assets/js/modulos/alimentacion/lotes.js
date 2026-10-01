/**
 * Alimentación — Entradas y lotes: registrar compras, corregir datos, mermas e historial.
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const A = window.Alimentacion;
  const puedeGestionar = Zoo.sesion.puede('alimentacion.inventario.gestionar');
  const form = $('formEditar');

  // ------------------------------------------------------------ Catálogos
  let alimentos = [];
  let proveedores = [];
  try {
    [alimentos, proveedores] = await Promise.all([
      Zoo.api.get('/api/alimentacion/alimentos', { activo: '' }),
      Zoo.api.get('/api/alimentacion/proveedores', { activo: '' }),
    ]);
  } catch (err) {
    Zoo.ui.error(err);
  }
  alimentos.sort((a, b) => a.nombre.localeCompare(b.nombre));
  A.opcionesAlimentos($('fAlimento'), alimentos, 'Todos');
  Zoo.ui.opciones($('fProveedor'), proveedores, { vacio: 'Todos' });
  Zoo.ui.opciones($('fDesde'), [
    { id: Zoo.ui.hoy(-7), nombre: 'Últimos 7 días' },
    { id: Zoo.ui.hoy(-30), nombre: 'Últimos 30 días' },
    { id: Zoo.ui.hoy(-90), nombre: 'Últimos 3 meses' },
  ], { vacio: 'Cualquier fecha' });
  Zoo.ui.opciones($('fEstado'), [{ id: 'con_existencia', nombre: 'Con existencia' }, ...E.opciones('estadoLote')], { vacio: 'Todos' });

  function opcionesFormulario(lote) {
    A.opcionesAlimentos($('lAlimento'), alimentos.filter((a) => Number(a.activo) || a.id === lote?.alimento_id));
    $('lProveedor').innerHTML = '<option value="">Selecciona el proveedor</option>' + proveedores
      .filter((p) => Number(p.activo) || p.id === lote?.proveedor_id)
      .map((p) => `<option value="${p.id}">${esc(p.nombre)}${Number(p.activo) ? '' : ' (inactivo)'}</option>`).join('');
  }

  function actualizarUnidad() {
    const opcion = $('lAlimento').selectedOptions[0];
    $('lUnidad').textContent = E.texto('unidadAlimentoCorta', opcion?.dataset.unidad || 'kg');
    const total = Number($('lCantidad').value || 0) * Number($('lCosto').value || 0);
    $('lTotal').textContent = total > 0 ? `Total de la entrada: ${Zoo.ui.moneda(total)}` : '';
  }
  ['lAlimento', 'lCantidad', 'lCosto'].forEach((id) => $(id).addEventListener('input', actualizarUnidad));

  // ---------------------------------------------------------------- Merma
  const formMerma = $('formMerma');
  const modalMerma = new bootstrap.Modal('#modalMerma');
  let loteMerma = null;

  function abrirMerma(lote, { baja = false } = {}) {
    loteMerma = lote;
    formMerma.reset();
    Zoo.ui.limpiarErrores(formMerma);
    $('tituloMerma').textContent = baja ? 'Dar de baja lote vencido' : 'Registrar merma';
    $('infoMerma').innerHTML = `Lote <strong>${esc(lote.numero_lote)}</strong> de ${esc(lote.alimento)}. Disponible: <strong>${esc(A.cantidad(lote.cantidad_disponible, lote.unidad_medida))}</strong>.`;
    $('mUnidad').textContent = E.texto('unidadAlimentoCorta', lote.unidad_medida);
    $('mCantidad').max = lote.cantidad_disponible;
    if (baja) {
      $('mCantidad').value = lote.cantidad_disponible;
      $('mMotivo').value = `Lote vencido el ${Zoo.ui.fecha(lote.fecha_vencimiento)}`;
    }
    modalMerma.show();
  }
  $('btnTodo').addEventListener('click', () => { $('mCantidad').value = loteMerma?.cantidad_disponible ?? ''; });

  formMerma.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = formMerma.querySelector('[type="submit"]');
    Zoo.ui.cargando(boton, true);
    try {
      await Zoo.api.post(`/api/alimentacion/lotes/${loteMerma.id}/mermas`, Zoo.ui.leerFormulario(formMerma));
      modalMerma.hide();
      Zoo.ui.toast('Merma registrada.', 'exito');
      crud.recargar();
    } catch (err) {
      Zoo.ui.error(err, formMerma);
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  });

  // ------------------------------------------------------------ Historial
  async function verHistorial(lote) {
    $('tituloHistorial').textContent = `Lote ${lote.numero_lote}: ${lote.alimento}`;
    $('infoHistorial').innerHTML = `
      <dl class="row small mb-2">
        <dt class="col-sm-3">Proveedor</dt><dd class="col-sm-9">${esc(lote.proveedor)}${lote.numero_factura ? ` · factura ${esc(lote.numero_factura)}` : ''}</dd>
        <dt class="col-sm-3">Recibido</dt><dd class="col-sm-9">${esc(A.cantidad(lote.cantidad_inicial, lote.unidad_medida))} el ${esc(Zoo.ui.fecha(lote.fecha_ingreso))} por ${esc(lote.registrado_por)}</dd>
        <dt class="col-sm-3">Usado o perdido</dt><dd class="col-sm-9">${esc(A.cantidad(lote.cantidad_usada, lote.unidad_medida))}</dd>
        ${lote.observaciones ? `<dt class="col-sm-3">Observaciones</dt><dd class="col-sm-9">${esc(lote.observaciones)}</dd>` : ''}
      </dl>`;
    $('tablaHistorial').innerHTML = '';
    bootstrap.Modal.getOrCreateInstance('#modalHistorial').show();
    try {
      A.movimientosHtml($('tablaHistorial'), await Zoo.api.get(`/api/alimentacion/lotes/${lote.id}/movimientos`), { mostrarLote: false });
    } catch (err) {
      Zoo.ui.error(err);
    }
  }

  // ---------------------------------------------------------------- Lista
  function disponible(l) {
    const porcentaje = Number(l.cantidad_inicial) ? (Number(l.cantidad_disponible) / Number(l.cantidad_inicial)) * 100 : 0;
    return `
      <div class="fw-semibold text-nowrap">${esc(A.cantidad(l.cantidad_disponible, l.unidad_medida))}
        <span class="small text-secondary fw-normal">de ${esc(A.cantidad(l.cantidad_inicial, l.unidad_medida))}</span></div>
      <div class="barra-porcentaje"><div class="barra"><span style="width:${porcentaje}%"></span></div></div>`;
  }

  const crud = Zoo.crud({
    url: '/api/alimentacion/lotes',
    nombre: 'entrada',
    femenino: true,
    puedeEditar: puedeGestionar,
    icono: 'bi-truck',
    vacio: 'No hay lotes con esos filtros.',
    acciones: { historial: verHistorial, merma: (l) => abrirMerma(l), baja: (l) => abrirMerma(l, { baja: true }) },
    alAbrir: (lote) => {
      opcionesFormulario(lote);
      const editando = Boolean(lote);
      $('tituloModal').textContent = editando ? `Corregir lote ${lote.numero_lote}` : 'Registrar entrada';
      $('avisoEdicion').classList.toggle('d-none', !editando);
      $('lAlimento').disabled = editando;
      $('lCantidad').disabled = editando;
      if (editando) {
        Zoo.ui.llenarFormulario(form, lote);
        $('lCantidad').value = lote.cantidad_inicial;
      } else {
        form.fecha_ingreso.value = Zoo.ui.hoy();
        const filtro = $('fAlimento').value || new URLSearchParams(location.search).get('alimento_id');
        if (filtro) $('lAlimento').value = filtro;
      }
      $('lIngreso').max = Zoo.ui.hoy();
      actualizarUnidad();
    },
    antesDeGuardar: (d) => ({ ...d, numero_lote: (d.numero_lote || '').toUpperCase() }),
    fila: (l, puede) => {
      const boton = (accion, icono, titulo, clase = '') =>
        `<button class="btn btn-sm btn-light" data-accion="${accion}" data-id="${l.id}" title="${titulo}"><i class="bi ${icono} ${clase}"></i><span class="visually-hidden">${titulo}</span></button>`;
      const conExistencia = Number(l.cantidad_disponible) > 0;
      const extra = [
        boton('historial', 'bi-clock-history', 'Ver historial'),
        puede && conExistencia && l.estado === 'vencido' ? boton('baja', 'bi-trash3', 'Dar de baja (vencido)', 'text-danger') : '',
        puede && conExistencia && l.estado !== 'vencido' ? boton('merma', 'bi-dash-circle', 'Registrar merma') : '',
      ].join(' ');
      return `
        <tr>
          <td class="text-nowrap"><div class="fw-semibold">${esc(l.numero_lote)}</div>
            <div class="small text-secondary">Ingresó ${esc(Zoo.ui.fecha(l.fecha_ingreso))}</div>
            ${l.numero_factura ? `<div class="small text-secondary">Factura ${esc(l.numero_factura)}</div>` : ''}</td>
          <td><div class="fw-semibold">${esc(l.alimento)}</div><div class="small text-secondary">${esc(l.proveedor)}</div></td>
          <td class="text-nowrap">${conExistencia ? A.vencimiento(l.fecha_vencimiento, l.dias_para_vencer) : esc(Zoo.ui.fecha(l.fecha_vencimiento) || '—')}</td>
          <td style="min-width: 10rem">${disponible(l)}</td>
          <td class="text-end text-nowrap">${l.costo_unitario !== null ? `${esc(Zoo.ui.moneda(l.costo_total))}<div class="small text-secondary">${esc(Zoo.ui.moneda(l.costo_unitario))} c/u</div>` : '<span class="text-secondary">—</span>'}</td>
          <td>${E.estado('estadoLote', l.estado)}</td>
          <td class="text-end text-nowrap">${Zoo.crud.botones(l, { editar: puede, estado: false, extra })}</td>
        </tr>`;
    },
  });
  await crud.recargar();

  if (puedeGestionar && new URLSearchParams(location.search).get('nueva') === '1') crud.abrir();
});
