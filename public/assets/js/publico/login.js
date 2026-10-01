/**
 * Inicio de sesión del personal.
 */
(function () {
  Zoo.api.redirigirSiExpira = false;

  const parametros = new URLSearchParams(location.search);

  /** Solo se permite volver a páginas internas (evita redirecciones a otros sitios). */
  function destinoSeguro() {
    const next = parametros.get('next') || '';
    return /^\/app\/[\w\-/.]*$/.test(next) && !next.includes('..') ? next : '/app/dashboard.html';
  }

  function mostrarAviso() {
    const aviso = document.getElementById('avisoSesion');
    let texto = '';
    if (parametros.has('expirada')) texto = 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.';
    else if (parametros.has('salida')) texto = 'Cerraste sesión correctamente.';
    if (texto) {
      aviso.textContent = texto;
      aviso.classList.remove('d-none');
      if (parametros.has('salida')) aviso.classList.replace('alert-warning', 'alert-success');
    }
  }

  async function redirigirSiYaInicio() {
    try {
      await Zoo.api.get('/api/auth/yo');
      location.replace(destinoSeguro());
    } catch {
      /* sin sesión: se queda en el login */
    }
  }

  function alternarPassword() {
    const campo = document.getElementById('password');
    const boton = document.getElementById('verPassword');
    const visible = campo.type === 'text';
    campo.type = visible ? 'password' : 'text';
    boton.innerHTML = `<i class="bi ${visible ? 'bi-eye' : 'bi-eye-slash'}"></i>`;
    boton.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
  }

  async function enviar(evento) {
    evento.preventDefault();
    const form = evento.target;
    const boton = form.querySelector('[type="submit"]');
    Zoo.ui.limpiarErrores(form);

    const datos = { usuario: form.usuario.value.trim(), password: form.password.value };
    Zoo.ui.cargando(boton, true);
    try {
      await Zoo.api.post('/api/auth/login', datos);
      location.replace(destinoSeguro());
    } catch (err) {
      Zoo.ui.error(err, form);
      form.password.value = '';
      form.password.focus();
      Zoo.ui.cargando(boton, false);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    mostrarAviso();
    redirigirSiYaInicio();
    document.getElementById('verPassword').addEventListener('click', alternarPassword);
    document.getElementById('formLogin').addEventListener('submit', enviar);
  });
})();
