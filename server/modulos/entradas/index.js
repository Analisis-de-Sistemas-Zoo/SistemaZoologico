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
const m = require('./ventas.model');

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
  async resumenDashboard(_usuario, puede) {
    const tarjetas = [];
    if (puede('entradas.ventas.ver')) {
      const hoy = await m.resumenVentasHoy();
      tarjetas.push(
        { titulo: 'Entradas vendidas hoy', valor: Number(hoy.entradas), icono: 'bi-ticket-perforated',
          color: 'primary', url: '/app/entradas/ventas.html' },
        { titulo: 'Ingresos de hoy', valor: `Q${Number(hoy.ingresos).toFixed(2)}`, icono: 'bi-cash-stack',
          color: 'primary', url: '/app/entradas/ventas.html' },
      );
    }
    if (puede('entradas.validar')) {
      const r = await m.resumenIngresosHoy();
      const ingresados = Number(r.ingresados || 0);
      const pendientes = Number(r.entradas_del_dia || 0) - ingresados;
      tarjetas.push(
        { titulo: 'Visitantes que ingresaron hoy', valor: ingresados, icono: 'bi-person-check',
          color: ingresados ? 'primary' : 'neutro', url: '/app/entradas/validar.html' },
        { titulo: 'Entradas de hoy por ingresar', valor: pendientes, icono: 'bi-hourglass-split',
          color: pendientes ? 'alerta' : 'neutro', url: '/app/entradas/validar.html' },
      );
    }
    return tarjetas;
  },
};
