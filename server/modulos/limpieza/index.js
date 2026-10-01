/**
 * Módulo de Gestión de Limpieza
 * Responsable: Alan
 *
 * Este archivo registra el módulo en el sistema: permisos, menú, rutas y
 * tarjetas del inicio. El núcleo lo carga automáticamente.
 *
 * Contrato de la API (qué debe hacer cada ruta): docs/api/limpieza.md
 */
const { ROLES } = require('../../config/permisos');
const router = require('./limpieza.routes');
const { pendiente } = require('../../utils/pendiente');

const { ADMIN, DIRECTOR, SUP_LIMPIEZA, LIMPIEZA } = ROLES;

module.exports = {
  clave: 'limpieza',
  nombre: 'Gestión de Limpieza',
  icono: 'bi-stars',

  permisos: {
    'limpieza.ver': [ADMIN, DIRECTOR, SUP_LIMPIEZA, LIMPIEZA],
    'limpieza.tareas.ver': [ADMIN, DIRECTOR, SUP_LIMPIEZA],
    'limpieza.tareas.programar': [ADMIN, SUP_LIMPIEZA],
    'limpieza.tareas.verificar': [ADMIN, SUP_LIMPIEZA],
    'limpieza.tareas.ejecutar': [LIMPIEZA],
    'limpieza.insumos.ver': [ADMIN, DIRECTOR, SUP_LIMPIEZA],
    'limpieza.insumos.gestionar': [ADMIN, SUP_LIMPIEZA],
    'limpieza.reportes.ver': [ADMIN, DIRECTOR, SUP_LIMPIEZA],
  },

  menu: {
    titulo: 'Limpieza',
    orden: 30,
    items: [
      { texto: 'Mis tareas', url: '/app/limpieza/mis-tareas.html', icono: 'bi-check2-square', permiso: 'limpieza.tareas.ejecutar' },
      { texto: 'Tareas de limpieza', url: '/app/limpieza/tareas.html', icono: 'bi-calendar-check', permiso: 'limpieza.tareas.ver' },
      { texto: 'Insumos de limpieza', url: '/app/limpieza/insumos.html', icono: 'bi-droplet', permiso: 'limpieza.insumos.ver' },
      { texto: 'Reportes de limpieza', url: '/app/limpieza/reportes.html', icono: 'bi-bar-chart-line', permiso: 'limpieza.reportes.ver' },
    ],
  },

  router,

  /**
   * Tarjetas del inicio. Sugerencia según el permiso del usuario:
   *   - ejecutar:  "Mis tareas de hoy" (pendientes del usuario)
   *   - verificar: "Tareas por verificar" (estado completada)
   *   - insumos:   "Insumos bajo el mínimo"
   * Cada tarjeta: { titulo, valor, icono, color: 'primary'|'alerta'|'peligro'|'neutro', url }
   */
  async resumenDashboard(_usuario, _puede) {
    pendiente('Tarjetas de limpieza en el inicio');
  },
};
