/**
 * Consultas comunes de solo lectura: /api/comun/...
 *
 * Sirven para llenar los selectores de cualquier módulo (animales, jaulas,
 * cuidadores, veterinarios...). Solo exigen sesión iniciada y devuelven
 * únicamente registros activos con los campos necesarios para un <select>.
 *
 * Desde el frontend:
 *   const jaulas = await Zoo.api.get('/api/comun/areas', { tipo: 'jaula' });
 *   const cuidadores = await Zoo.api.get('/api/comun/usuarios', { roles: 'cuidador' });
 */
const { Router } = require('express');
const { query } = require('express-validator');
const db = require('../../config/db');
const validar = require('../../middlewares/validar');
const { ok } = require('../../utils/respuesta');
const { TIPOS_AREA } = require('../../config/catalogos');
const { ROLES } = require('../../config/permisos');

const router = Router();

const lista = (texto) => String(texto || '').split(',').map((v) => v.trim()).filter(Boolean);

/** GET /api/comun/habitats */
router.get('/habitats', async (_req, res) => {
  ok(res, await db.query('SELECT id, nombre, tipo FROM habitat WHERE activo = 1 ORDER BY nombre'));
});

/** GET /api/comun/areas?tipo=jaula  (acepta varios: tipo=sanitario,jardin) */
router.get(
  '/areas',
  validar([query('tipo').optional({ values: 'falsy' }).custom((v) => lista(v).every((t) => TIPOS_AREA.includes(t)))
    .withMessage('Tipo de área inválido.')]),
  async (req, res) => {
    const tipos = lista(req.query.tipo);
    const filtro = tipos.length ? 'AND a.tipo IN (?)' : '';
    ok(res, await db.query(
      `SELECT a.id, a.nombre, a.tipo, a.habitat_id, h.nombre AS habitat
         FROM area a LEFT JOIN habitat h ON h.id = a.habitat_id
        WHERE a.activo = 1 ${filtro}
        ORDER BY a.nombre`,
      tipos.length ? [tipos] : []
    ));
  }
);

/** GET /api/comun/especies */
router.get('/especies', async (_req, res) => {
  ok(res, await db.query(
    'SELECT id, nombre_comun, nombre_cientifico, clasificacion, tipo_dieta FROM especie WHERE activo = 1 ORDER BY nombre_comun'
  ));
});

/** GET /api/comun/animales?area_id=1&especie_id=2 */
router.get(
  '/animales',
  validar([
    query('area_id').optional({ values: 'falsy' }).isInt({ min: 1 }),
    query('especie_id').optional({ values: 'falsy' }).isInt({ min: 1 }),
  ]),
  async (req, res) => {
    const condiciones = ["an.estado = 'activo'"];
    const parametros = [];
    if (req.query.area_id) { condiciones.push('an.area_id = ?'); parametros.push(req.query.area_id); }
    if (req.query.especie_id) { condiciones.push('an.especie_id = ?'); parametros.push(req.query.especie_id); }
    ok(res, await db.query(
      `SELECT an.id, an.codigo, an.nombre, an.especie_id, e.nombre_comun AS especie,
              an.area_id, a.nombre AS area, an.estado_salud, an.peso_kg
         FROM animal an
         JOIN especie e ON e.id = an.especie_id
         JOIN area a ON a.id = an.area_id
        WHERE ${condiciones.join(' AND ')}
        ORDER BY an.nombre`,
      parametros
    ));
  }
);

/** GET /api/comun/usuarios?roles=cuidador,personal_limpieza */
router.get(
  '/usuarios',
  validar([query('roles').custom((v) => {
    const roles = lista(v);
    return roles.length > 0 && roles.every((rol) => Object.values(ROLES).includes(rol));
  }).withMessage('Indica uno o varios roles válidos.')]),
  async (req, res) => {
    ok(res, await db.query(
      `SELECT u.id, CONCAT(u.nombres, ' ', u.apellidos) AS nombre, r.codigo AS rol, r.nombre AS rol_nombre
         FROM usuario u JOIN rol r ON r.id = u.rol_id
        WHERE u.activo = 1 AND r.codigo IN (?)
        ORDER BY u.nombres, u.apellidos`,
      [lista(req.query.roles)]
    ));
  }
);

/** GET /api/comun/veterinarios */
router.get('/veterinarios', async (_req, res) => {
  ok(res, await db.query(
    `SELECT u.id, CONCAT(u.nombres, ' ', u.apellidos) AS nombre, v.num_colegiado, v.especialidad
       FROM veterinario v JOIN usuario u ON u.id = v.usuario_id
       JOIN rol r ON r.id = u.rol_id
      WHERE u.activo = 1 AND r.codigo = 'veterinario'
      ORDER BY u.nombres`
  ));
});

module.exports = router;
