/**
 * Modelo de tareas de limpieza.
 * TODO (Alan): completar las funciones. La consulta base ya devuelve todos los
 * campos que espera la interfaz (ver docs/api/limpieza.md → "Objeto tarea").
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

const tareas = {
  /**
   * Filtros: fecha_desde, fecha_hasta, area_id, asignado_id, estado, tipo
   * Orden: fecha_programada, hora_programada
   * Ejemplo de inicio:
   *   return db.query(`${SELECT_TAREA} WHERE t.fecha_programada BETWEEN ? AND ? ORDER BY ...`, [desde, hasta]);
   */
  async listar(_filtros) {
    throw new Error('TODO: tareas.listar');
  },

  /** Una tarea con sus insumos usados (tarea_insumo JOIN insumo_limpieza). */
  async obtener(_id) {
    throw new Error('TODO: tareas.obtener');
  },

  /** Tareas de un usuario para una fecha, más las pendientes atrasadas de días anteriores. */
  async listarDeUsuario(_usuarioId, _fecha) {
    throw new Error('TODO: tareas.listarDeUsuario');
  },
};

module.exports = { tareas, SELECT_TAREA };
