/**
 * Controladores de expedientes, consultas, aplicaciones y reportes clínicos.
 * TODO (Daniela): implementar cada función siguiendo docs/api/clinico.md.
 * Al terminar una función, borra su línea `pendiente(...)`.
 *
 * Herramientas: datosValidos(req), req.session.usuario, db.transaccion(fn),
 * bitacora.registrar(req, …), ok(res, datos), creado(res, datos, mensaje), AppError.
 * Consultas base listas para usar: ./clinico.model.js
 */
const { pendiente } = require('../../utils/pendiente');

// =============================================================== Expedientes
/** GET /expedientes — animales activos con su resumen clínico (SELECT_EXPEDIENTE + dosis_pendientes). */
async function listarExpedientes(_req, _res) {
  pendiente('Lista de expedientes');
}

/** GET /expedientes/:animal_id — { animal, consultas, aplicaciones } */
async function obtenerExpediente(_req, _res) {
  pendiente('Expediente del animal');
}

// ================================================================= Consultas
/** GET /consultas — filtros desde, hasta, animal_id, veterinario_id, tipo. */
async function listarConsultas(_req, _res) {
  pendiente('Lista de consultas');
}

/** GET /consultas/:id — consulta con sus aplicaciones. */
async function obtenerConsulta(_req, _res) {
  pendiente('Detalle de la consulta');
}

/**
 * POST /consultas — registrar consulta (solo veterinarios).
 * En UNA transacción:
 *   1. Validar que el animal exista y esté activo.
 *   2. Insertar consulta_clinica con veterinario_id = req.session.usuario.id.
 *   3. Actualizar animal.estado_salud = estado_salud_resultante (y animal.peso_kg si viene peso).
 *   4. Por cada aplicación del arreglo `aplicaciones`: igual que registrarAplicacion (con consulta_id).
 *   5. Bitácora.
 */
async function crearConsulta(_req, _res) {
  pendiente('Registrar consulta');
}

// ============================================================== Aplicaciones
/** GET /aplicaciones — historial con filtros desde, hasta, animal_id, tipo_insumo. */
async function listarAplicaciones(_req, _res) {
  pendiente('Historial de aplicaciones');
}

/** GET /aplicaciones/pendientes?dias=15 — dosis vencidas y próximas (CONDICION_DOSIS_PENDIENTE). */
async function dosisPendientes(_req, _res) {
  pendiente('Dosis pendientes');
}

/**
 * POST /aplicaciones — aplicación sin consulta (ej. vacunación de rutina). Solo veterinarios.
 * En UNA transacción:
 *   1. El insumo debe estar activo y con stock_actual >= dosis (si no, 409 con el nombre y la existencia).
 *   2. Si es vacuna y no viene proxima_dosis, calcularla con intervalo_refuerzo_dias.
 *   3. Insertar aplicacion_clinica (veterinario_id = usuario en sesión).
 *   4. Insertar movimiento_clinico 'salida' con aplicacion_id y restar stock_actual.
 *   5. Bitácora.
 */
async function registrarAplicacion(_req, _res) {
  pendiente('Registrar aplicación');
}

// ================================================================== Reportes
/** GET /reportes/atenciones — consultas por veterinario y tipo. */
async function reporteAtenciones(_req, _res) {
  pendiente('Reporte de atenciones');
}

/** GET /reportes/consumo — entradas, aplicaciones y mermas por insumo. */
async function reporteConsumo(_req, _res) {
  pendiente('Reporte de consumo de insumos clínicos');
}

/** GET /reportes/vacunacion — vacunas aplicadas en el periodo. */
async function reporteVacunacion(_req, _res) {
  pendiente('Reporte de vacunación');
}

module.exports = {
  listarExpedientes, obtenerExpediente,
  listarConsultas, obtenerConsulta, crearConsulta,
  listarAplicaciones, dosisPendientes, registrarAplicacion,
  reporteAtenciones, reporteConsumo, reporteVacunacion,
};
