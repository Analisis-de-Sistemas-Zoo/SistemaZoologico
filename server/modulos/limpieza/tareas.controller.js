/**
 * Controlador de tareas de limpieza.
 *
 * Son dos perfiles distintos sobre la misma tabla `tarea_limpieza`:
 *   - el supervisor programa, edita, cancela y verifica;
 *   - el personal de limpieza ejecuta lo suyo (inicia y completa).
 *
 * Reglas de negocio: docs/api/limpieza.md. Los datos ya llegan validados desde
 * limpieza.routes.js, así que aquí solo se revisa lo que depende de la base de
 * datos (área activa, personal válido, fecha no pasada, existencia, estado actual).
 */
const db = require('../../config/db');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../../core/bitacora/bitacora.service');
const { tareas: modelo, areaActiva, esPersonalLimpieza } = require('./tareas.model');

const MODULO = 'limpieza';

/** Fecha de hoy en Guatemala (UTC-6) como AAAA-MM-DD. */
const hoy = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

/** Las cantidades de insumos y de stock tienen dos decimales en la BD. */
const redondear2 = (valor) => Math.round(Number(valor) * 100) / 100;

// ---------------------------------------------------------------- Auxiliares

async function exigirTarea(id) {
  const tarea = await modelo.obtener(id);
  if (!tarea) throw AppError.noEncontrado('La tarea no existe.');
  return tarea;
}

/**
 * Una tarea ajena se responde igual que una inexistente (404): así el personal
 * no puede tantear si otra persona tiene esa tarea.
 */
async function exigirTareaPropia(req) {
  const tarea = await modelo.obtenerDeUsuario(Number(req.params.id), req.session.usuario.id);
  if (!tarea) throw AppError.noEncontrado('La tarea no existe.');
  return tarea;
}

/** Reglas compartidas por programar y editar. */
async function revisarProgramacion(datos) {
  const errores = [];
  if (!(await areaActiva(datos.area_id))) {
    errores.push({ campo: 'area_id', mensaje: 'El área no existe o está inactiva.' });
  }
  if (!(await esPersonalLimpieza(datos.asignado_id))) {
    errores.push({ campo: 'asignado_id', mensaje: 'Selecciona a una persona del personal de limpieza.' });
  }
  if (datos.fecha_programada < hoy()) {
    errores.push({ campo: 'fecha_programada', mensaje: 'No se pueden programar tareas en días pasados.' });
  }
  if (errores.length) throw AppError.validacion(errores);
}

// ------------------------------------------------------------ Supervisor

/** GET /tareas — lista con filtros. */
async function listar(req, res) {
  return ok(res, await modelo.listar(req.query));
}

/** GET /tareas/:id — detalle con insumos usados. */
async function obtener(req, res) {
  return ok(res, await exigirTarea(req.params.id));
}

/**
 * POST /tareas — programar.
 * Reglas: el área debe estar activa; el asignado debe estar activo y tener rol
 * personal_limpieza; la fecha no puede ser anterior a hoy.
 * programado_por_id = req.session.usuario.id ; estado inicial = 'pendiente'
 */
async function crear(req, res) {
  const datos = datosValidos(req);
  await revisarProgramacion(datos);
  const id = await modelo.crear(datos, req.session.usuario.id);
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.CREAR,
    tabla: 'tarea_limpieza',
    registroId: id,
    detalle: {
      area_id: datos.area_id, tipo: datos.tipo,
      fecha_programada: datos.fecha_programada, hora_programada: datos.hora_programada,
      asignado_id: datos.asignado_id,
    },
  });
  return creado(res, { id }, 'Tarea programada.');
}

/** PUT /tareas/:id — editar. Solo si la tarea está 'pendiente'. Mismas reglas que crear. */
async function actualizar(req, res) {
  const id = Number(req.params.id);
  const antes = await exigirTarea(id);
  if (antes.estado !== 'pendiente') throw AppError.conflicto('Solo se pueden editar tareas pendientes.');

  const datos = datosValidos(req);
  await revisarProgramacion(datos);
  await modelo.actualizar(id, datos);
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.ACTUALIZAR,
    tabla: 'tarea_limpieza',
    registroId: id,
    detalle: { antes: { tipo: antes.tipo, fecha: antes.fecha_programada, hora: antes.hora_programada, asignado_id: antes.asignado_id }, despues: datos },
  });
  return ok(res, null, 'Tarea actualizada.');
}

/**
 * PATCH /tareas/:id/cancelar   { motivo }
 * Solo 'pendiente' o 'en_proceso'. Guarda el motivo en observacion_verificacion.
 */
async function cancelar(req, res) {
  const id = Number(req.params.id);
  const tarea = await exigirTarea(id);
  if (!['pendiente', 'en_proceso'].includes(tarea.estado)) {
    throw AppError.conflicto('Solo se pueden cancelar tareas pendientes o en proceso.');
  }
  const { motivo } = datosValidos(req);
  await modelo.cancelar(id, motivo);
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.ACTUALIZAR,
    tabla: 'tarea_limpieza',
    registroId: id,
    detalle: { estado: { antes: tarea.estado, despues: 'cancelada' }, motivo },
  });
  return ok(res, null, 'Tarea cancelada.');
}

/**
 * PATCH /tareas/:id/verificar   { resultado: 'verificada'|'rechazada', observacion }
 * Solo tareas 'completada'. Si es rechazada, la observación es obligatoria.
 * Guarda verificado_por_id = usuario en sesión y fecha_verificacion = NOW().
 */
async function verificar(req, res) {
  const id = Number(req.params.id);
  const tarea = await exigirTarea(id);
  if (tarea.estado !== 'completada') throw AppError.conflicto('Solo se pueden verificar tareas completadas.');

  const { resultado, observacion } = datosValidos(req);
  if (resultado === 'rechazada' && !observacion) {
    throw AppError.validacion([{ campo: 'observacion', mensaje: 'Obligatoria al rechazar: explica qué faltó.' }]);
  }

  await modelo.verificar(id, resultado, observacion, req.session.usuario.id);
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.ACTUALIZAR,
    tabla: 'tarea_limpieza',
    registroId: id,
    detalle: { estado: { antes: 'completada', despues: resultado }, observacion },
  });
  return ok(res, null, resultado === 'verificada' ? 'Tarea verificada.' : 'Tarea rechazada.');
}

// ------------------------------------------------------- Personal de limpieza

/** GET /mis-tareas?fecha= — tareas del usuario en sesión (por defecto hoy) y las atrasadas. */
async function misTareas(req, res) {
  const fecha = req.query.fecha || hoy();
  const tareas = await modelo.listarDeUsuario(req.session.usuario.id, fecha, fecha === hoy());
  return ok(res, tareas);
}

/** PATCH /mis-tareas/:id/iniciar — solo si es suya y está 'pendiente'. inicio_real = NOW(). */
async function iniciar(req, res) {
  const tarea = await exigirTareaPropia(req);
  if (tarea.estado !== 'pendiente') throw AppError.conflicto('Solo se pueden iniciar tareas pendientes.');

  await modelo.iniciar(tarea.id);
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.ACTUALIZAR,
    tabla: 'tarea_limpieza',
    registroId: tarea.id,
    detalle: { estado: { antes: 'pendiente', despues: 'en_proceso' } },
  });
  return ok(res, null, 'Tarea iniciada.');
}

/**
 * PATCH /mis-tareas/:id/completar   { observaciones, insumos: [{ insumo_limpieza_id, cantidad }] }
 * Solo si es suya y está 'en_proceso'. En UNA transacción:
 *   1. Por cada insumo: verificar existencia suficiente (si no, 409 con el nombre del insumo),
 *      insertar en tarea_insumo, insertar movimiento 'salida' con tarea_id y restar stock.
 *   2. estado = 'completada', fin_real = NOW(), observaciones.
 *   3. Bitácora.
 */
async function completar(req, res) {
  const tarea = await exigirTareaPropia(req);
  if (tarea.estado !== 'en_proceso') throw AppError.conflicto('Solo se pueden completar tareas en proceso.');

  const { observaciones, insumos } = datosValidos(req);
  const usados = (insumos || []).map((i) => ({
    insumo_limpieza_id: i.insumo_limpieza_id,
    cantidad: redondear2(i.cantidad),
  }));

  // tarea_insumo tiene clave primaria (tarea_id, insumo_limpieza_id): un insumo
  // repetido en la misma tarea sería un error de base de datos, así que se avisa.
  if (usados.length !== new Set(usados.map((i) => i.insumo_limpieza_id)).size) {
    throw AppError.validacion([
      { campo: 'insumos', mensaje: 'Hay un insumo repetido. Suma las cantidades en una sola fila.' },
    ]);
  }

  await db.transaccion(async (conn) => {
    for (const item of usados) {
      const insumo = await conn.queryUno(
        'SELECT id, nombre, stock_actual FROM insumo_limpieza WHERE id = ? AND activo = 1',
        [item.insumo_limpieza_id]
      );
      if (!insumo) throw AppError.noEncontrado('El producto seleccionado ya no está disponible.');
      if (Number(insumo.stock_actual) < item.cantidad) {
        throw AppError.conflicto(`No hay suficiente ${insumo.nombre} (hay ${insumo.stock_actual}).`);
      }

      await modelo.registrarConsumo(tarea.id, insumo.id, item.cantidad, req.session.usuario.id, conn);
      // El `AND stock_actual >= ?` evita que dos tareas resten el mismo lote a la vez.
      const resta = await conn.query(
        'UPDATE insumo_limpieza SET stock_actual = stock_actual - ? WHERE id = ? AND stock_actual >= ?',
        [item.cantidad, insumo.id, item.cantidad]
      );
      if (!resta.affectedRows) throw AppError.conflicto(`No hay suficiente ${insumo.nombre} (hay ${insumo.stock_actual}).`);
    }
    await modelo.completar(tarea.id, observaciones, conn);
  });

  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.ACTUALIZAR,
    tabla: 'tarea_limpieza',
    registroId: tarea.id,
    detalle: {
      estado: { antes: 'en_proceso', despues: 'completada' },
      observaciones,
      insumos: usados,
    },
  });
  return ok(res, null, 'Tarea completada. Quedó pendiente de verificación.');
}

module.exports = { listar, obtener, crear, actualizar, cancelar, verificar, misTareas, iniciar, completar };