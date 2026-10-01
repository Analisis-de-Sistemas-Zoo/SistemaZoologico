/**
 * Controlador de reportes de limpieza.
 * TODO (Alan): implementar siguiendo docs/api/limpieza.md → "Reportes".
 * Todos reciben ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD (ya validados).
 */
const { pendiente } = require('../../utils/pendiente');

/** GET /reportes/cumplimiento — por área: programadas, completadas, verificadas, rechazadas, canceladas, pendientes. */
async function cumplimiento(_req, _res) {
  pendiente('Reporte de cumplimiento por área');
}

/** GET /reportes/consumo-insumos — por insumo: entradas, salidas y mermas del periodo, y stock actual. */
async function consumoInsumos(_req, _res) {
  pendiente('Reporte de consumo de insumos');
}

/** GET /reportes/personal — por persona: tareas asignadas, completadas, rechazadas y minutos promedio. */
async function personal(_req, _res) {
  pendiente('Reporte de desempeño del personal');
}

module.exports = { cumplimiento, consumoInsumos, personal };
