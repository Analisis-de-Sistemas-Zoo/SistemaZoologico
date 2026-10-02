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
const { tareas } = require('./tareas.model');
const insumos = require('./insumos.model');

const { ADMIN, DIRECTOR, SUP_LIMPIEZA, LIMPIEZA } = ROLES;

/** Fecha de hoy en Guatemala (UTC-6) como AAAA-MM-DD. */
const hoy = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

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
  async resumenDashboard(usuario, puede) {
    const tarjetas = [];

    if (puede('limpieza.tareas.ejecutar')) {
      const pendientes = await tareas.conteo({ estados: ['pendiente', 'en_proceso'], asignado_id: usuario.id, fecha: hoy() });
      tarjetas.push({
        titulo: 'Mis tareas de hoy', valor: pendientes, icono: 'bi-check2-square',
        color: pendientes ? 'alerta' : 'neutro', url: '/app/limpieza/mis-tareas.html',
      });
    }

    if (puede('limpieza.tareas.verificar')) {
      const porVerificar = await tareas.conteo({ estados: ['completada'] });
      tarjetas.push({
        titulo: 'Tareas por verificar', valor: porVerificar, icono: 'bi-clipboard-check',
        color: porVerificar ? 'alerta' : 'neutro', url: '/app/limpieza/tareas.html',
      });
    }

    if (puede('limpieza.insumos.ver')) {
      const bajos = await insumos.contarBajoMinimo();
      tarjetas.push({
        titulo: 'Insumos bajo el mínimo', valor: bajos, icono: 'bi-droplet',
        color: bajos ? 'peligro' : 'neutro', url: '/app/limpieza/insumos.html?bajo_minimo=1',
      });
    }

    return tarjetas;
  },
};
