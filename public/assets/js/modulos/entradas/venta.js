/**
 * Entradas — Venta en taquilla (punto de venta).
 * Contrato: docs/api/entradas.md → POST /api/entradas/cotizar y POST /api/entradas/ventas
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const $ = (id) => document.getElementById(id);
  const form = $('formCobro');
  const modalBoletos = new bootstrap.Modal('#modalBoletos');

  const estado = { tipos: [], cantidades: {}, cupon: '', cotizacion: null };

  // ------------------------------------------------------------- Entradas
  function pintarTipos() {
    $('listaTipos').innerHTML = estado.tipos.length
      ? estado.tipos.map((t) => {
        const n = estado.cantidades[t.id] || 0;
        return `
        <div class="opcion-entrada">
          <div>
            <div class="nombre">${esc(t.nombre)}</div>
            <div class="small text-secondary">${esc(t.descripcion || '')}</div>
          </div>
          <div class="d-flex align-items-center gap-3">
            <span class="precio">${esc(Zoo.ui.moneda(t.precio))}</span>
            <div class="contador" role="group" aria-label="Cantidad ${esc(t.nombre)}">
              <button type="button" data-tipo="${t.id}" data-cambio="-1" aria-label="Quitar una" ${n ? '' : 'disabled'}><i class="bi bi-dash-lg"></i></button>
              <output aria-live="polite">${n}</output>
              <button type="button" data-tipo="${t.id}" data-cambio="1" aria-label="Agregar una" ${n >= 50 ? 'disabled' : ''}><i class="bi bi-plus-lg"></i></button>
            </div>
          </div>
        </div>`;
      }).join('')
      : '<p class="text-secondary">No hay tipos de entrada activos.</p>';
  }

  $('listaTipos').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-tipo]');
    if (!boton) return;
    const id = boton.dataset.tipo;
    estado.cantidades[id] = Math.max(0, Math.min(50, (estado.cantidades[id] || 0) + Number(boton.dataset.cambio)));
    pintarTipos();
    cotizar();
  });

  const items = () =>
    Object.entries(estado.cantidades).filter(([, n]) => n > 0).map(([id, n]) => ({ tipo_entrada_id: Number(id), cantidad: n }));

  function validarFecha() {
    const campo = $('fechaVisita');
    let error = '';
    if (!campo.value) error = 'Elige la fecha de visita.';
    else if (campo.value < Zoo.ui.hoy()) error = 'La fecha ya pasó.';
    else if (!Boletos.abreEse(campo.value)) error = 'Los lunes el zoológico está cerrado.';
    campo.classList.toggle('is-invalid', Boolean(error));
    $('errorFecha').textContent = error;
    return !error;
  }
  $('fechaVisita').min = Zoo.ui.hoy();
  $('fechaVisita').addEventListener('change', () => cotizar());
  $('btnCupon').addEventListener('click', () => { estado.cupon = $('cupon').value.trim().toUpperCase(); cotizar(); });
  $('cupon').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('btnCupon').click(); } });

  // ------------------------------------------------------------ Cotización
  let espera;
  function cotizar() {
    clearTimeout(espera);
    estado.cotizacion = null;
    actualizarCobro();
    espera = setTimeout(async () => {
      if (!validarFecha() || !items().length) {
        $('resumen').innerHTML = '<p class="text-secondary mb-0">Agrega entradas para ver el total.</p>';
        return;
      }
      try {
        estado.cotizacion = await Zoo.api.post('/api/entradas/cotizar', {
          fecha_visita: $('fechaVisita').value,
          items: items(),
          codigo_promocion: estado.cupon || undefined,
        });
        $('resumen').innerHTML = Boletos.resumenHtml(estado.cotizacion);
        const cupon = estado.cotizacion.cupon;
        $('mensajeCupon').innerHTML = cupon ? `<span class="${cupon.valido ? 'text-success' : 'text-danger'}">${esc(cupon.mensaje)}</span>` : '';
      } catch (err) {
        $('resumen').innerHTML = err.pendiente ? Zoo.ui.pendienteHtml(err.message) : `<div class="text-danger">${esc(err.message)}</div>`;
      }
      actualizarCobro();
    }, 200);
  }

  // ----------------------------------------------------------------- Cobro
  const efectivo = () => form.metodo_pago.value === 'efectivo';

  function actualizarCobro() {
    const total = Number(estado.cotizacion?.total || 0);
    $('grupoEfectivo').classList.toggle('d-none', !efectivo());
    const recibido = Number($('recibido').value || 0);
    const cambio = recibido - total;
    $('cambio').textContent = Zoo.ui.moneda(Math.max(cambio, 0));
    $('cambio').classList.toggle('text-danger', efectivo() && recibido > 0 && cambio < 0);
    const falta = efectivo() && $('recibido').value !== '' && cambio < 0;
    $('btnCobrar').disabled = !estado.cotizacion || falta;
    $('btnCobrar').textContent = estado.cotizacion ? `Cobrar ${Zoo.ui.moneda(total)}` : 'Cobrar';
  }
  form.addEventListener('input', actualizarCobro);
  form.addEventListener('change', actualizarCobro);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!estado.cotizacion) return;
    Zoo.ui.limpiarErrores(form);
    const boton = $('btnCobrar');
    Zoo.ui.cargando(boton, true);
    try {
      const venta = await Zoo.api.post('/api/entradas/ventas', {
        fecha_visita: $('fechaVisita').value,
        items: items(),
        codigo_promocion: estado.cupon || undefined,
        metodo_pago: form.metodo_pago.value,
        cliente: { nombre: $('cNombre').value.trim(), nit: $('cNit').value.trim().toUpperCase() },
      });
      Zoo.ui.toast(`Venta ${venta.codigo} registrada.`, 'exito');
      mostrarBoletos(venta);
      limpiar();
    } catch (err) {
      const propios = (err.errores || []).map((x) => ({ ...x, campo: x.campo.replace(/^cliente\./, '') }));
      Zoo.ui.error({ ...err, message: err.message, pendiente: err.pendiente, errores: propios }, form);
      if (propios.some((x) => ['nombre', 'nit'].includes(x.campo))) form.querySelector('details').open = true;
    } finally {
      Zoo.ui.cargando(boton, false);
      actualizarCobro();
    }
  });

  function mostrarBoletos(venta) {
    const recibido = Number($('recibido').value || 0);
    const cambio = venta.metodo_pago === 'efectivo' && recibido ? recibido - Number(venta.total) : null;
    $('tituloBoletos').textContent = `Venta ${venta.codigo}`;
    $('infoBoletos').innerHTML = `
      <div class="d-flex flex-wrap justify-content-between gap-2 mb-3">
        <div>Total <strong>${esc(Zoo.ui.moneda(venta.total))}</strong> · ${esc(Zoo.etiquetas.texto('metodoPago', venta.metodo_pago))}</div>
        ${cambio !== null ? `<div class="fs-5">Cambio: <strong>${esc(Zoo.ui.moneda(cambio))}</strong></div>` : ''}
      </div>`;
    $('boletos').innerHTML = Boletos.boletosHtml(venta);
    modalBoletos.show();
  }
  $('btnImprimir').addEventListener('click', () => Boletos.imprimir($('boletos')));

  function limpiar() {
    estado.cantidades = {};
    estado.cupon = '';
    $('cupon').value = '';
    $('mensajeCupon').innerHTML = '';
    $('recibido').value = '';
    $('cNombre').value = '';
    $('cNit').value = '';
    form.metodo_pago.value = 'efectivo';
    $('fechaVisita').value = Zoo.ui.hoy();
    pintarTipos();
    cotizar();
  }
  $('btnLimpiar').addEventListener('click', limpiar);

  // ---------------------------------------------------------------- Inicio
  $('fechaVisita').value = Zoo.ui.hoy();
  try {
    estado.tipos = await Zoo.api.get('/api/entradas/tipos', { activo: 1 });
  } catch (err) {
    Zoo.ui.error(err);
  }
  pintarTipos();
  validarFecha();
  actualizarCobro();
});
