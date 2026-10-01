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
  },

  menu: {
    titulo: 'Alimentación',
    orden: 20,
    items: [
      { texto: 'Dietas', url: '/app/alimentacion/dietas.html', icono: 'bi-clipboard2-pulse', permiso: 'alimentacion.dietas.ver' },
      { texto: 'Horarios de alimentación', url: '/app/alimentacion/horarios.html', icono: 'bi-clock', permiso: 'alimentacion.horarios.ver' },
      { texto: 'Inventario de alimentos', url: '/app/alimentacion/inventario.html', icono: 'bi-box-seam', permiso: 'alimentacion.inventario.ver' },
      { texto: 'Entradas y lotes', url: '/app/alimentacion/lotes.html', icono: 'bi-truck', permiso: 'alimentacion.inventario.ver' },
      { texto: 'Proveedores', url: '/app/alimentacion/proveedores.html', icono: 'bi-shop', permiso: 'alimentacion.inventario.ver' },
    ],
  },

  router,

  /** Tarjetas del inicio: alertas de inventario y jaulas con horarios que no alcanzan. */
  async resumenDashboard(_usuario, puede) {
    const tarjetas = [];
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
