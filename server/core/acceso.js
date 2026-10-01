/**
 * Control de acceso: une los permisos del núcleo con los de cada módulo y
 * responde preguntas como "¿este rol puede hacer X?" o "¿qué menú ve este rol?".
 */
const { PERMISOS_NUCLEO, MENU_NUCLEO, PAGINAS_NUCLEO } = require('../config/permisos');

const permisos = { ...PERMISOS_NUCLEO };
const menu = [...MENU_NUCLEO];
const paginas = { ...PAGINAS_NUCLEO };

/** Agrega los permisos, el menú y las páginas de un módulo. */
function registrarAcceso(modulo) {
  for (const [permiso, roles] of Object.entries(modulo.permisos || {})) {
    if (permisos[permiso]) {
      throw new Error(`[acceso] El permiso "${permiso}" del módulo "${modulo.clave}" ya existe.`);
    }
    permisos[permiso] = roles;
  }
  if (!permisos[`${modulo.clave}.ver`]) {
    throw new Error(`[acceso] El módulo "${modulo.clave}" debe definir el permiso "${modulo.clave}.ver".`);
  }
  if (modulo.menu) {
    menu.push({ clave: modulo.clave, ...modulo.menu });
  }
  Object.assign(paginas, modulo.paginas || {});
}

function tienePermiso(rol, permiso) {
  const roles = permisos[permiso];
  return Array.isArray(roles) && roles.includes(rol);
}

function permisosDeRol(rol) {
  return Object.keys(permisos).filter((p) => tienePermiso(rol, p)).sort();
}

/** Menú filtrado: solo secciones e ítems que el rol puede ver. */
function menuDeRol(rol) {
  return menu
    .slice()
    .sort((a, b) => (a.orden || 50) - (b.orden || 50))
    .map((seccion) => ({
      clave: seccion.clave,
      titulo: seccion.titulo,
      icono: seccion.icono,
      items: seccion.items.filter((item) => tienePermiso(rol, item.permiso)),
    }))
    .filter((seccion) => seccion.items.length > 0);
}

/**
 * Permiso necesario para abrir una página de /app.
 *  1. Páginas declaradas por el núcleo o por un módulo.
 *  2. Ítems del menú.
 *  3. Si no está declarada: <carpeta>.ver (ej. /app/limpieza/x.html -> limpieza.ver).
 */
function permisoDePagina(ruta) {
  if (paginas[ruta]) return paginas[ruta];
  for (const seccion of menu) {
    const item = seccion.items.find((i) => i.url === ruta);
    if (item) return item.permiso;
  }
  const partes = ruta.split('/').filter(Boolean); // ['app', 'limpieza', 'x.html']
  if (partes.length >= 3) return `${partes[1]}.ver`;
  return 'dashboard.ver';
}

module.exports = { registrarAcceso, tienePermiso, permisosDeRol, menuDeRol, permisoDePagina };
