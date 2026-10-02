/**
 * Modelo de dietas.
 *
 * Reglas:
 *   - Una dieta es para una especie o para un animal (nunca ambos).
 *   - Si un animal tiene dietas propias vigentes, esas REEMPLAZAN a las de su especie.
 *   - Vigente en una fecha F: activa = 1 y fecha_inicio <= F y (fecha_fin vacía o >= F).
 */
const db = require('../../config/db');

/** Condición SQL de "vigente en la fecha ?" para el alias indicado. Usa 2 parámetros. */
const vigenteEn = (a) => `${a}.activa = 1 AND ${a}.fecha_inicio <= ? AND (${a}.fecha_fin IS NULL OR ${a}.fecha_fin >= ?)`;

const SELECT_DIETA = `
  SELECT * FROM (
    SELECT d.*,
           IF(d.animal_id IS NULL, 'especie', 'animal')            AS destino,
           COALESCE(e.nombre_comun, ea.nombre_comun)                 AS especie,
           COALESCE(d.especie_id, an.especie_id)                     AS especie_ref_id,
           an.nombre AS animal, an.codigo AS animal_codigo, ar.nombre AS area,
           al.nombre AS alimento, al.categoria AS categoria_alimento, al.unidad_medida,
           CONCAT(u.nombres, ' ', u.apellidos)                       AS veterinario,
           ROUND(d.cantidad_racion * d.frecuencia_diaria, 3)        AS racion_diaria,
           CASE
             WHEN d.activa = 0 OR (d.fecha_fin IS NOT NULL AND d.fecha_fin < CURDATE()) THEN 'finalizada'
             WHEN d.fecha_inicio > CURDATE() THEN 'programada'
             ELSE 'vigente'
           END AS estado,
           (SELECT COUNT(*) FROM registro_alimentacion r WHERE r.dieta_id = d.id) AS raciones_registradas,
           IF(d.animal_id IS NOT NULL, 1,
              (SELECT COUNT(*) FROM animal x
                WHERE x.especie_id = d.especie_id AND x.estado = 'activo'
                  AND NOT EXISTS (SELECT 1 FROM dieta p WHERE p.animal_id = x.id AND ${vigenteEn('p').replace(/\?/g, 'CURDATE()')}))
           ) AS animales_aplica
      FROM dieta d
      LEFT JOIN especie e  ON e.id = d.especie_id
      LEFT JOIN animal an  ON an.id = d.animal_id
      LEFT JOIN especie ea ON ea.id = an.especie_id
      LEFT JOIN area ar    ON ar.id = an.area_id
      JOIN alimento al     ON al.id = d.alimento_id
      JOIN usuario u       ON u.id = d.veterinario_id
  ) x`;

const dietas = {
  listar({ buscar, destino, especie_id, animal_id, alimento_id, estado } = {}) {
    const c = [];
    const p = [];
    if (buscar) {
      c.push('(x.alimento LIKE ? OR x.especie LIKE ? OR x.animal LIKE ? OR x.animal_codigo LIKE ?)');
      p.push(...Array(4).fill(`%${buscar}%`));
    }
    if (destino) { c.push('x.destino = ?'); p.push(destino); }
    if (especie_id) { c.push('x.especie_ref_id = ?'); p.push(Number(especie_id)); }
    if (animal_id) { c.push('x.animal_id = ?'); p.push(Number(animal_id)); }
    if (alimento_id) { c.push('x.alimento_id = ?'); p.push(Number(alimento_id)); }
    if (estado === 'actual') c.push("x.estado IN ('vigente', 'programada')");
    else if (estado) { c.push('x.estado = ?'); p.push(estado); }
    const where = c.length ? `WHERE ${c.join(' AND ')}` : '';
    return db.query(
      `${SELECT_DIETA} ${where}
       ORDER BY FIELD(x.estado, 'vigente', 'programada', 'finalizada'), x.especie, x.destino DESC, x.animal, x.alimento, x.fecha_inicio DESC`,
      p
    );
  },

  obtener: (id) => db.queryUno(`${SELECT_DIETA} WHERE x.id = ?`, [id]),

  esVeterinario: async (usuarioId) => Boolean(await db.queryUno('SELECT usuario_id FROM veterinario WHERE usuario_id = ?', [usuarioId])),

  /** Otra dieta activa del mismo destino y alimento cuyas fechas se cruzan con [inicio, fin]. */
  traslape({ especie_id, animal_id, alimento_id, fecha_inicio, fecha_fin }, excluirId = 0) {
    return db.queryUno(
      `SELECT d.id, d.fecha_inicio, d.fecha_fin FROM dieta d
        WHERE d.activa = 1 AND d.id <> ? AND d.alimento_id = ?
          AND ${animal_id ? 'd.animal_id = ?' : 'd.especie_id = ?'}
          AND d.fecha_inicio <= COALESCE(?, '9999-12-31')
          AND COALESCE(d.fecha_fin, '9999-12-31') >= ?
        LIMIT 1`,
      [excluirId, alimento_id, animal_id || especie_id, fecha_fin, fecha_inicio]
    );
  },

  async crear(d, veterinarioId, conn = db) {
    const r = await conn.query(
      `INSERT INTO dieta (especie_id, animal_id, alimento_id, cantidad_racion, frecuencia_diaria, indicaciones, motivo,
                          veterinario_id, fecha_inicio, fecha_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.especie_id, d.animal_id, d.alimento_id, d.cantidad_racion, d.frecuencia_diaria, d.indicaciones, d.motivo,
        veterinarioId, d.fecha_inicio, d.fecha_fin]
    );
    return r.insertId;
  },

  /** Cambio directo: solo para dietas que todavía no tienen raciones registradas. */
  actualizar: (id, d, veterinarioId) =>
    db.query(
      `UPDATE dieta SET especie_id = ?, animal_id = ?, alimento_id = ?, cantidad_racion = ?, frecuencia_diaria = ?,
              indicaciones = ?, motivo = ?, veterinario_id = ?, fecha_inicio = ?, fecha_fin = ?
        WHERE id = ?`,
      [d.especie_id, d.animal_id, d.alimento_id, d.cantidad_racion, d.frecuencia_diaria, d.indicaciones, d.motivo,
        veterinarioId, d.fecha_inicio, d.fecha_fin, id]
    ),

  /** Cierra la dieta: deja de aplicarse desde ya y su historial se conserva. */
  finalizar: (id, conn = db) =>
    conn.query('UPDATE dieta SET activa = 0, fecha_fin = GREATEST(fecha_inicio, CURDATE()) WHERE id = ?', [id]),

  /**
   * Dietas que se aplican a cada animal activo en una fecha (las propias reemplazan a las de la especie).
   * Devuelve una fila por animal y dieta; los animales sin dieta no aparecen.
   */
  efectivas({ fecha, area_id, especie_id, animal_id } = {}) {
    const c = ["an.estado = 'activo'"];
    const p = [fecha, fecha, fecha, fecha];
    if (area_id) { c.push('an.area_id = ?'); p.push(Number(area_id)); }
    if (especie_id) { c.push('an.especie_id = ?'); p.push(Number(especie_id)); }
    if (animal_id) { c.push('an.id = ?'); p.push(Number(animal_id)); }
    return db.query(
      `SELECT an.id AS animal_id, d.id AS dieta_id, d.alimento_id, al.nombre AS alimento, al.unidad_medida,
              d.cantidad_racion, d.frecuencia_diaria, ROUND(d.cantidad_racion * d.frecuencia_diaria, 3) AS racion_diaria,
              d.indicaciones, d.motivo, d.fecha_inicio, d.fecha_fin,
              IF(d.animal_id IS NULL, 'especie', 'animal') AS origen,
              CONCAT(u.nombres, ' ', u.apellidos) AS veterinario
         FROM animal an
         JOIN dieta d ON ${vigenteEn('d')}
                     AND (d.animal_id = an.id
                          OR (d.especie_id = an.especie_id
                              AND NOT EXISTS (SELECT 1 FROM dieta p WHERE p.animal_id = an.id AND ${vigenteEn('p')})))
         JOIN alimento al ON al.id = d.alimento_id
         JOIN usuario u ON u.id = d.veterinario_id
        WHERE ${c.join(' AND ')}
        ORDER BY an.id, al.nombre`,
      p
    );
  },

  /** Animales activos con su jaula (para armar la vista por animal). */
  animales({ area_id, especie_id, animal_id, buscar } = {}) {
    const c = ["an.estado = 'activo'"];
    const p = [];
    if (area_id) { c.push('an.area_id = ?'); p.push(Number(area_id)); }
    if (especie_id) { c.push('an.especie_id = ?'); p.push(Number(especie_id)); }
    if (animal_id) { c.push('an.id = ?'); p.push(Number(animal_id)); }
    if (buscar) { c.push('(an.nombre LIKE ? OR an.codigo LIKE ?)'); p.push(`%${buscar}%`, `%${buscar}%`); }
    return db.query(
      `SELECT an.id, an.codigo, an.nombre, an.especie_id, e.nombre_comun AS especie, an.area_id, ar.nombre AS area,
              an.estado_salud, an.peso_kg
         FROM animal an JOIN especie e ON e.id = an.especie_id JOIN area ar ON ar.id = an.area_id
        WHERE ${c.join(' AND ')}
        ORDER BY ar.nombre, an.nombre`,
      p
    );
  },
};

module.exports = dietas;
