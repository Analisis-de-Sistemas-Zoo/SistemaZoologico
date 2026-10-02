/**
 * Controlador de reportes de limpieza.
 *
 * Los tres reportes devuelven un arreglo de filas y dejan el cálculo de totales
 * y porcentajes en la interfaz (docs/api/limpieza.md → "Reportes").
 *
 * Todos reciben ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD. Si faltan, el rango por
 * defecto es el mes en curso hasta hoy.
 */
const { ok } = require('../../utils/respuesta');
const { tareas } = require('./tareas.model');
const insumos = require('./insumos.model');

/** Fecha de hoy en Guatemala (UTC-6) como AAAA-MM-DD. */
const hoy = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

/** Rango del reporte: lo que llega validado, o el mes en curso hasta hoy. */
const rango = (req) => ({
  desde: req.query.desde || `${hoy().slice(0, 8)}01`,
  hasta: req.query.hasta || hoy(),
});

const redondear1 = (valor) => Math.round(Number(valor) * 10) / 10;

/** GET /reportes/cumplimiento — por área: programadas, completadas, verificadas, rechazadas, canceladas, pendientes. */
async function cumplimiento(req, res) {
  return ok(res, await tareas.reporteCumplimiento(rango(req)));
}

/** GET /reportes/consumo-insumos — por insumo: entradas, salidas y mermas del periodo, y stock actual. */
async function consumoInsumos(req, res) {
  return ok(res, await insumos.reporteConsumo(rango(req)));
}

/** GET /reportes/personal — por persona: tareas asignadas, completadas, rechazadas y minutos promedio. */
async function personal(req, res) {
  const filas = await tareas.reportePersonal(rango(req));
  // AVG devuelve NULL si en el periodo nadie terminó una tarea; se muestra 0.
  return ok(res, filas.map((f) => ({ ...f, minutos_promedio: f.minutos_promedio === null ? 0 : redondear1(f.minutos_promedio) })));
}

module.exports = { cumplimiento, consumoInsumos, personal };