/**
 * Reportes de alimentación. Todos reciben ?desde=&hasta= (AAAA-MM-DD), salvo vencimientos.
 */
const db = require('../../config/db');
const raciones = require('./raciones.model');
const AppError = require('../../utils/AppError');
const { ok } = require('../../utils/respuesta');
const { hoy } = require('./constantes');
const { horaActual } = require('./raciones.controller');

const MAX_DIAS_CUMPLIMIENTO = 62;

function rango(req) {
  const desde = req.query.desde || `${hoy().slice(0, 8)}01`;
  const hasta = req.query.hasta || hoy();
  if (desde > hasta) throw AppError.validacion([{ campo: 'desde', mensaje: 'La fecha inicial no puede ser posterior a la final.' }]);
  return { desde, hasta };
}

/** Entradas, consumo y mermas de cada alimento en el periodo, con su costo según el lote. */
async function consumoAlimentos(req, res) {
  const { desde, hasta } = rango(req);
  return ok(res, await db.query(
    `SELECT a.id AS alimento_id, a.nombre AS alimento, a.categoria, a.unidad_medida,
            COUNT(DISTINCT CASE WHEN m.tipo = 'consumo' THEN m.registro_id END)                       AS raciones,
            ROUND(SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END), 3)                    AS entradas,
            ROUND(SUM(CASE WHEN m.tipo = 'consumo' THEN m.cantidad ELSE 0 END), 3)                    AS consumido,
            ROUND(SUM(CASE WHEN m.tipo = 'merma' THEN m.cantidad ELSE 0 END), 3)                      AS merma,
            ROUND(SUM(CASE WHEN m.tipo = 'consumo' THEN m.cantidad * COALESCE(l.costo_unitario, 0) ELSE 0 END), 2) AS costo_consumo,
            ROUND(SUM(CASE WHEN m.tipo = 'merma' THEN m.cantidad * COALESCE(l.costo_unitario, 0) ELSE 0 END), 2)   AS costo_merma
       FROM movimiento_alimento m
       JOIN lote_alimento l ON l.id = m.lote_id
       JOIN alimento a ON a.id = l.alimento_id
      WHERE m.fecha >= ? AND m.fecha < ? + INTERVAL 1 DAY
      GROUP BY a.id
      ORDER BY costo_consumo DESC, a.nombre`,
    [desde, hasta]
  ));
}

/** Lo que comió cada especie, por alimento. */
async function consumoEspecies(req, res) {
  const { desde, hasta } = rango(req);
  return ok(res, await db.query(
    `SELECT e.nombre_comun AS especie, al.nombre AS alimento, al.unidad_medida,
            COUNT(DISTINCT r.animal_id) AS animales, COUNT(*) AS raciones,
            ROUND(SUM(r.cantidad_suministrada), 3) AS cantidad,
            SUM(r.consumo = 'parcial') AS parciales, SUM(r.consumo = 'nulo') AS rechazadas
       FROM registro_alimentacion r
       JOIN animal an ON an.id = r.animal_id
       JOIN especie e ON e.id = an.especie_id
       JOIN dieta d ON d.id = r.dieta_id
       JOIN alimento al ON al.id = d.alimento_id
      WHERE r.fecha BETWEEN ? AND ?
      GROUP BY e.id, al.id
      ORDER BY e.nombre_comun, al.nombre`,
    [desde, hasta]
  ));
}

/**
 * Raciones programadas contra registradas por jaula. Se reconstruye cada día con los horarios
 * activos (desde el día en que se crearon) y las dietas que estaban vigentes ese día.
 * De hoy solo cuentan los turnos cuya hora ya pasó.
 */
async function cumplimiento(req, res) {
  const { desde } = rango(req);
  const fechaHoy = hoy();
  const hasta = rango(req).hasta > fechaHoy ? fechaHoy : rango(req).hasta;
  const dias = (new Date(`${hasta}T12:00:00Z`) - new Date(`${desde}T12:00:00Z`)) / 86400000 + 1;
  if (dias > MAX_DIAS_CUMPLIMIENTO) {
    throw AppError.validacion([{ campo: 'desde', mensaje: `Para este reporte elige un periodo de ${MAX_DIAS_CUMPLIMIENTO} días o menos.` }]);
  }
  const porJaula = {};
  const ahora = horaActual().minutos;
  for (let i = 0; i < dias; i += 1) {
    const fecha = new Date(new Date(`${desde}T12:00:00Z`).getTime() + i * 86400000).toISOString().slice(0, 10);
    const turnos = await raciones.turnos(fecha, { hoy: fechaHoy, ahora });
    // De hoy solo cuentan los turnos cuya hora ya pasó (los pendientes todavía están a tiempo)
    turnos.filter((t) => !(fecha === fechaHoy && t.estado === 'pendiente')).forEach((t) => {
      const j = (porJaula[t.area_id] = porJaula[t.area_id] || {
        area: t.area, cuidadores: new Set(), turnos: 0, programadas: 0, registradas: 0, parciales: 0, rechazadas: 0,
      });
      j.cuidadores.add(t.cuidador);
      j.turnos += 1;
      j.programadas += t.total;
      j.registradas += t.registradas;
      t.animales.forEach((a) => a.raciones.forEach((r) => {
        if (r.registro?.consumo === 'parcial') j.parciales += 1;
        if (r.registro?.consumo === 'nulo') j.rechazadas += 1;
      }));
    });
  }
  return ok(res, Object.values(porJaula)
    .map((j) => ({
      ...j,
      cuidadores: [...j.cuidadores].join(', '),
      pendientes: j.programadas - j.registradas,
      cumplimiento: j.programadas ? Math.round((j.registradas / j.programadas) * 1000) / 10 : null,
    }))
    .sort((a, b) => (a.cumplimiento ?? 101) - (b.cumplimiento ?? 101) || a.area.localeCompare(b.area)));
}

/** Entregas por proveedor en el periodo (por fecha de ingreso del lote). */
async function compras(req, res) {
  const { desde, hasta } = rango(req);
  return ok(res, await db.query(
    `SELECT p.id AS proveedor_id, p.nombre AS proveedor, p.nit,
            COUNT(l.id) AS entregas, COUNT(DISTINCT l.alimento_id) AS alimentos,
            GROUP_CONCAT(DISTINCT a.nombre ORDER BY a.nombre SEPARATOR ', ') AS detalle,
            MAX(l.fecha_ingreso) AS ultima_entrega,
            ROUND(SUM(l.cantidad_inicial * COALESCE(l.costo_unitario, 0)), 2) AS total
       FROM lote_alimento l
       JOIN proveedor p ON p.id = l.proveedor_id
       JOIN alimento a ON a.id = l.alimento_id
      WHERE l.fecha_ingreso BETWEEN ? AND ?
      GROUP BY p.id
      ORDER BY total DESC`,
    [desde, hasta]
  ));
}

/** Lotes con existencia vencidos o que vencen en los próximos ?dias (30 por defecto), con su valor. */
async function vencimientos(req, res) {
  const dias = Math.min(Number(req.query.dias) || 30, 365);
  return ok(res, await db.query(
    `SELECT l.id, l.numero_lote, a.nombre AS alimento, a.unidad_medida, p.nombre AS proveedor,
            l.fecha_vencimiento, DATEDIFF(l.fecha_vencimiento, CURDATE()) AS dias_para_vencer,
            l.cantidad_disponible, ROUND(l.cantidad_disponible * COALESCE(l.costo_unitario, 0), 2) AS valor,
            IF(l.fecha_vencimiento < CURDATE(), 'vencido', 'por_vencer') AS estado
       FROM lote_alimento l
       JOIN alimento a ON a.id = l.alimento_id
       JOIN proveedor p ON p.id = l.proveedor_id
      WHERE l.cantidad_disponible > 0 AND l.fecha_vencimiento IS NOT NULL
        AND l.fecha_vencimiento <= CURDATE() + INTERVAL ? DAY
      ORDER BY l.fecha_vencimiento, a.nombre`,
    [dias]
  ));
}

module.exports = { consumoAlimentos, consumoEspecies, cumplimiento, compras, vencimientos };
