/**
 * Entradas — Lista de ventas: detalle, reimpresión de entradas y anulación.
 * Contrato: docs/api/entradas.md → GET /api/entradas/ventas, GET /:id, PATCH /:id/anular
 */
Zoo.listo(() => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const puedeAnular = Zoo.sesion.puede('entradas.ventas.anular');
  const modalBoletos = new bootstrap.Modal('#modalBoletos');

  Zoo.ui.opciones($('fCanal'), E.opciones('canal'), { vacio: 'Todos' });
  Zoo.ui.opciones($('fEstado'), E.opciones('estadoVenta'), { vacio: 'Todos' });
  const filtros = $('formFiltros');
  if (!new URLSearchParams(location.search).has('desde')) filtros.desde.value = Zoo.ui.hoy(-7);
  if (!new URLSearchParams(location.search).has('hasta')) filtros.hasta.value = Zoo.ui.hoy();

  function pintarTotales(ventas) {
    const pagadas = ventas.filter((v) => v.estado === 'pagada');
    const suma = (lista, campo) => lista.reduce((s, v) => s + Number(v[campo] || 0), 0);
    const dato = (valor, titulo, icono, color = '') => `
      <div class="resumen-item"><span class="icono ${color}"><i class="bi ${icono}"></i></span>
        <span><span class="valor">${esc(valor)}</span><span class="etiqueta">${titulo}</span></span></div>`;
    $('totales').innerHTML =
      dato(Zoo.ui.moneda(suma(pagadas, 'total')), 'Ingresos del periodo', 'bi-cash-stack') +
      dato(Zoo.ui.numero(suma(pagadas, 'cantidad_entradas')), 'Entradas vendidas', 'bi-ticket-perforated') +
      dato(Zoo.ui.numero(pagadas.filter((v) => v.canal === 'web').length), 'Compras en línea', 'bi-globe2', 'neutro') +
      dato(Zoo.ui.numero(ventas.length - pagadas.length), 'Anuladas', 'bi-x-circle', 'peligro');
  }

  async function verVenta(item) {
    $('tituloBoletos').textContent = `Venta ${item.codigo}`;
    $('infoBoletos').innerHTML = '<p class="text-secondary">Cargando...</p>';
    $('boletos').innerHTML = '';
    $('btnImprimir').classList.add('d-none');
    modalBoletos.show();
    try {
      const v = await Zoo.api.get(`/api/entradas/ventas/${item.id}`);
      $('infoBoletos').innerHTML = `
        <div class="row g-3 mb-3">
          <div class="col-md-6">
            <dl class="row small mb-0">
              <dt class="col-5">Estado</dt><dd class="col-7">${E.estado('estadoVenta', v.estado)}</dd>
              <dt class="col-5">Canal</dt><dd class="col-7">${E.estado('canal', v.canal)}</dd>
              <dt class="col-5">Fecha</dt><dd class="col-7">${esc(Zoo.ui.fechaHora(v.fecha))}</dd>
              <dt class="col-5">Visita</dt><dd class="col-7">${esc(Zoo.ui.fecha(v.fecha_visita))}</dd>
              <dt class="col-5">Pago</dt><dd class="col-7">${esc(E.texto('metodoPago', v.metodo_pago))}${v.referencia_pago ? ` <span class="text-secondary">(${esc(v.referencia_pago)})</span>` : ''}</dd>
              <dt class="col-5">Cliente</dt><dd class="col-7">${esc(v.cliente || 'Consumidor final')}${v.cliente_nit ? ` · NIT ${esc(v.cliente_nit)}` : ''}${v.cliente_correo ? `<div class="text-secondary">${esc(v.cliente_correo)}</div>` : ''}</dd>
              ${v.vendedor ? `<dt class="col-5">Vendió</dt><dd class="col-7">${esc(v.vendedor)}</dd>` : ''}
            </dl>
          </div>
          <div class="col-md-6">${Boletos.resumenHtml(v)}</div>
        </div>
        ${v.estado === 'anulada' ? `<div class="alert alert-danger small">Anulada el ${esc(Zoo.ui.fechaHora(v.fecha_anulacion))} por ${esc(v.anulado_por || '')}: ${esc(v.motivo_anulacion || '')}</div>` : ''}`;
      $('boletos').innerHTML = Boletos.boletosHtml(v);
      $('btnImprimir').classList.toggle('d-none', v.estado === 'anulada');
    } catch (err) {
      $('infoBoletos').innerHTML = err.pendiente ? Zoo.ui.pendienteHtml(err.message) : `<div class="text-danger">${esc(err.message)}</div>`;
    }
  }
  $('btnImprimir').addEventListener('click', () => Boletos.imprimir($('boletos')));

  async function anular(item) {
    const motivo = await Zoo.ui.pedirTexto({
      titulo: `Anular venta ${item.codigo}`,
      mensaje: `Se anularán sus ${item.cantidad_entradas} entradas y ya no podrán usarse. No se puede anular si alguna entrada ya ingresó.`,
      etiqueta: 'Motivo de la anulación',
      aceptar: 'Anular venta',
      peligro: true,
    });
    if (!motivo) return;
    try {
      await Zoo.api.patch(`/api/entradas/ventas/${item.id}/anular`, { motivo });
      Zoo.ui.toast(`Venta ${item.codigo} anulada.`, 'exito');
      crud.recargar();
    } catch (err) {
      Zoo.ui.error(err);
    }
  }

  const crud = Zoo.crud({
    url: '/api/entradas/ventas',
    nombre: 'venta',
    femenino: true,
    puedeEditar: false,
    icono: 'bi-receipt',
    vacio: 'No hay ventas con esos filtros.',
    acciones: { ver: verVenta, anular },
    alCargar: pintarTotales,
    fila: (v) => `
      <tr class="${v.estado === 'anulada' ? 'text-secondary' : ''}">
        <td class="fw-semibold text-nowrap">${esc(v.codigo)}</td>
        <td class="text-nowrap">${esc(Zoo.ui.fechaHora(v.fecha))}</td>
        <td class="text-nowrap">${esc(Zoo.ui.fecha(v.fecha_visita))}</td>
        <td>${E.estado('canal', v.canal)}</td>
        <td>${esc(v.cliente || 'Consumidor final')}${v.canal === 'taquilla' && v.vendedor ? `<div class="small text-secondary">Vendió ${esc(v.vendedor)}</div>` : ''}</td>
        <td class="text-end">${esc(Zoo.ui.numero(v.cantidad_entradas))}</td>
        <td class="text-end text-nowrap">${esc(Zoo.ui.moneda(v.total))}</td>
        <td>${E.estado('estadoVenta', v.estado)}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-light" data-accion="ver" data-id="${esc(v.id)}" title="Ver entradas"><i class="bi bi-qr-code"></i><span class="visually-hidden">Ver entradas</span></button>
          ${puedeAnular && v.estado === 'pagada' ? `<button class="btn btn-sm btn-light" data-accion="anular" data-id="${esc(v.id)}" title="Anular"><i class="bi bi-x-circle text-danger"></i><span class="visually-hidden">Anular</span></button>` : ''}
        </td>
      </tr>`,
  });
  crud.recargar();
});
