/**
 * Zoo.ui — Utilidades de interfaz compartidas por todas las páginas.
 *
 *   Zoo.ui.esc(texto)                       Escapa HTML (úsalo SIEMPRE al pintar datos)
 *   Zoo.ui.toast('Guardado', 'exito')       Notificación ('exito' | 'error' | 'aviso' | 'info')
 *   await Zoo.ui.confirmar('¿Eliminar?')    Diálogo de confirmación -> true/false
 *   Zoo.ui.error(err, formulario)           Muestra un error de la API (y marca los campos)
 *   Zoo.ui.leerFormulario(form)             Objeto con los valores del formulario
 *   Zoo.ui.llenarFormulario(form, datos)    Llena los campos por su atributo name
 *   Zoo.ui.limpiarErrores(form)
 *   Zoo.ui.cargando(boton, true|false)      Deshabilita el botón y muestra un spinner
 *   Zoo.ui.opciones(select, items, { valor, texto, vacio })
 *   Zoo.ui.tabla(tbody, filas, filaHtml, { columnas, vacio, icono })
 *   Zoo.ui.fecha('2026-10-01')  ->  01/10/2026
 *   Zoo.ui.fechaHora('2026-10-01 14:30:00')  ->  01/10/2026 14:30
 *   Zoo.ui.numero(1234.5, 2)  ->  1,234.50
 *   Zoo.ui.moneda(25)  ->  Q25.00
 *   Zoo.ui.hoy()  ->  '2026-10-01'
 */
(function () {
  const Zoo = (window.Zoo = window.Zoo || {});

  const MAPA_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (valor) => (valor == null ? '' : String(valor).replace(/[&<>"']/g, (c) => MAPA_ESCAPE[c]));

  // ------------------------------------------------------------ Notificaciones
  const ICONOS_TOAST = {
    exito: 'bi-check-circle-fill',
    error: 'bi-x-octagon-fill',
    aviso: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill',
  };

  function toast(mensaje, tipo = 'info', duracion = 4500) {
    let contenedor = document.querySelector('.zoo-toasts');
    if (!contenedor) {
      contenedor = document.createElement('div');
      contenedor.className = 'zoo-toasts';
      contenedor.setAttribute('aria-live', 'polite');
      document.body.appendChild(contenedor);
    }
    const nodo = document.createElement('div');
    nodo.className = `zoo-toast ${tipo}`;
    nodo.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    nodo.innerHTML = `<i class="bi ${ICONOS_TOAST[tipo] || ICONOS_TOAST.info}"></i><div>${esc(mensaje)}</div>`;
    contenedor.appendChild(nodo);
    setTimeout(() => nodo.remove(), duracion);
  }

  // --------------------------------------------------------------- Confirmar
  function confirmar(mensaje, { titulo = 'Confirmar acción', aceptar = 'Confirmar', peligro = false } = {}) {
    return new Promise((resolve) => {
      const nodo = document.createElement('div');
      nodo.className = 'modal fade';
      nodo.tabIndex = -1;
      nodo.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${esc(titulo)}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">${esc(mensaje)}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn ${peligro ? 'btn-danger' : 'btn-primary'}" data-aceptar>${esc(aceptar)}</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(nodo);
      const modal = new bootstrap.Modal(nodo);
      let respuesta = false;
      nodo.querySelector('[data-aceptar]').addEventListener('click', () => {
        respuesta = true;
        modal.hide();
      });
      nodo.addEventListener('hidden.bs.modal', () => {
        modal.dispose();
        nodo.remove();
        resolve(respuesta);
      });
      modal.show();
    });
  }

  // ------------------------------------------------------------ Formularios
  function limpiarErrores(form) {
    if (!form) return;
    form.querySelectorAll('.is-invalid').forEach((c) => c.classList.remove('is-invalid'));
    form.querySelectorAll('.invalid-feedback[data-auto]').forEach((n) => n.remove());
    form.querySelectorAll('[data-error-general]').forEach((n) => n.classList.add('d-none'));
  }

  /** Muestra un error de la API. Si trae errores por campo, los marca en el formulario. */
  function error(err, form) {
    const mensaje = err?.message || 'Ocurrió un error inesperado.';
    if (form && err?.errores?.length) {
      limpiarErrores(form);
      let primero = null;
      err.errores.forEach(({ campo, mensaje: texto }) => {
        const campoHtml = form.querySelector(`[name="${CSS.escape(campo)}"]`);
        if (!campoHtml) return;
        campoHtml.classList.add('is-invalid');
        const aviso = document.createElement('div');
        aviso.className = 'invalid-feedback';
        aviso.dataset.auto = '1';
        aviso.textContent = texto;
        (campoHtml.closest('.input-group') || campoHtml).insertAdjacentElement('afterend', aviso);
        primero = primero || campoHtml;
      });
      if (primero) primero.focus();
    }
    const general = form?.querySelector('[data-error-general]');
    if (general) {
      general.textContent = mensaje;
      general.classList.remove('d-none');
    } else {
      toast(mensaje, 'error');
    }
  }

  function leerFormulario(form) {
    const datos = {};
    form.querySelectorAll('[name]').forEach((campo) => {
      if (campo.disabled) return;
      if (campo.type === 'checkbox') datos[campo.name] = campo.checked;
      else if (campo.type === 'radio') { if (campo.checked) datos[campo.name] = campo.value; }
      else if (campo.type === 'number') datos[campo.name] = campo.value === '' ? null : Number(campo.value);
      else datos[campo.name] = campo.value.trim();
    });
    return datos;
  }

  function llenarFormulario(form, datos = {}) {
    form.querySelectorAll('[name]').forEach((campo) => {
      if (!(campo.name in datos)) return;
      const valor = datos[campo.name];
      if (campo.type === 'checkbox') campo.checked = Boolean(Number(valor)) || valor === true;
      else if (campo.type === 'radio') campo.checked = String(valor) === campo.value;
      else if (campo.type === 'date' && valor) campo.value = String(valor).slice(0, 10);
      else if (campo.type === 'time' && valor) campo.value = String(valor).slice(0, 5);
      else campo.value = valor ?? '';
    });
  }

  function cargando(boton, activo) {
    if (!boton) return;
    if (activo) {
      boton.dataset.textoOriginal = boton.innerHTML;
      boton.disabled = true;
      boton.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${esc(boton.textContent.trim())}`;
    } else {
      boton.disabled = false;
      if (boton.dataset.textoOriginal) boton.innerHTML = boton.dataset.textoOriginal;
    }
  }

  function opciones(select, items, { valor = 'id', texto = 'nombre', vacio = null, seleccionado } = {}) {
    const actual = seleccionado !== undefined ? seleccionado : select.value;
    const obtenerTexto = typeof texto === 'function' ? texto : (i) => i[texto];
    select.innerHTML =
      (vacio !== null ? `<option value="">${esc(vacio)}</option>` : '') +
      items.map((i) => `<option value="${esc(i[valor])}">${esc(obtenerTexto(i))}</option>`).join('');
    if (actual !== undefined && actual !== null) select.value = String(actual);
  }

  /** Pinta filas en un <tbody>. filaHtml recibe cada fila y devuelve el <tr>. */
  function tabla(tbody, filas, filaHtml, { columnas, vacio = 'No hay registros para mostrar.', icono = 'bi-inbox' } = {}) {
    if (!filas || filas.length === 0) {
      const total = columnas || tbody.closest('table')?.querySelectorAll('thead th').length || 1;
      tbody.innerHTML = `<tr><td colspan="${total}"><div class="tabla-vacia"><i class="bi ${icono}"></i>${esc(vacio)}</div></td></tr>`;
      return;
    }
    tbody.innerHTML = filas.map(filaHtml).join('');
  }

  // ---------------------------------------------------------------- Formatos
  function fecha(valor) {
    if (!valor) return '';
    const [a, m, d] = String(valor).slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  }

  function fechaHora(valor) {
    if (!valor) return '';
    const texto = String(valor);
    return `${fecha(texto)} ${texto.slice(11, 16)}`.trim();
  }

  function numero(valor, decimales = 0) {
    if (valor == null || valor === '') return '';
    return Number(valor).toLocaleString('es-GT', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  }

  function moneda(valor) {
    if (valor == null || valor === '') return '';
    return `Q${numero(valor, 2)}`;
  }

  function hoy(desplazamientoDias = 0) {
    const d = new Date();
    d.setDate(d.getDate() + desplazamientoDias);
    const dos = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  }

  function iniciales(nombre = '') {
    return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  Zoo.ui = {
    esc, toast, confirmar, error, limpiarErrores, leerFormulario, llenarFormulario,
    cargando, opciones, tabla, fecha, fechaHora, numero, moneda, hoy, iniciales,
  };
})();
