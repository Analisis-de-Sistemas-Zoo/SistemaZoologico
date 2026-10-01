/**
 * Controlador de raciones: turnos del día, registro de lo servido (con descuento FEFO) y deshacer.
 */
const db = require('../../config/db');
const raciones = require('./raciones.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../../core/bitacora/bitacora.service');
const { hoy } = require('./constantes');

const MODULO = 'alimentacion';

/** Hora actual de Guatemala: { hora: 'HH:MM:SS', minutos } */
function horaActual() {
  const d = new Date(Date.now() - 6 * 3600 * 1000);
  const hora = d.toISOString().slice(11, 19);
  return { hora, minutos: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

function resumen(turnos) {
  const r = { turnos: turnos.length, programadas: 0, registradas: 0, pendientes: 0, turnos_atrasados: 0 };
  turnos.forEach((t) => {
    r.programadas += t.total;
    r.registradas += t.registradas;
    if (t.estado === 'atrasado') r.turnos_atrasados += 1;
  });
  r.pendientes = r.programadas - r.registradas;
  return r;
}

/** GET /raciones?fecha=&area_id=&cuidador_id= */
async function listar(req, res) {
  const fechaHoy = hoy();
  const fecha = req.query.fecha || fechaHoy;
  if (fecha > fechaHoy) throw AppError.validacion([{ campo: 'fecha', mensaje: 'Solo se pueden consultar días que ya empezaron.' }]);
  const turnos = await raciones.turnos(fecha, {
    hoy: fechaHoy, ahora: horaActual().minutos, area_id: req.query.area_id, cuidador_id: req.query.cuidador_id,
  });
  return ok(res, { fecha, es_hoy: fecha === fechaHoy, resumen: resumen(turnos), turnos });
}

/**
 * POST /raciones  { horario_id, items: [{ animal_id, dieta_id, cantidad_suministrada, consumo, observaciones }] }
 * Registra una o varias raciones del mismo turno de hoy. Todo o nada.
 */
async function registrar(req, res) {
  const { horario_id: horarioId, items } = datosValidos(req);
  const fecha = hoy();
  const { hora } = horaActual();
  const usuarioId = req.session.usuario.id;

  // 1. Cada ración debe estar programada en ese turno de hoy y no estar registrada
  const [turno] = await raciones.turnos(fecha, { hoy: fecha, ahora: 0 }).then((t) => t.filter((x) => x.horario_id === horarioId));
  if (!turno) throw AppError.validacion([{ campo: 'horario_id', mensaje: 'Ese turno no está programado para hoy.' }]);
  const vistos = new Set();
  const porRegistrar = items.map((item, i) => {
    const animal = turno.animales.find((a) => a.animal_id === item.animal_id);
    const racion = animal?.raciones.find((r) => r.dieta_id === item.dieta_id);
    if (!racion) throw AppError.validacion([{ campo: `items[${i}]`, mensaje: 'Esa ración no está programada en este turno.' }]);
    const clave = `${item.animal_id}-${item.dieta_id}`;
    if (racion.registro || vistos.has(clave)) throw AppError.conflicto(`La ración de ${racion.alimento} de ${animal.nombre} ya está registrada en este turno.`);
    vistos.add(clave);
    return { ...item, horario_id: horarioId, fecha, hora, animal: animal.nombre, alimento_id: racion.alimento_id, alimento: racion.alimento, unidad: racion.unidad_medida };
  });

  // 2. En una transacción: bloquear lotes, comprobar existencia y descontar
  const resultado = await db.transaccion(async (conn) => {
    const necesario = {};
    porRegistrar.forEach((r) => { necesario[r.alimento_id] = (necesario[r.alimento_id] || 0) + r.cantidad_suministrada; });
    const lotesPorAlimento = {};
    for (const alimentoId of Object.keys(necesario)) {
      const lotes = await raciones.lotesFefo(conn, alimentoId);
      const disponible = lotes.reduce((s, l) => s + Number(l.cantidad_disponible), 0);
      if (disponible + 1e-9 < necesario[alimentoId]) {
        const r = porRegistrar.find((x) => String(x.alimento_id) === alimentoId);
        const hay = Math.round(disponible * 1000) / 1000;
        throw AppError.conflicto(`No hay suficiente ${r.alimento}: se necesitan ${Math.round(necesario[alimentoId] * 1000) / 1000} ${r.unidad} y en bodega hay ${hay} ${r.unidad} sin vencer. Avisa al encargado de bodega.`);
      }
      lotesPorAlimento[alimentoId] = lotes;
    }
    const hechos = [];
    for (const r of porRegistrar) {
      const hecho = await raciones.registrar(conn, { ...r, lotes: lotesPorAlimento[r.alimento_id] }, usuarioId);
      await bitacora.registrar(req, {
        modulo: MODULO, accion: bitacora.ACCIONES.CREAR, tabla: 'registro_alimentacion', registroId: hecho.id,
        detalle: { animal: r.animal, alimento: r.alimento, cantidad: r.cantidad_suministrada, consumo: r.consumo, lotes: hecho.lotes.map((l) => l.numero_lote).join(', ') },
      }, conn);
      hechos.push({ ...hecho, animal_id: r.animal_id, dieta_id: r.dieta_id });
    }
    return hechos;
  });

  const n = resultado.length;
  return creado(res, resultado, n === 1 ? 'Ración registrada.' : `${n} raciones registradas.`);
}

/** DELETE /raciones/:id — solo quien la registró y el mismo día; devuelve el alimento a los lotes. */
async function deshacer(req, res) {
  const id = Number(req.params.id);
  const registro = await raciones.obtener(id);
  if (!registro) throw AppError.noEncontrado('La ración no existe.');
  if (registro.usuario_id !== req.session.usuario.id) throw AppError.prohibido('Solo quien registró la ración puede deshacerla.');
  if (String(registro.fecha).slice(0, 10) !== hoy()) throw AppError.conflicto('Solo se pueden deshacer raciones registradas hoy.');
  await db.transaccion(async (conn) => {
    await raciones.deshacer(conn, id);
    await bitacora.registrar(req, {
      modulo: MODULO, accion: bitacora.ACCIONES.ELIMINAR, tabla: 'registro_alimentacion', registroId: id,
      detalle: { animal: registro.animal, alimento: registro.alimento, cantidad: registro.cantidad_suministrada, motivo: 'Ración deshecha; el alimento volvió a sus lotes' },
    }, conn);
  });
  return ok(res, null, 'Ración deshecha. El alimento volvió a bodega.');
}

module.exports = { listar, registrar, deshacer, horaActual, resumen };
