/**
 * Entradas — Validar ingreso con el código QR.
 * Pensado para un lector USB: el lector "escribe" el código y presiona Enter.
 * Contrato: docs/api/entradas.md → POST /api/entradas/validar y GET /api/entradas/ingresos/hoy
 */
Zoo.listo(() => {
  const { esc } = Zoo.ui;
  const $ = (id) => document.getElementById(id);
  const form = $('formValidar');
  const campo = $('codigoQr');

  const RESULTADOS = {
    valida: { clase: 'valida', icono: 'bi-check-circle-fill', titulo: 'Puede ingresar' },
    usada: { clase: 'rechazada', icono: 'bi-x-octagon-fill', titulo: 'Entrada ya utilizada' },
    anulada: { clase: 'rechazada', icono: 'bi-x-octagon-fill', titulo: 'Entrada anulada' },
    otra_fecha: { clase: 'advertencia', icono: 'bi-calendar-x-fill', titulo: 'No es para hoy' },
    no_existe: { clase: 'rechazada', icono: 'bi-question-octagon-fill', titulo: 'Código no encontrado' },
    formato: { clase: 'rechazada', icono: 'bi-upc-scan', titulo: 'Código no válido' },
  };

  function pintarResultado(r) {
    const v = RESULTADOS[r.resultado] || RESULTADOS.no_existe;
    const e = r.entrada;
    $('resultado').innerHTML = `
      <div class="resultado-validacion ${v.clase}" role="status">
        <i class="bi ${v.icono}" aria-hidden="true"></i>
        <div>
          <h3>${v.titulo}</h3>
          <div>${esc(r.mensaje || '')}</div>
          ${e ? `<div class="small mt-1 opacity-75">${esc(e.tipo_entrada)} · Compra ${esc(e.compra_codigo)} · Visita ${esc(Zoo.ui.fecha(e.fecha_visita))}${e.fecha_uso && r.resultado !== 'valida' ? ` · Usada ${esc(Zoo.ui.fechaHora(e.fecha_uso))}` : ''}</div>` : ''}
        </div>
      </div>`;
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    Zoo.ui.limpiarErrores(form);
    const codigo = campo.value.trim().toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(codigo)) {
      pintarResultado({ resultado: 'formato', mensaje: 'El código no tiene el formato de una entrada del zoológico.' });
      campo.select();
      return;
    }
    try {
      pintarResultado(await Zoo.api.post('/api/entradas/validar', { codigo_qr: codigo }));
      cargarHoy();
    } catch (err) {
      $('resultado').innerHTML = err.pendiente ? Zoo.ui.pendienteHtml(err.message) : '';
      if (!err.pendiente) Zoo.ui.error(err, form);
    } finally {
      campo.value = '';
      campo.focus();
    }
  });

  async function cargarHoy() {
    try {
      const h = await Zoo.api.get('/api/entradas/ingresos/hoy');
      const dato = (valor, titulo, icono, color = '') => `
        <div class="resumen-item"><span class="icono ${color}"><i class="bi ${icono}"></i></span>
          <span><span class="valor">${esc(Zoo.ui.numero(valor))}</span><span class="etiqueta">${titulo}</span></span></div>`;
      $('resumenHoy').innerHTML =
        dato(h.ingresados, 'Ingresaron', 'bi-person-check') +
        dato(h.pendientes, 'Por ingresar', 'bi-hourglass-split', 'alerta') +
        dato(h.entradas_del_dia, 'Entradas para hoy', 'bi-ticket-perforated', 'neutro');
      $('ultimos').innerHTML = h.ultimos.length
        ? h.ultimos.map((u) => `
          <li><span><strong>${esc(u.tipo_entrada)}</strong> <span class="text-secondary">· ${esc(u.compra_codigo)}</span></span>
            <span class="text-secondary text-nowrap">${esc(Zoo.ui.hora(String(u.fecha_uso).slice(11)))}</span></li>`).join('')
        : '<li class="text-secondary">Todavía no ingresa nadie hoy.</li>';
    } catch (err) {
      if (err.pendiente) {
        $('resumenHoy').innerHTML = '';
        $('ultimos').innerHTML = `<li>${Zoo.ui.pendienteHtml(err.message)}</li>`;
      } else Zoo.ui.error(err);
    }
  }

  cargarHoy();
  campo.focus();
});
