/**
 * Controlador de dietas (las define el veterinario en sesión).
 */
const db = require('../../config/db');
const dietas = require('./dietas.model');
const alimentos = require('./alimentos.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../../core/bitacora/bitacora.service');
const { hoy, fechaCorta } = require('./constantes');

const MODULO = 'alimentacion';

async function exigirDieta(id) {
  const dieta = await dietas.obtener(id);
  if (!dieta) throw AppError.noEncontrado('La dieta no existe.');
  return dieta;
}

async function exigirVeterinario(req) {
  const id = req.session.usuario.id;
  if (!(await dietas.esVeterinario(id))) throw AppError.prohibido('Solo un veterinario registrado puede definir dietas.');
  return id;
}

/** Valida destino, alimento, fechas y que no haya otra dieta igual en las mismas fechas. Devuelve los datos listos. */
async function preparar(req, excluirId = 0) {
  const d = datosValidos(req);
  const errores = [];
  if (d.destino === 'animal') {
    d.especie_id = null;
    const animal = d.animal_id && (await db.queryUno("SELECT id, nombre FROM animal WHERE id = ? AND estado = 'activo'", [d.animal_id]));
    if (!animal) errores.push({ campo: 'animal_id', mensaje: 'Selecciona un animal que esté en el zoológico.' });
    if (!d.motivo) errores.push({ campo: 'motivo', mensaje: 'Explica por qué este animal necesita una dieta distinta a la de su especie.' });
  } else {
    d.animal_id = null;
    const especie = d.especie_id && (await db.queryUno('SELECT id FROM especie WHERE id = ? AND activo = 1', [d.especie_id]));
    if (!especie) errores.push({ campo: 'especie_id', mensaje: 'Selecciona una especie activa.' });
  }
  const alimento = await alimentos.obtener(d.alimento_id);
  if (!alimento || !alimento.activo) errores.push({ campo: 'alimento_id', mensaje: 'Selecciona un alimento activo.' });
  if (d.fecha_fin && d.fecha_fin < d.fecha_inicio) errores.push({ campo: 'fecha_fin', mensaje: 'La fecha final no puede ser anterior al inicio.' });
  if (d.fecha_fin && d.fecha_fin < hoy()) errores.push({ campo: 'fecha_fin', mensaje: 'La fecha final ya pasó.' });
  if (errores.length) throw AppError.validacion(errores);

  const otra = await dietas.traslape(d, excluirId);
  if (otra) {
    throw AppError.validacion([{
      campo: 'alimento_id',
      mensaje: `Ya hay una dieta con ${alimento.nombre} para este ${d.destino === 'animal' ? 'animal' : 'grupo'} desde el ${fechaCorta(otra.fecha_inicio)}. Edítala o finalízala.`,
    }]);
  }
  delete d.destino;
  return { d, alimento };
}

async function listar(req, res) {
  return ok(res, await dietas.listar(req.query));
}

async function obtener(req, res) {
  return ok(res, await exigirDieta(req.params.id));
}

/** GET /dietas/por-animal — qué come cada animal en una fecha (las dietas propias reemplazan a las de su especie). */
async function porAnimal(req, res) {
  const filtros = { ...req.query, fecha: req.query.fecha || hoy() };
  const [animales, filas] = await Promise.all([dietas.animales(filtros), dietas.efectivas(filtros)]);
  const porId = {};
  filas.forEach((f) => (porId[f.animal_id] = porId[f.animal_id] || []).push(f));
  return ok(res, animales.map((a) => {
    const lista = porId[a.id] || [];
    return { ...a, origen: lista[0]?.origen || null, dietas: lista };
  }));
}

async function crear(req, res) {
  const veterinarioId = await exigirVeterinario(req);
  const { d, alimento } = await preparar(req);
  const id = await dietas.crear(d, veterinarioId);
  await bitacora.registrar(req, {
    modulo: MODULO, accion: bitacora.ACCIONES.CREAR, tabla: 'dieta', registroId: id,
    detalle: { especie_id: d.especie_id, animal_id: d.animal_id, alimento: alimento.nombre, racion: d.cantidad_racion, frecuencia: d.frecuencia_diaria },
  });
  return creado(res, { id }, 'Dieta registrada.');
}

/**
 * PUT /dietas/:id
 * Si la dieta todavía no tiene raciones registradas se corrige directamente.
 * Si ya tiene, se conserva como historial: se finaliza y se crea una dieta nueva con los cambios.
 */
async function actualizar(req, res) {
  const id = Number(req.params.id);
  const veterinarioId = await exigirVeterinario(req);
  const antes = await exigirDieta(id);
  if (antes.estado === 'finalizada') throw AppError.conflicto('La dieta ya está finalizada; registra una nueva.');
  const { d } = await preparar(req, id);

  if (antes.raciones_registradas === 0) {
    await dietas.actualizar(id, d, veterinarioId);
    await bitacora.registrar(req, {
      modulo: MODULO, accion: bitacora.ACCIONES.ACTUALIZAR, tabla: 'dieta', registroId: id,
      detalle: { antes: { alimento_id: antes.alimento_id, racion: antes.cantidad_racion, frecuencia: antes.frecuencia_diaria }, despues: d },
    });
    return ok(res, { id, reemplazada: false }, 'Dieta actualizada.');
  }

  if (d.fecha_inicio < hoy()) d.fecha_inicio = hoy();
  const nuevoId = await db.transaccion(async (conn) => {
    await dietas.finalizar(id, conn);
    const nueva = await dietas.crear(d, veterinarioId, conn);
    await bitacora.registrar(req, {
      modulo: MODULO, accion: bitacora.ACCIONES.ACTUALIZAR, tabla: 'dieta', registroId: nueva,
      detalle: { reemplaza_a: id, racion: d.cantidad_racion, frecuencia: d.frecuencia_diaria, motivo: d.motivo },
    }, conn);
    return nueva;
  });
  return ok(res, { id: nuevoId, reemplazada: true }, 'Se guardó como una dieta nueva desde hoy; la anterior quedó en el historial.');
}

/** PATCH /dietas/:id/finalizar — deja de aplicarse desde hoy. */
async function finalizar(req, res) {
  const id = Number(req.params.id);
  await exigirVeterinario(req);
  const dieta = await exigirDieta(id);
  if (dieta.estado === 'finalizada') throw AppError.conflicto('La dieta ya está finalizada.');
  const { motivo } = datosValidos(req);
  await dietas.finalizar(id);
  await bitacora.registrar(req, {
    modulo: MODULO, accion: bitacora.ACCIONES.DESACTIVAR, tabla: 'dieta', registroId: id, detalle: { motivo },
  });
  return ok(res, null, 'Dieta finalizada.');
}

module.exports = { listar, obtener, porAnimal, crear, actualizar, finalizar };
