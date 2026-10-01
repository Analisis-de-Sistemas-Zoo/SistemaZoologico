/**
 * Controlador de tareas de limpieza.
 * TODO (Alan): implementar cada función siguiendo docs/api/limpieza.md.
 * Al terminar una función, borra su línea `pendiente(...)`.
 *
 * Herramientas disponibles:
 *   datosValidos(req)           datos ya validados por las reglas de limpieza.routes.js
 *   req.session.usuario         { id, nombre, rol } del usuario en sesión
 *   db.transaccion(fn)          para operaciones que tocan varias tablas
 *   bitacora.registrar(req, …)  obligatorio en cada cambio
 *   ok(res, datos) / creado(res, datos, mensaje)
 *   throw new AppError(409, 'mensaje') / AppError.validacion([{ campo, mensaje }])
 */
const { pendiente } = require('../../utils/pendiente');

// ------------------------------------------------------------ Supervisor
/** GET /tareas — lista con filtros. */
async function listar(_req, _res) {
  pendiente('Listado de tareas de limpieza');
}

/** GET /tareas/:id — detalle con insumos usados. */
async function obtener(_req, _res) {
  pendiente('Detalle de la tarea');
}

/**
 * POST /tareas — programar.
 * Reglas: el área debe estar activa; el asignado debe estar activo y tener rol
 * personal_limpieza; la fecha no puede ser anterior a hoy.
 * programado_por_id = req.session.usuario.id ; estado inicial = 'pendiente'
 */
async function crear(_req, _res) {
  pendiente('Programar tarea de limpieza');
}

/** PUT /tareas/:id — editar. Solo si la tarea está 'pendiente'. Mismas reglas que crear. */
async function actualizar(_req, _res) {
  pendiente('Editar tarea de limpieza');
}

/**
 * PATCH /tareas/:id/cancelar   { motivo }
 * Solo 'pendiente' o 'en_proceso'. Guarda el motivo en observacion_verificacion.
 */
async function cancelar(_req, _res) {
  pendiente('Cancelar tarea');
}

/**
 * PATCH /tareas/:id/verificar   { resultado: 'verificada'|'rechazada', observacion }
 * Solo tareas 'completada'. Si es rechazada, la observación es obligatoria.
 * Guarda verificado_por_id = usuario en sesión y fecha_verificacion = NOW().
 */
async function verificar(_req, _res) {
  pendiente('Verificar o rechazar tarea');
}

// ------------------------------------------------------- Personal de limpieza
/** GET /mis-tareas?fecha= — tareas del usuario en sesión (por defecto hoy) y las atrasadas. */
async function misTareas(_req, _res) {
  pendiente('Mis tareas');
}

/** PATCH /mis-tareas/:id/iniciar — solo si es suya y está 'pendiente'. inicio_real = NOW(). */
async function iniciar(_req, _res) {
  pendiente('Iniciar tarea');
}

/**
 * PATCH /mis-tareas/:id/completar   { observaciones, insumos: [{ insumo_limpieza_id, cantidad }] }
 * Solo si es suya y está 'en_proceso'. En UNA transacción:
 *   1. Por cada insumo: verificar existencia suficiente (si no, 409 con el nombre del insumo),
 *      insertar en tarea_insumo, insertar movimiento 'salida' con tarea_id y restar stock.
 *   2. estado = 'completada', fin_real = NOW(), observaciones.
 *   3. Bitácora.
 */
async function completar(_req, _res) {
  pendiente('Completar tarea');
}

module.exports = { listar, obtener, crear, actualizar, cancelar, verificar, misTareas, iniciar, completar };
