/**
 * Modelo de horarios de alimentación: a qué hora y qué días se alimenta cada jaula y quién es responsable.
 * El campo `dias` es un SET de MySQL; se guarda como 'lun,mar,mie' y se devuelve como arreglo.
 */
const db = require('../../config/db');

const DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

const SELECT_HORARIO = `
  SELECT h.id, h.area_id, ar.nombre AS area, hb.nombre AS habitat, TIME_FORMAT(h.hora, '%H:%i') AS hora, h.dias,
         h.cuidador_id, CONCAT(u.nombres, ' ', u.apellidos) AS cuidador, u.activo AS cuidador_activo,
         h.observaciones, h.activo, h.creado_en, h.actualizado_en,
         (SELECT COUNT(*) FROM animal an WHERE an.area_id = h.area_id AND an.estado = 'activo') AS animales
    FROM horario_alimentacion h
    JOIN area ar ON ar.id = h.area_id
    LEFT JOIN habitat hb ON hb.id = ar.habitat_id
    JOIN usuario u ON u.id = h.cuidador_id`;

const aArreglo = (h) => (h ? { ...h, dias: h.dias ? h.dias.split(',') : [] } : h);

const horarios = {
  DIAS,

  async listar({ area_id, cuidador_id, dia, activo } = {}) {
    const c = [];
    const p = [];
    if (area_id) { c.push('h.area_id = ?'); p.push(Number(area_id)); }
    if (cuidador_id) { c.push('h.cuidador_id = ?'); p.push(Number(cuidador_id)); }
    if (dia) { c.push('FIND_IN_SET(?, h.dias) > 0'); p.push(dia); }
    if (activo !== undefined && activo !== null && activo !== '') { c.push('h.activo = ?'); p.push(Number(activo)); }
    const where = c.length ? `WHERE ${c.join(' AND ')}` : '';
    return (await db.query(`${SELECT_HORARIO} ${where} ORDER BY h.activo DESC, ar.nombre, h.hora`, p)).map(aArreglo);
  },

  obtener: async (id) => aArreglo(await db.queryUno(`${SELECT_HORARIO} WHERE h.id = ?`, [id])),

  horaOcupada: (areaId, hora, excluirId = 0) =>
    db.queryUno('SELECT id FROM horario_alimentacion WHERE area_id = ? AND hora = ? AND id <> ?', [areaId, hora, excluirId]),

  jaula: (id) => db.queryUno("SELECT id, nombre, activo FROM area WHERE id = ? AND tipo = 'jaula'", [id]),

  cuidador: (id) =>
    db.queryUno(
      `SELECT u.id, u.activo FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = ? AND r.codigo = 'cuidador'`,
      [id]
    ),

  async crear(d) {
    const r = await db.query(
      'INSERT INTO horario_alimentacion (area_id, hora, dias, cuidador_id, observaciones) VALUES (?, ?, ?, ?, ?)',
      [d.area_id, d.hora, d.dias.join(','), d.cuidador_id, d.observaciones]
    );
    return r.insertId;
  },

  actualizar: (id, d) =>
    db.query(
      'UPDATE horario_alimentacion SET area_id = ?, hora = ?, dias = ?, cuidador_id = ?, observaciones = ? WHERE id = ?',
      [d.area_id, d.hora, d.dias.join(','), d.cuidador_id, d.observaciones, id]
    ),

  cambiarEstado: (id, activo) => db.query('UPDATE horario_alimentacion SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]),

  /** Jaulas activas con su número de animales. */
  jaulas: () =>
    db.query(
      `SELECT ar.id, ar.nombre, hb.nombre AS habitat,
              (SELECT COUNT(*) FROM animal an WHERE an.area_id = ar.id AND an.estado = 'activo') AS animales
         FROM area ar LEFT JOIN habitat hb ON hb.id = ar.habitat_id
        WHERE ar.tipo = 'jaula' AND ar.activo = 1
        ORDER BY ar.nombre`
    ),
};

module.exports = horarios;
