/**
 * Módulo de Gestión de Alimentación
 * Responsable: Mijeli
 *
 * Registra el módulo en el sistema: permisos, menú, rutas y tarjetas del inicio.
 * Documentación de la API: docs/api/alimentacion.md
 */
const { ROLES } = require('../../config/permisos');
const router = require('./alimentacion.routes');
const alimentos = require('./alimentos.model');
const { calcularCobertura } = require('./horarios.controller');
const raciones = require('./raciones.model');
const { horaActual } = require('./raciones.controller');
const { hoy } = require('./constantes');

const { ADMIN, DIRECTOR, VETERINARIO, CUIDADOR, BODEGA } = ROLES;

module.exports = {
  clave: 'alimentacion',
  nombre: 'Gestión de Alimentación',
  icono: 'bi-basket',

  permisos: {
    'alimentacion.ver': [ADMIN, DIRECTOR, VETERINARIO, CUIDADOR, BODEGA],
    'alimentacion.inventario.ver': [ADMIN, DIRECTOR, VETERINARIO, BODEGA],
    'alimentacion.inventario.gestionar': [ADMIN, BODEGA],
    'alimentacion.dietas.ver': [ADMIN, DIRECTOR, VETERINARIO, CUIDADOR],
    'alimentacion.dietas.gestionar': [VETERINARIO],
    'alimentacion.horarios.ver': [ADMIN, DIRECTOR, VETERINARIO, CUIDADOR],
    'alimentacion.horarios.gestionar': [ADMIN, VETERINARIO],
    'alimentacion.raciones.ver': [ADMIN, DIRECTOR, VETERINARIO, CUIDADOR],
    'alimentacion.raciones.registrar': [CUIDADOR],
    'alimentacion.reportes.ver': [ADMIN, DIRECTOR, VETERINARIO, BODEGA],
  },

  menu: {
    titulo: 'Alimentación',
    orden: 20,
    items: [
      { texto: 'Raciones del día', url: '/app/alimentacion/raciones.html', icono: 'bi-basket', permiso: 'alimentacion.raciones.ver' },
      { texto: 'Dietas', url: '/app/alimentacion/dietas.html', icono: 'bi-clipboard2-pulse', permiso: 'alimentacion.dietas.ver' },
      { texto: 'Horarios de alimentación', url: '/app/alimentacion/horarios.html', icono: 'bi-clock', permiso: 'alimentacion.horarios.ver' },
      { texto: 'Inventario de alimentos', url: '/app/alimentacion/inventario.html', icono: 'bi-box-seam', permiso: 'alimentacion.inventario.ver' },
      { texto: 'Entradas y lotes', url: '/app/alimentacion/lotes.html', icono: 'bi-truck', permiso: 'alimentacion.inventario.ver' },
      { texto: 'Proveedores', url: '/app/alimentacion/proveedores.html', icono: 'bi-shop', permiso: 'alimentacion.inventario.ver' },
      { texto: 'Reportes de alimentación', url: '/app/alimentacion/reportes.html', icono: 'bi-bar-chart-line', permiso: 'alimentacion.reportes.ver' },
    ],
  },

  router,

  /** Tarjetas del inicio: raciones del día, alertas de inventario y jaulas con horarios que no alcanzan. */
  async resumenDashboard(usuario, puede) {
    const tarjetas = [];
    if (puede('alimentacion.raciones.ver')) {
      const propias = puede('alimentacion.raciones.registrar');
      const turnos = await raciones.turnos(hoy(), { hoy: hoy(), ahora: horaActual().minutos, cuidador_id: propias ? usuario.id : undefined });
      const pendientes = turnos.reduce((s, t) => s + t.total - t.registradas, 0);
      const atrasados = turnos.filter((t) => t.estado === 'atrasado').length;
      tarjetas.push(
        { titulo: propias ? 'Mis raciones pendientes de hoy' : 'Raciones pendientes de hoy', valor: pendientes, icono: 'bi-basket',
          color: pendientes ? 'alerta' : 'primary', url: '/app/alimentacion/raciones.html' },
        { titulo: propias ? 'Mis turnos atrasados' : 'Turnos de alimentación atrasados', valor: atrasados, icono: 'bi-alarm',
          color: atrasados ? 'peligro' : 'neutro', url: '/app/alimentacion/raciones.html' },
      );
    }
    if (puede('alimentacion.inventario.ver')) {
      const r = await alimentos.conteoAlertas();
      tarjetas.push(
        { titulo: 'Alimentos bajo el mínimo', valor: r.bajo_minimo, icono: 'bi-box-seam', color: r.bajo_minimo ? 'alerta' : 'primary',
          url: '/app/alimentacion/inventario.html?alerta=bajo_minimo' },
        { titulo: 'Lotes por vencer', valor: r.por_vencer, icono: 'bi-hourglass-split', color: r.por_vencer ? 'alerta' : 'primary',
          url: '/app/alimentacion/lotes.html?estado=por_vencer' },
        { titulo: 'Lotes vencidos con existencia', valor: r.vencidos, icono: 'bi-exclamation-octagon', color: r.vencidos ? 'peligro' : 'neutro',
          url: '/app/alimentacion/lotes.html?estado=vencido' },
      );
    }
    if (puede('alimentacion.horarios.gestionar')) {
      const conAvisos = (await calcularCobertura()).filter((j) => j.avisos.length).length;
      tarjetas.push({ titulo: 'Jaulas con avisos de alimentación', valor: conAvisos, icono: 'bi-clock', color: conAvisos ? 'alerta' : 'primary',
        url: '/app/alimentacion/horarios.html' });
    }
    return tarjetas;
  },
};
