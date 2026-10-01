/**
 * Roles, permisos y menú del NÚCLEO.
 *
 * Cada módulo define sus propios permisos y su menú en
 * server/modulos/<modulo>/index.js, y el núcleo los une al arrancar.
 * Así nadie necesita editar este archivo para agregar su módulo.
 *
 * Convención de permisos:  <modulo>.<recurso>.<accion>   ej. alimentacion.dietas.editar
 * Todo módulo debe tener el permiso <modulo>.ver (entrar al módulo).
 */

const ROLES = Object.freeze({
  ADMIN: 'administrador',
  DIRECTOR: 'director',
  VETERINARIO: 'veterinario',
  CUIDADOR: 'cuidador',
  BODEGA: 'encargado_bodega',
  SUP_LIMPIEZA: 'supervisor_limpieza',
  LIMPIEZA: 'personal_limpieza',
  TAQUILLERO: 'taquillero',
});

const TODOS = Object.values(ROLES);

/** permiso -> roles que lo tienen */
const PERMISOS_NUCLEO = {
  'dashboard.ver': TODOS,
  'admin.ver': [ROLES.ADMIN],
  'usuarios.gestionar': [ROLES.ADMIN],
  'bitacora.ver': [ROLES.ADMIN, ROLES.DIRECTOR],

  // Catálogos compartidos
  'catalogos.ver': [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.VETERINARIO, ROLES.CUIDADOR, ROLES.BODEGA, ROLES.SUP_LIMPIEZA],
  'catalogos.ubicaciones.gestionar': [ROLES.ADMIN], // hábitats y áreas
  'catalogos.animales.gestionar': [ROLES.ADMIN, ROLES.VETERINARIO], // especies y animales
};

/**
 * Secciones del menú del núcleo. `orden` define la posición en la barra lateral
 * (los módulos usan 20, 30, 40 y 50; Administración va al final).
 */
const MENU_NUCLEO = [
  {
    clave: 'general',
    titulo: 'General',
    orden: 10,
    items: [
      { texto: 'Inicio', url: '/app/dashboard.html', icono: 'bi-house-door', permiso: 'dashboard.ver' },
    ],
  },
  {
    clave: 'catalogos',
    titulo: 'Catálogos',
    orden: 80,
    items: [
      { texto: 'Animales', url: '/app/catalogos/animales.html', icono: 'bi-clipboard-heart', permiso: 'catalogos.ver' },
      { texto: 'Especies', url: '/app/catalogos/especies.html', icono: 'bi-feather', permiso: 'catalogos.ver' },
      { texto: 'Hábitats', url: '/app/catalogos/habitats.html', icono: 'bi-tree', permiso: 'catalogos.ver' },
      { texto: 'Áreas y jaulas', url: '/app/catalogos/areas.html', icono: 'bi-geo-alt', permiso: 'catalogos.ver' },
    ],
  },
  {
    clave: 'admin',
    titulo: 'Administración',
    orden: 90,
    items: [
      { texto: 'Usuarios', url: '/app/admin/usuarios.html', icono: 'bi-people', permiso: 'usuarios.gestionar' },
      { texto: 'Bitácora', url: '/app/admin/bitacora.html', icono: 'bi-journal-text', permiso: 'bitacora.ver' },
    ],
  },
];

/**
 * Páginas protegidas que NO aparecen en el menú (detalle, formularios, etc.).
 * Las páginas del menú ya quedan protegidas con el permiso de su ítem.
 * Si una página no está en ningún lado, se exige <carpeta>.ver.
 */
const PAGINAS_NUCLEO = {
  '/app/dashboard.html': 'dashboard.ver',
  '/app/perfil.html': 'dashboard.ver',
};

module.exports = { ROLES, TODOS, PERMISOS_NUCLEO, MENU_NUCLEO, PAGINAS_NUCLEO };
