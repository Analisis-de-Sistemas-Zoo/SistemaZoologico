/**
 * Portal — Mis entradas: el visitante vuelve a ver sus entradas con número de compra + correo.
 * Contrato: docs/api/entradas.md → GET /api/publico/entradas/compras/consulta
 */
(function () {
  Zoo.api.redirigirSiExpira = false;
  const { esc } = Zoo.ui;
  const $ = (id) => document.getElementById(id);
  const form = $('formConsulta');
  const resultado = $('resultado');

  function pintar(venta) {
    const vigentes = venta.entradas.filter((e) => e.estado === 'vigente').length;
    resultado.innerHTML = `
      <div class="panel panel-cuerpo mb-3">
        <div class="d-flex flex-wrap justify-content-between gap-3 align-items-start">
          <div>
            <h2 class="h4 mb-1">Compra ${esc(venta.codigo)} ${Zoo.etiquetas.estado('estadoVenta', venta.estado)}</h2>
            <div class="text-secondary">Visita el ${esc(Boletos.fechaLarga(venta.fecha_visita))} · ${esc(venta.cliente || '')}</div>
            <div class="small text-secondary">${vigentes} de ${venta.entradas.length} ${venta.entradas.length === 1 ? 'entrada vigente' : 'entradas vigentes'}</div>
          </div>
          <button class="btn btn-primary" type="button" id="btnImprimir"><i class="bi bi-printer me-2"></i>Imprimir o guardar en PDF</button>
        </div>
        ${venta.estado === 'anulada' ? `<div class="alert alert-danger mt-3 mb-0">Esta compra fue anulada${venta.motivo_anulacion ? `: ${esc(venta.motivo_anulacion)}` : ''}. Las entradas ya no son válidas.</div>` : ''}
        <div class="mt-3" style="max-width: 28rem">${Boletos.resumenHtml(venta)}</div>
      </div>
      <div id="boletos">${Boletos.boletosHtml(venta)}</div>`;
    $('btnImprimir').addEventListener('click', () => Boletos.imprimir($('boletos')));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    Zoo.ui.limpiarErrores(form);
    const boton = form.querySelector('[type="submit"]');
    const datos = Zoo.ui.leerFormulario(form);
    datos.codigo = datos.codigo.toUpperCase();
    Zoo.ui.cargando(boton, true);
    resultado.innerHTML = '';
    try {
      pintar(await Zoo.api.get('/api/publico/entradas/compras/consulta', datos));
    } catch (err) {
      if (err.pendiente) resultado.innerHTML = Zoo.ui.pendienteHtml(err.message);
      else Zoo.ui.error(err, form);
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const p = new URLSearchParams(location.search);
    if (p.get('codigo')) $('cCodigo').value = p.get('codigo');
    if (p.get('correo')) $('cCorreo').value = p.get('correo');
  });
})();
