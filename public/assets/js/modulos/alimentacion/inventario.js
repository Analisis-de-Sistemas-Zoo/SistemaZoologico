/**
 * Alimentación — Inventario de alimentos.
 * Existencia calculada desde los lotes, alertas de mínimo y vencimiento, catálogo e historial.
 */
Zoo.listo(() => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const A = window.Alimentacion;
  const puedeGestionar = Zoo.sesion.puede('alimentacion.inventario.gestionar');

  Zoo.ui.opciones($('fCategoria'), E.opciones('categoriaAlimento'), { vacio: 'Todas' });
  Zoo.ui.opciones($('fAlerta'), E.opciones('alertaAlimento'), { vacio: 'Sin filtro' });
  Zoo.ui.opciones($('aCategoria'), E.opciones('categoriaAlimento'), { vacio: 'Selecciona' });
  Zoo.ui.opciones($('aUnidad'), E.opciones('unidadAlimento'));
  if (!puedeGestionar) $('btnEntrada').remove();

  // ------------------------------------------------------------ Alertas
  async function cargarAlertas() {
    try {
      const a = await Zoo.api.get('/api/alimentacion/alimentos/alertas');
      const tarjeta = (valor, titulo, detalle, icono, color, filtro) => `
        <a class="resumen-item" href="${filtro}">
          <span class="icono ${valor ? color : ''}"><i class="bi ${icono}"></i></span>
          <span><span class="valor">${valor}</span><span class="etiqueta">${titulo}</span>
            ${detalle ? `<span class="d-block small text-secondary mt-1">${detalle}</span>` : ''}</span>
        </a>`;
      const nombres = (lista, campo) => lista.slice(0, 3).map((x) => esc(x[campo])).join(', ') + (lista.length > 3 ? '…' : '');
      $('alertas').innerHTML =
        tarjeta(a.bajo_minimo.length, 'Bajo el mínimo', nombres(a.bajo_minimo, 'nombre'), 'bi-box-seam', 'alerta', '?alerta=bajo_minimo') +
        tarjeta(a.por_vencer.length, 'Lotes por vencer', nombres(a.por_vencer, 'alimento'), 'bi-hourglass-split', 'alerta', '/app/alimentacion/lotes.html?estado=por_vencer') +
        tarjeta(a.vencidos.length, 'Lotes vencidos con existencia', nombres(a.vencidos, 'alimento'), 'bi-exclamation-octagon', 'peligro', '/app/alimentacion/lotes.html?estado=vencido');
    } catch (err) {
      Zoo.ui.error(err);
    }
  }

  // ------------------------------------------------------------- Nivel
  function nivel(a) {
    const minimo = Number(a.stock_minimo);
    const existencia = Number(a.existencia);
    const porcentaje = minimo > 0 ? Math.min(100, (existencia / (minimo * 2)) * 100) : (existencia > 0 ? 100 : 0);
    const consumo = Number(a.consumo_diario);
    const alcanza = consumo > 0 ? Math.floor(existencia / consumo) : null;
    return `
      <div class="barra-porcentaje" title="${esc(Zoo.ui.numero(porcentaje, 0))} % de dos veces el mínimo">
        <div class="barra"><span class="${Number(a.bajo_minimo) ? 'bajo' : ''}" style="width:${porcentaje}%"></span></div>
      </div>
      <div class="small text-secondary">${existencia <= 0 ? ''
        : alcanza === null ? 'Sin consumo reciente'
        : alcanza > 60 ? 'Alcanza para más de 2 meses'
        : `Alcanza para ~${alcanza} ${alcanza === 1 ? 'día' : 'días'}`}</div>`;
  }

  function estado(a) {
    if (!Number(a.activo)) return `<div class="mb-1">${E.estado('activo', 0)}</div>`;
    if (Number(a.existencia) <= 0) return '<div class="mb-1"><span class="estado estado-peligro">Agotado</span></div>';
    if (Number(a.bajo_minimo)) return '<div class="mb-1"><span class="estado estado-alerta">Bajo el mínimo</span></div>';
    return '';
  }

  // ----------------------------------------------------------- Historial
  async function verHistorial(a) {
    $('tituloHistorial').textContent = `Historial: ${a.nombre}`;
    $('infoHistorial').innerHTML = `<p class="text-secondary small">Entradas, consumos por ración y mermas de todos sus lotes (últimos 300 movimientos).</p>`;
    $('tablaHistorial').innerHTML = '';
    bootstrap.Modal.getOrCreateInstance('#modalHistorial').show();
    try {
      A.movimientosHtml($('tablaHistorial'), await Zoo.api.get(`/api/alimentacion/alimentos/${a.id}/movimientos`));
    } catch (err) {
      Zoo.ui.error(err);
    }
  }

  // -------------------------------------------------------------- Lista
  const crud = Zoo.crud({
    url: '/api/alimentacion/alimentos',
    nombre: 'alimento',
    puedeEditar: puedeGestionar,
    icono: 'bi-box-seam',
    acciones: { historial: verHistorial },
    alCargar: cargarAlertas,
    alAbrir: (a) => {
      $('avisoUnidad').classList.toggle('d-none', !a);
    },
    fila: (a, puede) => {
      const boton = (accion, icono, titulo) =>
        `<button class="btn btn-sm btn-light" data-accion="${accion}" data-id="${a.id}" title="${titulo}"><i class="bi ${icono}"></i><span class="visually-hidden">${titulo}</span></button>`;
      const enlace = (url, icono, titulo) =>
        `<a class="btn btn-sm btn-light" href="${url}" title="${titulo}"><i class="bi ${icono}"></i><span class="visually-hidden">${titulo}</span></a>`;
      const extra = [
        puede && Number(a.activo) ? enlace(`/app/alimentacion/lotes.html?nueva=1&alimento_id=${a.id}`, 'bi-plus-circle', 'Registrar entrada') : '',
        enlace(`/app/alimentacion/lotes.html?alimento_id=${a.id}`, 'bi-stack', 'Ver lotes'),
        boton('historial', 'bi-clock-history', 'Ver historial'),
      ].join(' ');
      const vencida = Number(a.existencia_vencida) > 0
        ? `<div class="small text-danger">+${esc(A.cantidad(a.existencia_vencida, a.unidad_medida))} vencido</div>` : '';
      return `
        <tr>
          <td><div class="fw-semibold">${esc(a.nombre)}</div>${a.descripcion ? `<div class="small text-secondary">${esc(a.descripcion)}</div>` : ''}</td>
          <td>${esc(E.texto('categoriaAlimento', a.categoria))}</td>
          <td class="text-end text-nowrap"><span class="fw-semibold">${esc(A.cantidad(a.existencia, a.unidad_medida))}</span>
            <div class="small text-secondary">mín. ${esc(A.cantidad(a.stock_minimo, a.unidad_medida))}</div>${vencida}</td>
          <td>${estado(a)}${nivel(a)}</td>
          <td class="text-nowrap">${a.proximo_vencimiento ? A.vencimiento(a.proximo_vencimiento, a.dias_para_vencer) : '<span class="text-secondary">—</span>'}
            ${Number(a.por_vencer) ? '<div><span class="estado estado-alerta">Por vencer</span></div>' : ''}</td>
          <td class="text-end text-nowrap">${Zoo.crud.botones(a, { editar: puede, estado: puede, extra })}</td>
        </tr>`;
    },
  });
  crud.recargar();
});
