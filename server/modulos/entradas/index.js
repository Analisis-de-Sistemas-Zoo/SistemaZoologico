/**
 * Módulo de Gestión de Entradas y Promociones
 * Responsable: Mario
 *
 * Tiene dos partes:
 *   - Portal público (sin sesión): compra en línea y consulta de entradas.
 *   - Sistema interno: venta en taquilla, validación de ingreso, ventas,
 *     tipos de entrada, promociones y reportes.
 *
 * Contrato de la API: docs/api/entradas.md
 */
const { ROLES } = require('../../config/permisos');
const { router, routerPublico } = require('./entradas.routes');
const { pendiente } = require('../../utils/pendiente');

const { ADMIN, DIRECTOR, TAQUILLERO } = ROLES;

module.exports = {
  clave: 'entradas',
  nombre: 'Gestión de Entradas y Promociones',
  icono: 'bi-ticket-perforated',

  permisos: {
    'entradas.ver': [ADMIN, DIRECTOR, TAQUILLERO],
    'entradas.vender': [ADMIN, TAQUILLERO],
    'entradas.validar': [ADMIN, TAQUILLERO],
    'entradas.ventas.ver': [ADMIN, DIRECTOR, TAQUILLERO],
    'entradas.ventas.anular': [ADMIN],
    'entradas.configurar': [ADMIN],
    'entradas.reportes.ver': [ADMIN, DIRECTOR],
  },

  menu: {
    titulo: 'Entradas',
    orden: 50,
    items: [
      { texto: 'Vender entradas', url: '/app/entradas/venta.html', icono: 'bi-cash-coin', permiso: 'entradas.vender' },
      { texto: 'Validar ingreso', url: '/app/entradas/validar.html', icono: 'bi-qr-code-scan', permiso: 'entradas.validar' },
      { texto: 'Ventas', url: '/app/entradas/ventas.html', icono: 'bi-receipt', permiso: 'entradas.ventas.ver' },
      { texto: 'Tipos de entrada', url: '/app/entradas/tipos.html', icono: 'bi-tags', permiso: 'entradas.configurar' },
      { texto: 'Promociones', url: '/app/entradas/promociones.html', icono: 'bi-percent', permiso: 'entradas.configurar' },
      { texto: 'Reportes de ventas', url: '/app/entradas/reportes.html', icono: 'bi-bar-chart-line', permiso: 'entradas.reportes.ver' },
    ],
  },

  router,
  routerPublico,

  /**
   * Tarjetas del inicio sugeridas:
   *   - "Entradas vendidas hoy" y "Ingresos de hoy (Q)"  (ventas pagadas con fecha de hoy)
   *   - "Visitantes que ya ingresaron hoy"               (entradas usadas hoy)
   * Formato: { titulo, valor, icono, color: 'primary'|'alerta'|'peligro'|'neutro', url }
   */
  async resumenDashboard(_usuario, _puede) {
    pendiente('Tarjetas de entradas en el inicio');
  },
};
