/**
 * Módulo de Control Clínico
 * Responsable: Daniela
 *
 * Registra el módulo: permisos, menú, rutas y tarjetas del inicio.
 * Contrato de la API (qué debe hacer cada ruta): docs/api/clinico.md
 */
const { ROLES } = require('../../config/permisos');
const router = require('./clinico.routes');
const { clinico } = require('./clinico.model');
const inventario = require('./inventario.model');

const { ADMIN, DIRECTOR, VETERINARIO } = ROLES;

/** Días que se anticipa la tarjeta de dosis por venir. */
const DIAS_PRORO = 7;

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
   * Tarjetas del inicio:
   *   - "Dosis vencidas" (aplicaciones con proxima_dosis < hoy sin aplicación posterior)
   *   - "Dosis en los próximos 7 días"
   *   - "Productos clínicos bajo el mínimo"
   * Los tres roles que entran al módulo (administrador, director y veterinario)
   * ven las mismas, así que aquí no hay que volver a pedir permisos.
   * Formato: { titulo, valor, icono, color: 'primary'|'alerta'|'peligro'|'neutro', url }
   */
  async resumenDashboard() {
    const [vencidas, proximas, bajos] = await Promise.all([
      clinico.conteoDosisVencidas(),
      clinico.conteoDosisProximas(DIAS_PRORO),
      inventario.contarBajoMinimo(),
    ]);
    return [
      {
        titulo: 'Dosis vencidas', valor: vencidas, icono: 'bi-exclamation-triangle',
        color: vencidas ? 'peligro' : 'neutro', url: '/app/clinico/aplicaciones.html',
      },
      {
        titulo: `Dosis en los próximos ${DIAS_PRORO} días`, valor: proximas, icono: 'bi-calendar-week',
        color: proximas ? 'alerta' : 'neutro', url: '/app/clinico/aplicaciones.html',
      },
      {
        titulo: 'Productos clínicos bajo el mínimo', valor: bajos, icono: 'bi-capsule',
        color: bajos ? 'peligro' : 'neutro', url: '/app/clinico/inventario.html?bajo_minimo=1',
      },
    ];
  },
};
