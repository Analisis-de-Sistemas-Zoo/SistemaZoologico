/**
 * Controladores de expedientes, consultas, aplicaciones y reportes clínicos.
 *
 * Reglas de negocio y contrato: docs/api/clinico.md. Los datos ya llegan
 * validados desde clinico.routes.js, así que aquí solo se revisa lo que depende
 * de la base de datos: animal activo, producto activo, existencia suficiente,
 * fecha no futura y próxima dosis coherente.
 *
 * La función interna `aplicarProducto()` es la que descuenta existencia: la
 * usan tanto POST /aplicaciones como las aplicaciones que se registran dentro
 * de una consulta, para que una aplicación se guarde siempre igual.
 */
const db = require('../../config/db');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../../core/bitacora/bitacora.service');
const { clinico: modelo } = require('./clinico.model');

const MODULO = 'clinico';

/** Periodo por defecto de GET /aplicaciones/pendientes. */
const DIAS_PENDIENTES = 15;

const registrar = (req, accion, tabla, registroId, detalle, conn) =>
  bitacora.registrar(req, { modulo: MODULO, accion, tabla, registroId, detalle }, conn);

// ============================================================== Utilidades

/** Fecha de hoy en Guatemala (UTC-6) como AAAA-MM-DD. */
const hoy = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

/** Ahora mismo en Guatemala como 'AAAA-MM-DD HH:MM:SS' (formato de la columna DATETIME). */
const ahora = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

/** Los filtros de fecha llegan como AAAA-MM-DD; se recortan por si vienen con hora. */
const dia = (valor) => (valor ? String(valor).slice(0, 10) : valor);

/** Las dosis y la existencia tienen dos decimales en la BD. */
const redondear2 = (valor) => Math.round(Number(valor) * 100) / 100;

/** 'AAAA-MM-DD' o 'AAAA-MM-DD HH:MM:SS' + días -> 'AAAA-MM-DD'. */
function sumarDias(fecha, dias) {
  const d = new Date(`${String(fecha).slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(dias));
  return d.toISOString().slice(0, 10);
}

/** Nombre del campo para el error: en una consulta hay que señalar la fila, ej. 'aplicaciones[0].dosis'. */
const campo = (prefijo, nombre) => (prefijo ? `${prefijo}${nombre}` : nombre);

/** El animal tiene que existir y seguir en el zoológico para recibir atención. */
async function exigirAnimalActivo(animalId, conn) {
  const animal = await conn.queryUno('SELECT id FROM animal WHERE id = ? AND estado = ?', [animalId, 'activo']);
  if (!animal) {
    throw AppError.validacion([{ campo: 'animal_id', mensaje: 'El animal no existe o ya no está en el zoológico.' }]);
  }
}

/** Periodo de los reportes; por defecto, el mes en curso. */
function rango(req) {
  const desde = dia(req.query.desde) || `${hoy().slice(0, 8)}01`;
  const hasta = dia(req.query.hasta) || hoy();
  if (desde > hasta) {
    throw AppError.validacion([{ campo: 'desde', mensaje: 'La fecha inicial no puede ser posterior a la final.' }]);
  }
  return { desde, hasta };
}

/**
 * Registra una aplicación y descuenta la existencia. En UNA transacción:
 *   1. El producto debe estar activo y con existencia >= dosis (si no, 409).
 *   2. Si es vacuna y no viene próxima dosis, se programa con su intervalo de refuerzo.
 *   3. Se inserta la aplicación (con consulta_id si nació dentro de una consulta).
 *   4. Se inserta el movimiento 'salida' y se resta la existencia.
 * `prefijo` es '' en POST /aplicaciones y 'aplicaciones[n].' dentro de una consulta.
 */
async function aplicarProducto(req, conn, a, { consultaId = null, prefijo = '' } = {}) {
  const insumo = await conn.queryUno(
    `SELECT id, nombre, tipo, unidad_medida, stock_actual, intervalo_refuerzo_dias
       FROM insumo_clinico
      WHERE id = ? AND activo = 1`,
    [a.insumo_clinico_id]
  );
  if (!insumo) throw AppError.noEncontrado('El producto seleccionado ya no está disponible.');

  const dosis = redondear2(a.dosis);
  const sinExistencia = () => AppError.conflicto(`No hay suficiente ${insumo.nombre} (hay ${insumo.stock_actual}).`);
  if (Number(insumo.stock_actual) < dosis) throw sinExistencia();

  // Refuerzo automático de vacunas: la siguiente dosis se programa sola.
  const proxima = a.proxima_dosis
    || (insumo.tipo === 'vacuna' && insumo.intervalo_refuerzo_dias
      ? sumarDias(a.fecha_aplicacion, insumo.intervalo_refuerzo_dias)
      : null);
  if (proxima && proxima < String(a.fecha_aplicacion).slice(0, 10)) {
    throw AppError.validacion([
      { campo: campo(prefijo, 'proxima_dosis'), mensaje: 'La próxima dosis no puede ser anterior a la aplicación.' },
    ]);
  }

  const id = await modelo.crearAplicacion(
    {
      animal_id: a.animal_id,
      insumo_clinico_id: insumo.id,
      consulta_id: consultaId,
      dosis,
      via: a.via,
      fecha_aplicacion: a.fecha_aplicacion,
      proxima_dosis: proxima,
      observaciones: a.observaciones || null,
    },
    req.session.usuario.id,
    conn
  );
  await modelo.crearMovimiento(
    { insumo_clinico_id: insumo.id, tipo: 'salida', cantidad: dosis, aplicacion_id: id, usuario_id: req.session.usuario.id },
    conn
  );
  // El `AND stock_actual >= ?` evita que dos aplicaciones resten el mismo lote a la vez.
  const resta = await modelo.restarStock(insumo.id, dosis, conn);
  if (!resta.affectedRows) throw sinExistencia();

  return { id, insumo: insumo.nombre, dosis, proxima_dosis: proxima };
}

// =============================================================== Expedientes

/** GET /expedientes — animales activos con su resumen clínico. */
async function listarExpedientes(req, res) {
  const { buscar, especie_id, estado_salud } = req.query;
  return ok(res, await modelo.listarExpedientes({ buscar, especie_id, estado_salud }));
}

/** GET /expedientes/:animal_id — { animal, consultas, aplicaciones } */
async function obtenerExpediente(req, res) {
  const animalId = Number(req.params.animal_id);
  const animal = await modelo.animal(animalId);
  if (!animal) throw AppError.noEncontrado('El animal no existe.');
  const [consultas, aplicaciones] = await Promise.all([
    modelo.listarConsultas({ animal_id: animalId }),
    modelo.listarAplicacionesDeAnimal(animalId),
  ]);
  return ok(res, { animal, consultas, aplicaciones });
}

// ================================================================= Consultas

/** GET /consultas — filtros desde, hasta, animal_id, veterinario_id, tipo. */
async function listarConsultas(req, res) {
  return ok(res, await modelo.listarConsultas({
    desde: dia(req.query.desde),
    hasta: dia(req.query.hasta),
    animal_id: req.query.animal_id,
    veterinario_id: req.query.veterinario_id,
    tipo: req.query.tipo,
  }));
}

/** GET /consultas/:id — consulta con sus aplicaciones. */
async function obtenerConsulta(req, res) {
  const consulta = await modelo.obtenerConsulta(Number(req.params.id));
  if (!consulta) throw AppError.noEncontrado('La consulta no existe.');
  return ok(res, { ...consulta, aplicaciones: await modelo.listarAplicacionesDeConsulta(consulta.id) });
}

/**
 * POST /consultas — registrar consulta (solo veterinarios).
 * En UNA transacción:
 *   1. El animal debe existir y estar activo.
 *   2. Se inserta la consulta con el veterinario de la sesión.
 *   3. Se actualiza el estado de salud del animal (y su peso si vino).
 *   4. Cada aplicación del arreglo se registra como en POST /aplicaciones, con su consulta_id.
 *   5. Bitácora.
 */
async function crearConsulta(req, res) {
  const datos = datosValidos(req);
  if (datos.fecha > ahora()) {
    throw AppError.validacion([{ campo: 'fecha', mensaje: 'No se pueden registrar consultas con fecha futura.' }]);
  }

  const consultaId = await db.transaccion(async (conn) => {
    await exigirAnimalActivo(datos.animal_id, conn);
    const id = await modelo.crearConsulta(datos, req.session.usuario.id, conn);
    await modelo.actualizarAnimal(datos.animal_id, datos.estado_salud_resultante, datos.peso_kg, conn);

    const aplicadas = [];
    for (const [indice, aplicacion] of (datos.aplicaciones || []).entries()) {
      // Las aplicaciones de una consulta no llevan fecha propia: usan la de la consulta.
      const guardada = await aplicarProducto(
        req,
        conn,
        { ...aplicacion, animal_id: datos.animal_id, fecha_aplicacion: datos.fecha },
        { consultaId: id, prefijo: `aplicaciones[${indice}].` }
      );
      aplicadas.push(guardada);
    }

    await registrar(
      req,
      bitacora.ACCIONES.CREAR,
      'consulta_clinica',
      id,
      {
        animal_id: datos.animal_id,
        fecha: datos.fecha,
        tipo: datos.tipo,
        motivo: datos.motivo,
        estado_salud: datos.estado_salud_resultante,
        aplicaciones: aplicadas,
      },
      conn
    );
    return id;
  });

  return creado(res, { id: consultaId }, 'Consulta registrada.');
}

// ============================================================== Aplicaciones

/** GET /aplicaciones — historial con filtros desde, hasta, animal_id, tipo_insumo. */
async function listarAplicaciones(req, res) {
  return ok(res, await modelo.listarAplicaciones({
    desde: dia(req.query.desde),
    hasta: dia(req.query.hasta),
    animal_id: req.query.animal_id,
    tipo_insumo: req.query.tipo_insumo,
  }));
}

/** GET /aplicaciones/pendientes?dias=15 — dosis vencidas y próximas. */
async function dosisPendientes(req, res) {
  // req.query llega como texto; dias=0 es válido y muestra solo las vencidas.
  const dias = Number(req.query.dias ?? DIAS_PENDIENTES);
  return ok(res, await modelo.listarDosisPendientes(dias));
}

/**
 * POST /aplicaciones — aplicación sin consulta (vacunación de rutina). Solo veterinarios.
 * El movimiento de salida y el descuento de existencia los hace `aplicarProducto`.
 */
async function registrarAplicacion(req, res) {
  const datos = datosValidos(req);
  if (datos.fecha_aplicacion > ahora()) {
    throw AppError.validacion([{ campo: 'fecha_aplicacion', mensaje: 'No se pueden registrar aplicaciones con fecha futura.' }]);
  }

  const aplicacion = await db.transaccion(async (conn) => {
    await exigirAnimalActivo(datos.animal_id, conn);
    const guardada = await aplicarProducto(req, conn, datos);
    await registrar(
      req,
      bitacora.ACCIONES.CREAR,
      'aplicacion_clinica',
      guardada.id,
      { animal_id: datos.animal_id, insumo: guardada.insumo, dosis: guardada.dosis, via: datos.via, proxima_dosis: guardada.proxima_dosis },
      conn
    );
    return guardada;
  });

  return creado(res, { id: aplicacion.id }, 'Aplicación registrada y descontada del inventario.');
}

// ================================================================== Reportes

/** GET /reportes/atenciones — consultas por veterinario y tipo, más sus aplicaciones. */
async function reporteAtenciones(req, res) {
  return ok(res, await modelo.reporteAtenciones(rango(req)));
}

/** GET /reportes/consumo — entradas, salidas y mermas por producto, con su existencia actual. */
async function reporteConsumo(req, res) {
  const filas = await modelo.reporteConsumo(rango(req));
  return ok(res, filas.map((f) => ({
    ...f,
    entradas: redondear2(f.entradas),
    salidas: redondear2(f.salidas),
    mermas: redondear2(f.mermas),
    stock_actual: redondear2(f.stock_actual),
    stock_minimo: redondear2(f.stock_minimo),
  })));
}

/** GET /reportes/vacunacion — vacunas aplicadas en el periodo. */
async function reporteVacunacion(req, res) {
  return ok(res, await modelo.reporteVacunacion(rango(req)));
}

module.exports = {
  listarExpedientes, obtenerExpediente,
  listarConsultas, obtenerConsulta, crearConsulta,
  listarAplicaciones, dosisPendientes, registrarAplicacion,
  reporteAtenciones, reporteConsumo, reporteVacunacion,
};
