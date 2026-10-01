/**
 * Controlador de horarios de alimentación (administrador y veterinario).
 *
 * Una dieta con frecuencia_diaria = N se sirve en los primeros N horarios del día
 * de la jaula del animal; por eso se revisa que cada jaula tenga suficientes horarios.
 */
const db = require('../../config/db');
const horarios = require('./horarios.model');
const dietas = require('./dietas.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../../core/bitacora/bitacora.service');
const { DIAS, hoy } = require('./constantes');

const MODULO = 'alimentacion';
const NOMBRE_DIA = { lun: 'lunes', mar: 'martes', mie: 'miércoles', jue: 'jueves', vie: 'viernes', sab: 'sábados', dom: 'domingos' };

async function exigirHorario(id) {
  const horario = await horarios.obtener(id);
  if (!horario) throw AppError.noEncontrado('El horario no existe.');
  return horario;
}

async function validar(d, excluirId = 0) {
  const errores = [];
  const area = await db.queryUno("SELECT id FROM area WHERE id = ? AND tipo = 'jaula' AND activo = 1", [d.area_id]);
  if (!area) errores.push({ campo: 'area_id', mensaje: 'Selecciona una jaula o recinto activo.' });
  const cuidador = await db.queryUno(
    "SELECT u.id FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = ? AND u.activo = 1 AND r.codigo = 'cuidador'", [d.cuidador_id]
  );
  if (!cuidador) errores.push({ campo: 'cuidador_id', mensaje: 'Selecciona un cuidador activo.' });
  if (area && (await horarios.horaOcupada(d.area_id, d.hora, excluirId))) {
    errores.push({ campo: 'hora', mensaje: 'Esta jaula ya tiene un horario a esa hora.' });
  }
  if (errores.length) throw AppError.validacion(errores);
}

/** Ordena los días como lun..dom y quita repetidos. */
const normalizarDias = (dias) => DIAS.filter((dia) => dias.includes(dia));

async function listar(req, res) {
  return ok(res, await horarios.listar(req.query));
}

async function obtener(req, res) {
  return ok(res, await exigirHorario(req.params.id));
}

async function crear(req, res) {
  const d = datosValidos(req);
  d.dias = normalizarDias(d.dias);
  await validar(d);
  const id = await horarios.crear(d);
  await bitacora.registrar(req, {
    modulo: MODULO, accion: bitacora.ACCIONES.CREAR, tabla: 'horario_alimentacion', registroId: id,
    detalle: { area_id: d.area_id, hora: d.hora, dias: d.dias.join(','), cuidador_id: d.cuidador_id },
  });
  return creado(res, { id }, 'Horario registrado.');
}

async function actualizar(req, res) {
  const id = Number(req.params.id);
  const antes = await exigirHorario(id);
  const d = datosValidos(req);
  d.dias = normalizarDias(d.dias);
  await validar(d, id);
  await horarios.actualizar(id, d);
  await bitacora.registrar(req, {
    modulo: MODULO, accion: bitacora.ACCIONES.ACTUALIZAR, tabla: 'horario_alimentacion', registroId: id,
    detalle: {
      antes: { area: antes.area, hora: antes.hora, dias: antes.dias.join(','), cuidador: antes.cuidador },
      despues: { area_id: d.area_id, hora: d.hora, dias: d.dias.join(','), cuidador_id: d.cuidador_id },
    },
  });
  return ok(res, null, 'Horario actualizado.');
}

async function cambiarEstado(req, res) {
  const id = Number(req.params.id);
  const { activo } = datosValidos(req);
  const horario = await exigirHorario(id);
  if (activo && !horario.cuidador_activo) {
    throw AppError.conflicto('El cuidador de este horario está inactivo. Edita el horario y asigna otro cuidador antes de activarlo.');
  }
  await horarios.cambiarEstado(id, activo);
  await bitacora.registrar(req, {
    modulo: MODULO, accion: activo ? bitacora.ACCIONES.ACTIVAR : bitacora.ACCIONES.DESACTIVAR, tabla: 'horario_alimentacion', registroId: id,
  });
  return ok(res, null, activo ? 'Horario activado.' : 'Horario desactivado.');
}

/**
 * GET /horarios/cobertura
 * Por jaula: animales, cuántas raciones al día piden sus dietas vigentes, cuántos
 * horarios tiene cada día y los avisos cuando no alcanzan.
 */
async function calcularCobertura() {
  const [jaulas, activos, animales, comidas] = await Promise.all([
    horarios.jaulas(),
    horarios.listar({ activo: 1 }),
    dietas.animales({}),
    dietas.efectivas({ fecha: hoy() }),
  ]);

  const resultado = jaulas.map((j) => {
    const propios = activos.filter((h) => h.area_id === j.id);
    const porDia = Object.fromEntries(DIAS.map((dia) => [dia, propios.filter((h) => h.dias.includes(dia)).length]));
    const deLaJaula = animales.filter((a) => a.area_id === j.id);
    const filas = comidas.filter((c) => deLaJaula.some((a) => a.id === c.animal_id));
    const conDieta = new Set(filas.map((c) => c.animal_id));
    const sinDieta = deLaJaula.filter((a) => !conDieta.has(a.id)).map((a) => a.nombre);
    const maxFrecuencia = Math.max(0, ...filas.map((c) => c.frecuencia_diaria));

    const avisos = [];
    if (sinDieta.length) avisos.push(`${sinDieta.length === 1 ? 'Un animal no tiene' : `${sinDieta.length} animales no tienen`} dieta vigente: ${sinDieta.join(', ')}.`);
    if (conDieta.size && !propios.length) avisos.push('Tiene animales con dieta pero ningún horario de alimentación.');
    const cortos = DIAS.filter((dia) => porDia[dia] > 0 && porDia[dia] < maxFrecuencia);
    if (cortos.length) {
      const minimo = Math.min(...cortos.map((dia) => porDia[dia]));
      const cuando = cortos.length === 7 ? 'todos los días' : `los ${cortos.map((dia) => NOMBRE_DIA[dia]).join(', ')}`;
      avisos.push(`Las dietas piden ${maxFrecuencia} raciones al día, pero ${cuando} solo hay ${minimo} ${minimo === 1 ? 'horario' : 'horarios'}.`);
    }
    return { area_id: j.id, area: j.nombre, habitat: j.habitat, animales: j.animales, animales_con_dieta: conDieta.size,
      raciones_por_dia: maxFrecuencia, horarios_por_dia: porDia, avisos };
  });
  return resultado;
}

async function cobertura(_req, res) {
  return ok(res, await calcularCobertura());
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, cobertura, calcularCobertura };
