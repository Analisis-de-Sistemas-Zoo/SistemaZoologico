/**
 * Portal — Compra de entradas en línea (sin cuenta).
 * Pasos: 1 entradas y fecha → 2 datos del comprador → 3 pago simulado → 4 confirmación con QR.
 * Contrato: docs/api/entradas.md → Portal público
 */
(function () {
  Zoo.api.redirigirSiExpira = false;
  const { esc } = Zoo.ui;
  const $ = (id) => document.getElementById(id);

  const estado = { paso: 1, tipos: [], cantidades: {}, cupon: '', cotizacion: null, cotizando: false };
  const API = '/api/publico/entradas';

  // ------------------------------------------------------------ Paso 1
  function pintarTipos() {
    $('listaTipos').innerHTML = estado.tipos.length
      ? estado.tipos.map((t) => `
        <div class="opcion-entrada">
          <div>
            <div class="nombre">${esc(t.nombre)}</div>
            <div class="small text-secondary">${esc(t.descripcion || '')}</div>
          </div>
          <div class="d-flex align-items-center gap-3">
            <span class="precio">${esc(Zoo.ui.moneda(t.precio))}</span>
            <div class="contador" role="group" aria-label="Cantidad de entradas ${esc(t.nombre)}">
              <button type="button" data-tipo="${t.id}" data-cambio="-1" aria-label="Quitar una" ${!estado.cantidades[t.id] ? 'disabled' : ''}><i class="bi bi-dash-lg"></i></button>
              <output aria-live="polite">${estado.cantidades[t.id] || 0}</output>
              <button type="button" data-tipo="${t.id}" data-cambio="1" aria-label="Agregar una" ${(estado.cantidades[t.id] || 0) >= 20 ? 'disabled' : ''}><i class="bi bi-plus-lg"></i></button>
            </div>
          </div>
        </div>`).join('')
      : '<p class="text-secondary">No hay entradas a la venta en este momento.</p>';
  }

  $('listaTipos').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-tipo]');
    if (!boton) return;
    const id = boton.dataset.tipo;
    estado.cantidades[id] = Math.max(0, Math.min(20, (estado.cantidades[id] || 0) + Number(boton.dataset.cambio)));
    pintarTipos();
    cotizar();
  });

  const items = () =>
    Object.entries(estado.cantidades).filter(([, n]) => n > 0).map(([id, n]) => ({ tipo_entrada_id: Number(id), cantidad: n }));

  function validarFecha() {
    const campo = $('fechaVisita');
    let error = '';
    if (!campo.value) error = 'Elige la fecha de tu visita.';
    else if (campo.value < Zoo.ui.hoy()) error = 'La fecha ya pasó.';
    else if (campo.value > campo.max) error = 'Solo vendemos entradas para los próximos 60 días.';
    else if (!Boletos.abreEse(campo.value)) error = 'Los lunes el zoológico está cerrado. Elige otro día.';
    campo.classList.toggle('is-invalid', Boolean(error) && Boolean(campo.value));
    $('errorFecha').textContent = error;
    $('resumenFecha').textContent = !error ? `Visita el ${Boletos.fechaLarga(campo.value)}` : 'Elige la fecha de visita.';
    return !error;
  }

  $('fechaVisita').min = Zoo.ui.hoy();
  $('fechaVisita').max = Zoo.ui.hoy(60);
  $('fechaVisita').addEventListener('change', () => { validarFecha(); cotizar(); });

  $('btnCupon').addEventListener('click', () => {
    estado.cupon = $('cupon').value.trim().toUpperCase();
    cotizar();
  });

  // --------------------------------------------------------- Cotización
  let espera;
  function cotizar() {
    clearTimeout(espera);
    espera = setTimeout(async () => {
      estado.cotizacion = null;
      actualizarBoton();
      if (!items().length || !validarFecha()) {
        $('resumen').innerHTML = '<p class="text-secondary mb-0">Elige la fecha y las entradas para ver el total.</p>';
        return;
      }
      try {
        estado.cotizando = true;
        estado.cotizacion = await Zoo.api.post(`${API}/cotizar`, {
          fecha_visita: $('fechaVisita').value,
          items: items(),
          codigo_promocion: estado.cupon || undefined,
        });
        $('resumen').innerHTML = Boletos.resumenHtml(estado.cotizacion);
        const cupon = estado.cotizacion.cupon;
        $('mensajeCupon').innerHTML = cupon
          ? `<span class="${cupon.valido ? 'text-success' : 'text-danger'}">${esc(cupon.mensaje)}</span>` : '';
      } catch (err) {
        $('resumen').innerHTML = err.pendiente ? Zoo.ui.pendienteHtml(err.message) : `<div class="text-danger">${esc(err.message)}</div>`;
      } finally {
        estado.cotizando = false;
        actualizarBoton();
      }
    }, 250);
  }

  // ------------------------------------------------------------- Pasos
  function irA(paso) {
    estado.paso = paso;
    document.querySelectorAll('[data-paso]').forEach((s) => s.classList.toggle('d-none', Number(s.dataset.paso) !== paso));
    document.querySelectorAll('#pasos li').forEach((li, i) => {
      li.classList.toggle('activo', i + 1 === paso);
      li.classList.toggle('hecho', i + 1 < paso);
    });
    $('btnAtras').classList.toggle('d-none', paso === 1);
    actualizarBoton();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelector(`[data-paso="${paso}"] input`)?.focus({ preventScroll: true });
  }

  function actualizarBoton() {
    const boton = $('btnSiguiente');
    const total = estado.cotizacion ? Zoo.ui.moneda(estado.cotizacion.total) : '';
    boton.textContent = estado.paso === 3 ? `Pagar ${total}` : estado.paso === 2 ? 'Continuar al pago' : 'Continuar';
    boton.disabled = !estado.cotizacion || estado.cotizando;
  }

  $('btnAtras').addEventListener('click', () => irA(estado.paso - 1));

  $('btnSiguiente').addEventListener('click', () => {
    if (estado.paso === 1) return irA(2);
    if (estado.paso === 2) {
      const form = $('formDatos');
      Zoo.ui.limpiarErrores(form);
      if (!form.checkValidity()) {
        form.querySelectorAll(':invalid').forEach((c) => c.classList.add('is-invalid'));
        form.querySelector(':invalid')?.focus();
        return;
      }
      return irA(3);
    }
    return pagar();
  });

  // ------------------------------------------------------------- Pago
  $('pNumero').addEventListener('input', (e) => {
    const digitos = e.target.value.replace(/\D/g, '').slice(0, 19);
    e.target.value = digitos.replace(/(\d{4})(?=\d)/g, '$1 ');
  });
  $('pVence').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  });
  $('pCvv').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });

  /** Reparte los errores del servidor ("cliente.correo", "pago.numero") en su paso. */
  function mostrarErrores(err) {
    const porPaso = { cliente: ['formDatos', 2], pago: ['formPago', 3] };
    let paso = null;
    for (const [prefijo, [formId, numero]] of Object.entries(porPaso)) {
      const propios = (err.errores || []).filter((e) => e.campo.startsWith(`${prefijo}.`))
        .map((e) => ({ ...e, campo: e.campo.slice(prefijo.length + 1) }));
      if (propios.length) {
        paso = paso ?? numero;
        Zoo.ui.error({ message: err.message, errores: propios }, $(formId));
      }
    }
    if (paso) irA(paso);
    else if (err.estado === 422) { irA(1); Zoo.ui.toast(err.message, 'error'); }
    else Zoo.ui.error(err, $('formPago'));
  }

  async function pagar() {
    const boton = $('btnSiguiente');
    Zoo.ui.limpiarErrores($('formDatos'));
    Zoo.ui.limpiarErrores($('formPago'));
    Zoo.ui.cargando(boton, true);
    try {
      const venta = await Zoo.api.post(`${API}/compras`, {
        fecha_visita: $('fechaVisita').value,
        items: items(),
        codigo_promocion: estado.cupon || undefined,
        cliente: Zoo.ui.leerFormulario($('formDatos')),
        pago: Zoo.ui.leerFormulario($('formPago')),
      });
      mostrarConfirmacion(venta);
    } catch (err) {
      Zoo.ui.cargando(boton, false);
      actualizarBoton();
      mostrarErrores(err);
    }
  }

  function mostrarConfirmacion(venta) {
    $('flujo').classList.add('d-none');
    document.querySelectorAll('#pasos li').forEach((li) => { li.classList.remove('activo'); li.classList.add('hecho'); });
    $('textoConfirmacion').innerHTML = `
      Tu número de compra es <strong>${esc(venta.codigo)}</strong>. Pagaste <strong>${esc(Zoo.ui.moneda(venta.total))}</strong>
      por ${venta.entradas.length} ${venta.entradas.length === 1 ? 'entrada' : 'entradas'} para el ${esc(Boletos.fechaLarga(venta.fecha_visita))}.
      Muestra cada código QR en la puerta. También puedes verlas en <a href="/entradas/mis-entradas.html?codigo=${encodeURIComponent(venta.codigo)}&correo=${encodeURIComponent($('dCorreo').value.trim())}">Mis entradas</a> con tu número de compra y tu correo.`;
    $('boletos').innerHTML = Boletos.boletosHtml(venta);
    $('confirmacion').classList.remove('d-none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('btnImprimir').addEventListener('click', () => Boletos.imprimir($('boletos')));

  // ------------------------------------------------------------- Inicio
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      estado.tipos = await Zoo.api.get(`${API}/tipos`);
    } catch (err) {
      Zoo.ui.error(err);
    }
    // Primer día abierto a partir de mañana como sugerencia.
    let dias = 1;
    while (!Boletos.abreEse(Zoo.ui.hoy(dias))) dias += 1;
    $('fechaVisita').value = Zoo.ui.hoy(dias);
    validarFecha();
    pintarTipos();
  });
})();
