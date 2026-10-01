/**
 * Panel de inicio. Junta las tarjetas de resumen del núcleo y de cada módulo
 * al que el usuario tiene acceso.
 */
const { Router } = require('express');
const db = require('../../config/db');
const { ok } = require('../../utils/respuesta');
const { tienePermiso } = require('../acceso');
const { modulos } = require('../../modulos');

const router = Router();

async function resumenNucleo(puede) {
  const tarjetas = [];
  if (puede('usuarios.gestionar')) {
    const fila = await db.queryUno('SELECT COUNT(*) AS total FROM usuario WHERE activo = 1');
    tarjetas.push({ titulo: 'Usuarios activos', valor: fila.total, icono: 'bi-people', color: 'primary', url: '/app/admin/usuarios.html' });
  }
  if (puede('bitacora.ver')) {
    const fila = await db.queryUno('SELECT COUNT(*) AS total FROM bitacora WHERE fecha >= CURDATE()');
    tarjetas.push({ titulo: 'Acciones registradas hoy', valor: fila.total, icono: 'bi-journal-text', color: 'secondary', url: '/app/admin/bitacora.html' });
  }
  return tarjetas;
}

router.get('/resumen', async (req, res) => {
  const usuario = req.session.usuario;
  const puede = (permiso) => tienePermiso(usuario.rol, permiso);

  const tarjetas = await resumenNucleo(puede);
  for (const modulo of modulos) {
    if (typeof modulo.resumenDashboard !== 'function' || !puede(`${modulo.clave}.ver`)) continue;
    try {
      const propias = await modulo.resumenDashboard(usuario, puede);
      tarjetas.push(...(propias || []).map((t) => ({ ...t, modulo: modulo.clave })));
    } catch (error) {
      console.error(`[dashboard] Error en el resumen de "${modulo.clave}":`, error.message);
    }
  }
  return ok(res, { tarjetas });
});

module.exports = router;
