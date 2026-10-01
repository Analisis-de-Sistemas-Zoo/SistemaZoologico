/**
 * Zoo.layout — Arma la estructura común de las páginas internas (/app).
 *
 * Cada página interna solo necesita:
 *   <body class="cargando">
 *     <main class="app-main" data-titulo="Dietas"> ...contenido... </main>
 *     <script src="/assets/js/core/layout.js" defer></script>
 *     <script src="/assets/js/modulos/alimentacion/dietas.js" defer></script>
 *   </body>
 *
 * layout.js valida la sesión, construye la barra lateral según el rol y la
 * barra superior, y luego ejecuta el código de la página:
 *
 *   Zoo.listo(({ usuario, permisos }) => {
 *     // aquí empieza el código de tu página
 *     if (Zoo.sesion.puede('alimentacion.dietas.editar')) { ... }
 *   });
 */
(function () {
  const Zoo = (window.Zoo = window.Zoo || {});
  const { esc } = Zoo.ui;

  const pendientes = [];
  let estado = null;

  Zoo.listo = (fn) => {
    if (estado) ejecutar(fn);
    else pendientes.push(fn);
  };

  Zoo.sesion = {
    get usuario() { return estado?.usuario || null; },
    get permisos() { return estado?.permisos || []; },
    puede: (permiso) => Boolean(estado?.permisos.includes(permiso)),
    puedeAlguno: (...permisos) => permisos.some((p) => estado?.permisos.includes(p)),
    cerrar: cerrarSesion,
  };

  function ejecutar(fn) {
    Promise.resolve()
      .then(() => fn(estado))
      .catch((err) => {
        console.error(err);
        Zoo.ui.error(err);
      });
  }

  function construirMenu(menu) {
    const actual = location.pathname;
    return menu
      .map(
        (seccion) => `
        <div class="app-nav-seccion">
          <div class="app-nav-titulo">${seccion.icono ? `<i class="bi ${esc(seccion.icono)}"></i>` : ''}${esc(seccion.titulo)}</div>
          ${seccion.items
            .map(
              (item) => `
            <a href="${esc(item.url)}" class="${item.url === actual ? 'activo' : ''}" ${item.url === actual ? 'aria-current="page"' : ''}>
              <i class="bi ${esc(item.icono || 'bi-dot')}"></i><span>${esc(item.texto)}</span>
            </a>`
            )
            .join('')}
        </div>`
      )
      .join('');
  }

  function construir() {
    const main = document.querySelector('main.app-main');
    if (!main) throw new Error('La página debe tener <main class="app-main">.');

    const { usuario, menu } = estado;
    const titulo = main.dataset.titulo || document.title;
    document.title = `${titulo} | Mirada Salvaje`;

    const shell = document.createElement('div');
    shell.className = 'app-shell';
    shell.innerHTML = `
      <aside class="app-lateral offcanvas-lg offcanvas-start" id="menuLateral" tabindex="-1" aria-label="Menú principal">
        <div class="d-flex align-items-start justify-content-between">
          <a class="app-marca" href="/app/dashboard.html">
            <img src="/assets/img/logo.svg" alt="">
            <span><strong>Mirada Salvaje</strong><small>Sistema de control</small></span>
          </a>
          <button type="button" class="btn-close btn-close-white d-lg-none m-3" data-bs-dismiss="offcanvas"
                  data-bs-target="#menuLateral" aria-label="Cerrar menú"></button>
        </div>
        <nav class="app-nav">${construirMenu(menu)}</nav>
      </aside>
      <div class="app-cuerpo">
        <header class="app-superior">
          <button class="btn btn-light d-lg-none" type="button" data-bs-toggle="offcanvas"
                  data-bs-target="#menuLateral" aria-controls="menuLateral" aria-label="Abrir menú">
            <i class="bi bi-list"></i>
          </button>
          <h1>${esc(titulo)}</h1>
          <div class="dropdown app-usuario">
            <button class="btn" type="button" data-bs-toggle="dropdown" aria-expanded="false">
              <span class="avatar" aria-hidden="true">${esc(Zoo.ui.iniciales(usuario.nombre))}</span>
              <span class="texto"><span class="nombre">${esc(usuario.nombre)}</span><span class="rol">${esc(usuario.rolNombre)}</span></span>
              <i class="bi bi-chevron-down small text-secondary"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><a class="dropdown-item" href="/app/perfil.html"><i class="bi bi-person me-2"></i>Mi perfil</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><button class="dropdown-item" type="button" data-cerrar-sesion><i class="bi bi-box-arrow-right me-2"></i>Cerrar sesión</button></li>
            </ul>
          </div>
        </header>
      </div>`;

    document.body.prepend(shell);
    shell.querySelector('.app-cuerpo').appendChild(main);
    shell.querySelector('[data-cerrar-sesion]').addEventListener('click', cerrarSesion);
  }

  async function cerrarSesion() {
    try {
      await Zoo.api.post('/api/auth/logout');
    } finally {
      location.href = '/login.html?salida=1';
    }
  }

  async function iniciar() {
    try {
      estado = await Zoo.api.get('/api/auth/yo');
    } catch (err) {
      if (err.estado !== 401) {
        document.body.classList.remove('cargando');
        document.body.innerHTML = `<div class="pagina-error"><div><div class="codigo">!</div>
          <p>${esc(err.message)}</p><a class="btn btn-primary" href="/login.html">Ir al inicio de sesión</a></div></div>`;
      }
      return;
    }
    construir();
    document.body.classList.remove('cargando');
    pendientes.splice(0).forEach(ejecutar);
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
