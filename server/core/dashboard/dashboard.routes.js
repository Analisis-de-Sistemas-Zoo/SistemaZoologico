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
  if (puede('catalogos.ver')) {
    const fila = await db.queryUno(
      `SELECT SUM(estado = 'activo') AS activos,
              SUM(estado = 'activo' AND estado_salud IN ('en_tratamiento','critico')) AS en_atencion
         FROM animal`
    );
    tarjetas.push({ titulo: 'Animales en el zoológico', valor: Number(fila.activos || 0), icono: 'bi-clipboard-heart', color: 'primary', url: '/app/catalogos/animales.html' });
    if (Number(fila.en_atencion) > 0) {
      tarjetas.push({ titulo: 'Animales en tratamiento o críticos', valor: Number(fila.en_atencion), icono: 'bi-heart-pulse', color: 'alerta', url: '/app/catalogos/animales.html?estado_salud=en_tratamiento' });
    }
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
      // 501 = resumen del módulo aún no implementado; no es un error.
      if (error.estado !== 501) console.error(`[dashboard] Error en el resumen de "${modulo.clave}":`, error.message);
    }
  }
  return ok(res, { tarjetas });
});

module.exports = router;
