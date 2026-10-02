/**
 * Modelo de tareas de limpieza.
 * La consulta base (SELECT_TAREA) ya devuelve todos los campos que espera la
 * interfaz (ver docs/api/limpieza.md → "Objeto tarea").
 *
 * Además de la lectura, aquí viven los INSERT/UPDATE del ciclo de vida de la
 * tarea y los reportes que se calculan sobre `tarea_limpieza`.
 */
const db = require('../../config/db');

/** Campos que la interfaz espera en cada tarea. */
const SELECT_TAREA = `
  SELECT t.id, t.area_id, a.nombre AS area, a.tipo AS tipo_area,
         t.tipo, t.descripcion, t.fecha_programada, t.hora_programada,
         t.asignado_id, CONCAT(ua.nombres, ' ', ua.apellidos) AS asignado,
         t.programado_por_id, CONCAT(up.nombres, ' ', up.apellidos) AS programado_por,
         t.estado, t.inicio_real, t.fin_real, t.observaciones,
         t.verificado_por_id, CONCAT(uv.nombres, ' ', uv.apellidos) AS verificado_por,
         t.fecha_verificacion, t.observacion_verificacion,
         (t.estado = 'pendiente' AND TIMESTAMP(t.fecha_programada, t.hora_programada) < NOW()) AS atrasada
    FROM tarea_limpieza t
    JOIN area a     ON a.id = t.area_id
    JOIN usuario ua ON ua.id = t.asignado_id
    JOIN usuario up ON up.id = t.programado_por_id
    LEFT JOIN usuario uv ON uv.id = t.verificado_por_id`;

/** Insumos declarados por el personal al completar una tarea. */
const SELECT_INSUMOS_TAREA = `
  SELECT ti.insumo_limpieza_id, i.nombre, i.unidad_medida, ti.cantidad_usada
    FROM tarea_insumo ti
    JOIN insumo_limpieza i ON i.id = ti.insumo_limpieza_id
   WHERE ti.tarea_id = ?
   ORDER BY i.nombre`;

const areaActiva = (id) =>
  db.queryUno('SELECT id FROM area WHERE id = ? AND activo = 1', [id]);

/** El personal de limpieza es quien puede recibir una tarea. */
const esPersonalLimpieza = (id) =>
  db.queryUno(
    `SELECT u.id FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE u.id = ? AND u.activo = 1 AND r.codigo = ?`,
    [id, 'personal_limpieza']
  );

const tareas = {
  /**
   * Filtros opcionales: fecha_desde, fecha_hasta, area_id, asignado_id, estado, tipo.
   * Orden: fecha_programada, hora_programada.
   */
  listar({ fecha_desde, fecha_hasta, area_id, asignado_id, estado, tipo } = {}) {
    const condiciones = [];
    const parametros = [];
    if (fecha_desde) { condiciones.push('t.fecha_programada >= ?'); parametros.push(fecha_desde); }
    if (fecha_hasta) { condiciones.push('t.fecha_programada <= ?'); parametros.push(fecha_hasta); }
    if (area_id) { condiciones.push('t.area_id = ?'); parametros.push(area_id); }
    if (asignado_id) { condiciones.push('t.asignado_id = ?'); parametros.push(asignado_id); }
    if (estado) { condiciones.push('t.estado = ?'); parametros.push(estado); }
    if (tipo) { condiciones.push('t.tipo = ?'); parametros.push(tipo); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    return db.query(
      `${SELECT_TAREA} ${where} ORDER BY t.fecha_programada, t.hora_programada, t.id`,
      parametros
    );
  },

  /** Una tarea con los insumos que el personal registró al completarla. */
  async obtener(id) {
    const tarea = await db.queryUno(`${SELECT_TAREA} WHERE t.id = ?`, [id]);
    if (!tarea) return null;
    return { ...tarea, insumos: await db.query(SELECT_INSUMOS_TAREA, [id]) };
  },

  /** Igual que obtener, pero solo si la tarea es de ese usuario. */
  obtenerDeUsuario: (id, usuarioId) => db.queryUno(`${SELECT_TAREA} WHERE t.id = ? AND t.asignado_id = ?`, [id, usuarioId]),

  /**
   * Tareas de un usuario para una fecha, más las pendientes atrasadas de días
   * anteriores. Las atrasadas solo se agregan cuando la fecha consultada es hoy
   * (`esHoy`): así "mis tareas" del día muestra también lo que quedó pendiente.
   */
  listarDeUsuario(usuarioId, fecha, esHoy) {
    return db.query(
      `${SELECT_TAREA}
        WHERE t.asignado_id = ?
          AND ( t.fecha_programada = ?
                OR ( ? = 1
                     AND t.estado IN ('pendiente', 'en_proceso')
                     AND t.fecha_programada < ? ) )
        ORDER BY t.fecha_programada, t.hora_programada, t.id`,
      [usuarioId, fecha, esHoy ? 1 : 0, fecha]
    );
  },

  crear(d, usuarioId) {
    return db.query(
      `INSERT INTO tarea_limpieza
         (area_id, tipo, descripcion, fecha_programada, hora_programada, asignado_id, programado_por_id, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [d.area_id, d.tipo, d.descripcion || null, d.fecha_programada, d.hora_programada, d.asignado_id, usuarioId]
    ).then((r) => r.insertId);
  },

  actualizar(id, d) {
    return db.query(
      `UPDATE tarea_limpieza
          SET area_id = ?, tipo = ?, descripcion = ?, fecha_programada = ?, hora_programada = ?, asignado_id = ?
        WHERE id = ?`,
      [d.area_id, d.tipo, d.descripcion || null, d.fecha_programada, d.hora_programada, d.asignado_id, id]
    );
  },

  /** El motivo de la cancelación se guarda en observacion_verificacion. */
  cancelar: (id, motivo) =>
    db.query("UPDATE tarea_limpieza SET estado = 'cancelada', observacion_verificacion = ? WHERE id = ?", [motivo, id]),

  verificar: (id, resultado, observacion, usuarioId) =>
    db.query(
      `UPDATE tarea_limpieza
          SET estado = ?, verificado_por_id = ?, fecha_verificacion = NOW(), observacion_verificacion = ?
        WHERE id = ?`,
      [resultado, usuarioId, observacion || null, id]
    ),

  iniciar: (id) => db.query("UPDATE tarea_limpieza SET estado = 'en_proceso', inicio_real = NOW() WHERE id = ?", [id]),

  completar: (id, observaciones, conn = db) =>
    conn.query(
      "UPDATE tarea_limpieza SET estado = 'completada', fin_real = NOW(), observaciones = ? WHERE id = ?",
      [observaciones || null, id]
    ),

  /** Consumo de una tarea: una fila en tarea_insumo y su movimiento de salida. */
  async registrarConsumo(tareaId, insumoId, cantidad, usuarioId, conn = db) {
    await conn.query('INSERT INTO tarea_insumo (tarea_id, insumo_limpieza_id, cantidad_usada) VALUES (?, ?, ?)', [
      tareaId, insumoId, cantidad,
    ]);
    await conn.query(
      `INSERT INTO movimiento_insumo_limpieza (insumo_limpieza_id, tipo, cantidad, tarea_id, usuario_id)
       VALUES (?, 'salida', ?, ?, ?)`,
      [insumoId, cantidad, tareaId, usuarioId]
    );
  },

  // ----------------------------------------------------------- Conteos

  /**
   * Conteo de tareas para las tarjetas del inicio.
   * Filtros opcionales: estados (arreglo), asignado_id y fecha (AAAA-MM-DD).
   */
  conteo({ estados, asignado_id, fecha } = {}) {
    const condiciones = [];
    const parametros = [];
    if (estados && estados.length) {
      condiciones.push(`t.estado IN (${estados.map(() => '?').join(', ')})`);
      parametros.push(...estados);
    }
    if (asignado_id) { condiciones.push('t.asignado_id = ?'); parametros.push(asignado_id); }
    if (fecha) { condiciones.push('t.fecha_programada = ?'); parametros.push(fecha); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    return db
      .queryUno(`SELECT COUNT(*) AS total FROM tarea_limpieza t ${where}`, parametros)
      .then((f) => Number(f.total));
  },

  // ---------------------------------------------------------- Reportes

  /**
   * Cumplimiento por área. `programadas` cuenta todo y cada estado por separado;
   * `pendientes` agrupa 'pendiente' y 'en_proceso'.
   */
  reporteCumplimiento({ desde, hasta }) {
    return db.query(
      `SELECT a.id AS area_id, a.nombre AS area, a.tipo AS tipo_area,
              COUNT(*) AS programadas,
              SUM(t.estado = 'verificada') AS verificadas,
              SUM(t.estado = 'completada') AS completadas,
              SUM(t.estado = 'rechazada')  AS rechazadas,
              SUM(t.estado IN ('pendiente', 'en_proceso')) AS pendientes,
              SUM(t.estado = 'cancelada')  AS canceladas
         FROM tarea_limpieza t
         JOIN area a ON a.id = t.area_id
        WHERE t.fecha_programada BETWEEN ? AND ?
        GROUP BY a.id, a.nombre, a.tipo
        ORDER BY a.nombre`,
      [desde, hasta]
    );
  },

  /**
   * Desempeño por persona. `minutos_promedio` promedia solo las tareas con
   * inicio y fin reales: TIMESTAMPDIFF devuelve NULL si falta cualquiera de los
   * dos y AVG ignora esos valores.
   */
  reportePersonal({ desde, hasta }) {
    return db.query(
      `SELECT u.id AS usuario_id, CONCAT(u.nombres, ' ', u.apellidos) AS nombre,
              COUNT(*) AS asignadas,
              SUM(t.estado IN ('completada', 'verificada')) AS completadas,
              SUM(t.estado = 'verificada') AS verificadas,
              SUM(t.estado = 'rechazada')  AS rechazadas,
              AVG(TIMESTAMPDIFF(MINUTE, t.inicio_real, t.fin_real)) AS minutos_promedio
         FROM tarea_limpieza t
         JOIN usuario u ON u.id = t.asignado_id
        WHERE t.fecha_programada BETWEEN ? AND ?
        GROUP BY u.id, u.nombres, u.apellidos
        ORDER BY u.nombres, u.apellidos`,
      [desde, hasta]
    );
  },
};

module.exports = { tareas, SELECT_TAREA, areaActiva, esPersonalLimpieza };
