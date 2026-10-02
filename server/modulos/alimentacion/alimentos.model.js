/**
 * Modelo de alimentos: catálogo, existencia calculada desde los lotes y alertas.
 *
 * La existencia NO se guarda en `alimento`: es la suma de `cantidad_disponible`
 * de sus lotes no vencidos. Así nunca se desincroniza.
 */
const db = require('../../config/db');

/** Existencia y vencimientos por alimento, calculados desde lote_alimento. */
const EXISTENCIAS = `
  SELECT l.alimento_id,
         SUM(CASE WHEN l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURDATE() THEN l.cantidad_disponible ELSE 0 END) AS existencia,
         SUM(CASE WHEN l.fecha_vencimiento < CURDATE() THEN l.cantidad_disponible ELSE 0 END) AS existencia_vencida,
         MIN(CASE WHEN l.cantidad_disponible > 0 AND l.fecha_vencimiento >= CURDATE() THEN l.fecha_vencimiento END) AS proximo_vencimiento,
         SUM(l.cantidad_disponible > 0 AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURDATE())) AS lotes_con_existencia
    FROM lote_alimento l
   GROUP BY l.alimento_id`;

/** Consumo de los últimos 7 días (para estimar cuántos días alcanza la existencia). */
const CONSUMO_7_DIAS = `
  SELECT l.alimento_id, SUM(m.cantidad) / 7 AS consumo_diario
    FROM movimiento_alimento m
    JOIN lote_alimento l ON l.id = m.lote_id
   WHERE m.tipo = 'consumo' AND m.fecha >= CURDATE() - INTERVAL 7 DAY
   GROUP BY l.alimento_id`;

const SELECT_ALIMENTO = `
  SELECT * FROM (
    SELECT a.*,
           ROUND(COALESCE(s.existencia, 0), 3)          AS existencia,
           ROUND(COALESCE(s.existencia_vencida, 0), 3)  AS existencia_vencida,
           s.proximo_vencimiento,
           DATEDIFF(s.proximo_vencimiento, CURDATE())   AS dias_para_vencer,
           COALESCE(s.lotes_con_existencia, 0)          AS lotes_con_existencia,
           ROUND(COALESCE(c.consumo_diario, 0), 3)      AS consumo_diario,
           (COALESCE(s.existencia, 0) <= a.stock_minimo) AS bajo_minimo,
           (s.proximo_vencimiento IS NOT NULL
              AND s.proximo_vencimiento <= CURDATE() + INTERVAL a.dias_aviso_vencimiento DAY) AS por_vencer,
           (SELECT COUNT(*) FROM dieta d WHERE d.alimento_id = a.id AND d.activa = 1) AS dietas_activas
      FROM alimento a
      LEFT JOIN (${EXISTENCIAS}) s ON s.alimento_id = a.id
      LEFT JOIN (${CONSUMO_7_DIAS}) c ON c.alimento_id = a.id
  ) x`;

const ALERTAS = {
  bajo_minimo: 'x.bajo_minimo = 1',
  por_vencer: 'x.por_vencer = 1',
  vencido: 'x.existencia_vencida > 0',
};

const alimentos = {
  listar({ buscar, categoria, alerta, activo } = {}) {
    const condiciones = [];
    const parametros = [];
    if (buscar) { condiciones.push('(x.nombre LIKE ? OR x.descripcion LIKE ?)'); parametros.push(`%${buscar}%`, `%${buscar}%`); }
    if (categoria) { condiciones.push('x.categoria = ?'); parametros.push(categoria); }
    if (alerta && ALERTAS[alerta]) condiciones.push(ALERTAS[alerta]);
    if (activo !== undefined && activo !== null && activo !== '') { condiciones.push('x.activo = ?'); parametros.push(Number(activo)); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    return db.query(`${SELECT_ALIMENTO} ${where} ORDER BY x.activo DESC, x.bajo_minimo DESC, x.nombre`, parametros);
  },

  obtener: (id) => db.queryUno(`${SELECT_ALIMENTO} WHERE x.id = ?`, [id]),

  buscarPorNombre: (nombre, excluirId = 0) =>
    db.queryUno('SELECT id FROM alimento WHERE nombre = ? AND id <> ?', [nombre, excluirId]),

  async crear(d) {
    const r = await db.query(
      `INSERT INTO alimento (nombre, categoria, unidad_medida, stock_minimo, dias_aviso_vencimiento, descripcion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [d.nombre, d.categoria, d.unidad_medida, d.stock_minimo ?? 0, d.dias_aviso_vencimiento ?? 7, d.descripcion]
    );
    return r.insertId;
  },

  actualizar: (id, d) =>
    db.query(
      `UPDATE alimento SET nombre = ?, categoria = ?, unidad_medida = ?, stock_minimo = ?, dias_aviso_vencimiento = ?, descripcion = ?
        WHERE id = ?`,
      [d.nombre, d.categoria, d.unidad_medida, d.stock_minimo ?? 0, d.dias_aviso_vencimiento ?? 7, d.descripcion, id]
    ),

  cambiarEstado: (id, activo) => db.query('UPDATE alimento SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]),

  /** ¿Ya tiene lotes? (si tiene, no se puede cambiar la unidad de medida). */
  async tieneLotes(id) {
    const fila = await db.queryUno('SELECT COUNT(*) AS n FROM lote_alimento WHERE alimento_id = ?', [id]);
    return fila.n > 0;
  },

  /** Historial de movimientos de todos los lotes de un alimento. */
  movimientos(alimentoId, { desde, hasta } = {}) {
    const parametros = [alimentoId];
    let filtro = '';
    if (desde) { filtro += ' AND m.fecha >= ?'; parametros.push(desde); }
    if (hasta) { filtro += ' AND m.fecha < ? + INTERVAL 1 DAY'; parametros.push(hasta); }
    return db.query(`${SELECT_MOVIMIENTO} WHERE l.alimento_id = ? ${filtro} ORDER BY m.fecha DESC, m.id DESC LIMIT 300`, parametros);
  },

  /** Listas para las alertas de inventario. */
  async alertas() {
    const bajoMinimo = await db.query(`${SELECT_ALIMENTO} WHERE x.activo = 1 AND x.bajo_minimo = 1 ORDER BY x.existencia / NULLIF(x.stock_minimo, 0), x.nombre`);
    const lotes = await db.query(
      `SELECT l.id, l.numero_lote, l.alimento_id, a.nombre AS alimento, a.unidad_medida, l.cantidad_disponible,
              l.fecha_vencimiento, DATEDIFF(l.fecha_vencimiento, CURDATE()) AS dias_para_vencer,
              CASE WHEN l.fecha_vencimiento < CURDATE() THEN 'vencido' ELSE 'por_vencer' END AS estado
         FROM lote_alimento l
         JOIN alimento a ON a.id = l.alimento_id
        WHERE a.activo = 1 AND l.cantidad_disponible > 0 AND l.fecha_vencimiento IS NOT NULL
          AND l.fecha_vencimiento <= CURDATE() + INTERVAL a.dias_aviso_vencimiento DAY
        ORDER BY l.fecha_vencimiento, a.nombre`
    );
    return {
      bajo_minimo: bajoMinimo,
      por_vencer: lotes.filter((l) => l.estado === 'por_vencer'),
      vencidos: lotes.filter((l) => l.estado === 'vencido'),
    };
  },

  async conteoAlertas() {
    const { bajo_minimo, por_vencer, vencidos } = await alimentos.alertas();
    return { bajo_minimo: bajo_minimo.length, por_vencer: por_vencer.length, vencidos: vencidos.length };
  },
};

/** Movimiento con el lote, el alimento y, si es consumo, el animal que comió. */
const SELECT_MOVIMIENTO = `
  SELECT m.id, m.tipo, m.cantidad, m.motivo, m.fecha, m.lote_id, l.numero_lote,
         l.alimento_id, a.nombre AS alimento, a.unidad_medida,
         m.registro_id, an.nombre AS animal, an.codigo AS animal_codigo,
         CONCAT(u.nombres, ' ', u.apellidos) AS usuario
    FROM movimiento_alimento m
    JOIN lote_alimento l ON l.id = m.lote_id
    JOIN alimento a ON a.id = l.alimento_id
    JOIN usuario u ON u.id = m.usuario_id
    LEFT JOIN registro_alimentacion r ON r.id = m.registro_id
    LEFT JOIN animal an ON an.id = r.animal_id`;

alimentos.SELECT_MOVIMIENTO = SELECT_MOVIMIENTO;
module.exports = alimentos;
