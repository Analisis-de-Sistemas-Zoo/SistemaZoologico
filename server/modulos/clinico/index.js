/**
 * Módulo de Control Clínico
 * Responsable: Daniela
 *
 * Registra el módulo: permisos, menú, rutas y tarjetas del inicio.
 * Contrato de la API (qué debe hacer cada ruta): docs/api/clinico.md
 */
const { ROLES } = require('../../config/permisos');
const router = require('./clinico.routes');
const { pendiente } = require('../../utils/pendiente');

const { ADMIN, DIRECTOR, VETERINARIO } = ROLES;

module.exports = {
  clave: 'clinico',
  nombre: 'Control Clínico',
  icono: 'bi-heart-pulse',

  permisos: {
    'clinico.ver': [ADMIN, DIRECTOR, VETERINARIO],
    'clinico.registrar': [VETERINARIO], // consultas y aplicaciones
    'clinico.inventario.gestionar': [ADMIN, VETERINARIO],
    'clinico.reportes.ver': [ADMIN, DIRECTOR, VETERINARIO],
  },

  menu: {
    titulo: 'Control clínico',
    orden: 40,
    items: [
      { texto: 'Expedientes', url: '/app/clinico/expedientes.html', icono: 'bi-folder2-open', permiso: 'clinico.ver' },
      { texto: 'Consultas', url: '/app/clinico/consultas.html', icono: 'bi-clipboard2-pulse', permiso: 'clinico.ver' },
      { texto: 'Vacunas y tratamientos', url: '/app/clinico/aplicaciones.html', icono: 'bi-eyedropper', permiso: 'clinico.ver' },
      { texto: 'Inventario clínico', url: '/app/clinico/inventario.html', icono: 'bi-capsule', permiso: 'clinico.ver' },
      { texto: 'Reportes clínicos', url: '/app/clinico/reportes.html', icono: 'bi-bar-chart-line', permiso: 'clinico.reportes.ver' },
    ],
  },

  // Páginas que no están en el menú
  paginas: {
    '/app/clinico/expediente.html': 'clinico.ver',
  },

  router,

  /**
   * Tarjetas del inicio sugeridas:
   *   - "Dosis vencidas" (aplicaciones con proxima_dosis < hoy sin aplicación posterior), color peligro
   *   - "Dosis en los próximos 7 días", color alerta
   *   - "Insumos clínicos bajo el mínimo", color peligro
   * Formato: { titulo, valor, icono, color: 'primary'|'alerta'|'peligro'|'neutro', url }
   */
  async resumenDashboard(_usuario, _puede) {
    pendiente('Tarjetas de control clínico en el inicio');
  },
};
