/**
 * Controlador de cotización, compras web, ventas en taquilla, validación de
 * ingreso y reportes.
 *
 * Toda la lógica del descuento y de la fecha de visita vive en la función
 * interna `calcularCotizacion()`: la usan las tres rutas que cobran (cotizar,
 * compra web y venta en taquilla) para que el total siempre se calcule igual.
 *
 * Reglas de negocio y contrato: docs/api/entradas.md
 */
const crypto = require('crypto');
const db = require('../../config/db');
const m = require('./ventas.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../../core/bitacora/bitacora.service');

const MODULO = 'entradas';
const DIAS_COMPRA = 60;

const registrar = (req, accion, tabla, registroId, detalle, conn) =>
  bitacora.registrar(req, { modulo: MODULO, accion, tabla, registroId, detalle }, conn);

// ============================================================== Utilidades
/** Fecha de hoy en Guatemala (UTC-6) como AAAA-MM-DD. */
const hoy = (desplazamientoDias = 0) =>
  new Date(Date.now() - 6 * 3600 * 1000 + desplazamientoDias * 86400000).toISOString().slice(0, 10);

/** Redondea a dos decimales (los montos son quetzales). */
const dinero = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Day of week 0=domingo … 1=lunes. */
const diaDeSemana = (fecha) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

/** Código QR de una entrada: 32 caracteres hex. */
const nuevoQr = () => crypto.randomBytes(16).toString('hex');

/** 'MS-000123' a partir del id de la compra. */
const codigoCompra = (id) => `MS-${String(id).padStart(6, '0')}`;

/** Provisional mientras la fila todavía no tiene id. `compra.codigo` es único. */
const codigoTemporal = () => `T${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

/** Autorización simulada de la tarjeta. Nunca se guarda el número completo. */
const referenciaPago = (numero = null) => {
  const auto = `AUT-${crypto.randomInt(100000, 1000000)}`;
  return numero ? `${auto} ****${String(numero).slice(-4)}` : auto;
};

/** La tarjeta ya no sirve si su mes/año ya pasó (vencimiento en formato MM/AA). */
function tarjetaVencida(vencimiento) {
  const [mes, anio] = String(vencimiento).split('/').map(Number);
  const anual = 2000 + anio;
  const hoyG = new Date(Date.now() - 6 * 3600 * 1000);
  const anioActual = hoyG.getUTCFullYear();
  const mesActual = hoyG.getUTCMonth() + 1;
  return anual < anioActual || (anual === anioActual && mes < mesActual);
}

/** 'AAAA-MM-DD' -> 'sábado 4 de octubre de 2026' */
function fechaLarga(fecha) {
  return new Date(`${String(fecha).slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-GT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** 'AAAA-MM-DD' -> 'DD/MM/AAAA' */
const fechaCorta = (f) => String(f).slice(0, 10).split('-').reverse().join('/');

/**
 * Reglas de la fecha de visita: no antes de hoy, no más de hoy + 60 días
 * (RN-ENT-01) y nunca en lunes porque el zoológico está cerrado.
 */
function exigirFechaVisita(fecha_visita) {
  if (fecha_visita < hoy()) throw AppError.validacion([{ campo: 'fecha_visita', mensaje: 'La fecha de visita ya pasó.' }]);
  if (fecha_visita > hoy(DIAS_COMPRA)) {
    throw AppError.validacion([{ campo: 'fecha_visita', mensaje: `Solo se pueden comprar entradas con ${DIAS_COMPRA} días de anticipación.` }]);
  }
  if (diaDeSemana(fecha_visita) === 1) {
    throw AppError.validacion([{ campo: 'fecha_visita', mensaje: 'Los lunes el zoológico está cerrado.' }]);
  }
}

// ============================================================== Cotización
/**
 * Calcula el total de una compra aplicando las reglas de promociones.
 * Única fuente del precio: el navegador nunca manda el total.
 * La usan las tres rutas que cobran (cotizar, compra web y venta en taquilla),
 * que en el contrato se llama `cotizar()`.
 *
 * Reglas (docs/api/entradas.md → "Promociones"):
 *   1. La promoción se compara con la fecha de VISITA, no con la de compra.
 *   2. Con cupón, solo aplica si el código coincide.
 *   3. tipo_entrada_id NULL aplica a todas las líneas.
 *   4. cantidad_minima se contrasta contra el total de entradas (promo general)
 *      o contra la cantidad de ese tipo (promo de un tipo).
 *   5. Si varias aplican a una línea gana la de mayor porcentaje: no se acumulan.
 *   6. descuento = cantidad x precio x porcentaje / 100; subtotal = bruto - descuento.
 *
 * @returns {Promise<object>} objeto cotización
 */
async function calcularCotizacion(fecha_visita, items, codigo, conn = db) {
  // Las tres rutas que cobran pasan por aquí, así que la fecha se revisa una sola vez.
  exigirFechaVisita(fecha_visita);

  // --- Tipos de entrada: todos deben existir y estar activos (422 si no).
  const pedidos = new Map();
  items.forEach((i) => pedidos.set(Number(i.tipo_entrada_id), (pedidos.get(Number(i.tipo_entrada_id)) || 0) + Number(i.cantidad)));
  const tipos = await conn.query(
    `SELECT id, nombre, precio FROM tipo_entrada WHERE activo = 1 AND id IN (${[...pedidos.keys()].map(() => '?').join(',')})`,
    [...pedidos.keys()]
  );
  const porId = new Map(tipos.map((t) => [t.id, t]));
  const faltantes = [...pedidos.keys()].filter((id) => !porId.has(id));
  if (faltantes.length) {
    throw AppError.validacion([
      { campo: 'items', mensaje: 'Alguno de los tipos de entrada que elegiste ya no está disponible.' },
    ]);
  }

  const promociones = await conn.query(
    `SELECT id, nombre, descuento_porcentaje, tipo_entrada_id, cantidad_minima, codigo
       FROM promocion
      WHERE activa = 1 AND fecha_inicio <= ? AND fecha_fin >= ?`,
    [fecha_visita, fecha_visita]
  );
  const cupon = String(codigo || '').trim().toUpperCase();
  const totalEntradas = [...pedidos.values()].reduce((s, n) => s + n, 0);

  /** ¿Le toca a esta línea? (reglas 2, 3 y 4) */
  const aplica = (p, tipoId, cantidad) => {
    if (p.tipo_entrada_id != null && Number(p.tipo_entrada_id) !== Number(tipoId)) return false;
    if (p.codigo && p.codigo.toUpperCase() !== cupon) return false;
    const minimo = p.tipo_entrada_id == null ? totalEntradas : cantidad;
    return minimo >= Number(p.cantidad_minima);
  };

  // --- Una línea por tipo pedido, con la promoción que más descuento da (regla 5).
  let cuponAplicado = null;
  const lineas = [...pedidos.entries()].map(([tipoId, cantidad]) => {
    const tipo = porId.get(tipoId);
    const candidatas = promociones.filter((p) => aplica(p, tipoId, cantidad));
    const elegida = candidatas.sort((a, b) => Number(b.descuento_porcentaje) - Number(a.descuento_porcentaje))[0] || null;
    const bruto = dinero(cantidad * Number(tipo.precio));
    const descuento = elegida ? dinero((bruto * Number(elegida.descuento_porcentaje)) / 100) : 0;
    if (elegida?.codigo) cuponAplicado = elegida;
    return {
      tipo_entrada_id: tipoId,
      tipo_entrada: tipo.nombre,
      cantidad,
      precio_unitario: dinero(tipo.precio),
      promocion_id: elegida ? elegida.id : null,
      promocion: elegida ? elegida.nombre : null,
      descuento,
      subtotal: dinero(bruto - descuento),
    };
  });

  const subtotal = dinero(lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0));
  const descuento = dinero(lineas.reduce((s, l) => s + l.descuento, 0));

  // --- Respuesta del cupón: inválido no es error, la cotización sigue siendo 200.
  let aviso = null;
  if (cupon) {
    const promo = promociones.find((p) => p.codigo && p.codigo.toUpperCase() === cupon);
    if (!promo) {
      aviso = { codigo: cupon, valido: false, mensaje: 'El cupón no existe o no está vigente para la fecha de visita.' };
    } else if (cuponAplicado && cuponAplicado.id === promo.id) {
      aviso = { codigo: cupon, valido: true, mensaje: `Cupón aplicado: ${promo.nombre} (${Number(promo.descuento_porcentaje)} %).` };
    } else {
      const motivo = totalEntradas < Number(promo.cantidad_minima) && promo.tipo_entrada_id == null
        ? `Necesitas al menos ${promo.cantidad_minima} entradas para usar este cupón.`
        : 'Ya tienes un descuento mayor; el cupón no se acumula.';
      aviso = { codigo: cupon, valido: true, mensaje: motivo };
    }
  }

  return { fecha_visita, lineas, subtotal, descuento, total: dinero(subtotal - descuento), cupon: aviso };
}

// ============================================================ Portal público
/** POST /api/publico/entradas/cotizar y POST /api/entradas/cotizar */
async function cotizar(req, res) {
  const d = datosValidos(req);
  return ok(res, await calcularCotizacion(d.fecha_visita, d.items, d.codigo_promocion));
}

/** POST /api/publico/entradas/compras — compra web del visitante. */
async function compraWeb(req, res) {
  const d = datosValidos(req);

  if (tarjetaVencida(d.pago.vencimiento)) {
    throw AppError.validacion([{ campo: 'pago.vencimiento', mensaje: 'La tarjeta está vencida.' }]);
  }
  const cotizacion = await calcularCotizacion(d.fecha_visita, d.items, d.codigo_promocion);

  const venta = await db.transaccion(async (conn) => {
    const cliente = await m.clientePorCorreo(d.cliente.correo);
    let clienteId;
    if (cliente) {
      clienteId = cliente.id;
      await m.actualizarCliente(cliente.id, d.cliente, conn);
    } else {
      clienteId = (await m.crearCliente(d.cliente, conn)).insertId;
    }

    const id = await m.insertarCompra(
      {
        codigo: codigoTemporal(), canal: 'web', cliente_id: clienteId, vendedor_id: null,
        fecha_visita: d.fecha_visita,
        subtotal: cotizacion.subtotal, descuento: cotizacion.descuento, total: cotizacion.total,
        metodo_pago: 'tarjeta', referencia_pago: referenciaPago(d.pago.numero),
      },
      conn
    );
    await m.actualizarCodigoCompra(id, codigoCompra(id), conn);
    const entradas = await crearEntradas(id, cotizacion.lineas, conn);
    await registrar(req, bitacora.ACCIONES.CREAR, 'compra', id,
      { canal: 'web', total: cotizacion.total, entradas: entradas.length }, conn);
    return { id, entradas };
  });

  const completa = await m.ventaPorId(venta.id);
  completa.detalle = await m.detalle(venta.id);
  completa.entradas = venta.entradas;
  return creado(res, completa, `Compra registrada con el código ${completa.codigo}.`);
}

/** Inserta el detalle y un boleto por unidad. Devuelve los boletos creados. */
async function crearEntradas(compraId, lineas, conn) {
  const boletos = [];
  for (const linea of lineas) {
    const detalleId = await m.insertarDetalle({ compra_id: compraId, ...linea }, conn);
    for (let i = 0; i < linea.cantidad; i++) {
      const codigo_qr = nuevoQr();
      await m.insertarEntrada(detalleId, codigo_qr, conn);
      boletos.push({ codigo_qr, tipo_entrada: linea.tipo_entrada });
    }
  }
  return boletos;
}

/** GET /api/publico/entradas/compras/consulta — "Mis entradas". */
async function consultarCompra(req, res) {
  const { codigo, correo } = req.query;
  const compra = await m.ventaPorCodigoYCorreo(codigo, correo);
  if (!compra) throw AppError.noEncontrado('No encontramos una compra con esos datos.');
  return ok(res, await conEntradas(compra));
}

// ================================================================ Taquilla
/** POST /api/entradas/ventas — venta en ventanilla. */
async function ventaTaquilla(req, res) {
  const d = datosValidos(req);
  const cotizacion = await calcularCotizacion(d.fecha_visita, d.items, d.codigo_promocion);

  const id = await db.transaccion(async (conn) => {
    // El cliente es opcional en taquilla: sin datos queda como consumidor final.
    let clienteId = null;
    if (d.cliente?.nombre) {
      clienteId = (await m.crearCliente({ ...d.cliente, correo: null }, conn)).insertId;
    }

    const nuevaId = await m.insertarCompra(
      {
        codigo: codigoTemporal(), canal: 'taquilla', cliente_id: clienteId, vendedor_id: req.session.usuario.id,
        fecha_visita: d.fecha_visita,
        subtotal: cotizacion.subtotal, descuento: cotizacion.descuento, total: cotizacion.total,
        metodo_pago: d.metodo_pago,
        referencia_pago: d.metodo_pago === 'tarjeta' ? referenciaPago() : null,
      },
      conn
    );
    await m.actualizarCodigoCompra(nuevaId, codigoCompra(nuevaId), conn);
    await crearEntradas(nuevaId, cotizacion.lineas, conn);
    await registrar(req, bitacora.ACCIONES.CREAR, 'compra', nuevaId,
      { canal: 'taquilla', total: cotizacion.total, metodo_pago: d.metodo_pago }, conn);
    return nuevaId;
  });

  const venta = await m.ventaPorId(id);
  venta.detalle = await m.detalle(id);
  venta.entradas = await m.entradas(id);
  return creado(res, venta, `Venta ${venta.codigo} registrada.`);
}

// =================================================================== Ventas
/** GET /api/entradas/ventas */
async function listarVentas(req, res) {
  return ok(res, await m.listarVentas(req.query));
}

/** GET /api/entradas/ventas/:id */
async function obtenerVenta(req, res) {
  const venta = await m.ventaPorId(req.params.id);
  if (!venta) throw AppError.noEncontrado('La venta no existe.');
  return ok(res, await conEntradas(venta));
}

/** Objeto venta completo: encabezado + detalle + boletos. */
async function conEntradas(venta) {
  return { ...venta, detalle: await m.detalle(venta.id), entradas: await m.entradas(venta.id) };
}

/** PATCH /api/entradas/ventas/:id/anular */
async function anularVenta(req, res) {
  const { id } = req.params;
  const { motivo } = datosValidos(req);
  const venta = await m.ventaPorId(id);
  if (!venta) throw AppError.noEncontrado('La venta no existe.');
  if (venta.estado === 'anulada') throw AppError.conflicto('La venta ya está anulada.');

  // RN-ENT-07: si alguien ya ingresó con alguna de sus entradas, la venta no se anula.
  const usadas = await m.contarEntradasUsadas(id);
  if (usadas > 0) {
    throw AppError.conflicto(`No se puede anular: ${usadas} ${usadas === 1 ? 'entrada ya ingresó' : 'entradas ya ingresaron'} al zoológico.`);
  }

  await db.transaccion(async (conn) => {
    await m.anularCompra(id, motivo, req.session.usuario.id, conn);
    await m.anularEntradas(id, conn);
    await registrar(req, bitacora.ACCIONES.ELIMINAR, 'compra', id, { motivo }, conn);
  });

  const actualizada = await m.ventaPorId(id);
  return ok(res, await conEntradas(actualizada), `Venta ${actualizada.codigo} anulada.`);
}

// ============================================================ Validación
/** POST /api/entradas/validar — siempre 200: rechazar no es un error del sistema. */
async function validar(req, res) {
  const { codigo_qr } = datosValidos(req);
  const e = await m.buscarEntrada(codigo_qr);

  const responder = (resultado, mensaje, entrada = null) => ok(res, { resultado, mensaje, entrada });

  if (!e) return responder('no_existe', 'El código no pertenece a ninguna entrada.');

  const info = {
    codigo_qr: e.codigo_qr,
    tipo_entrada: e.tipo_entrada,
    fecha_visita: e.fecha_visita,
    compra_codigo: e.compra_codigo,
    cliente: e.cliente,
    estado: e.estado,
    fecha_uso: e.fecha_uso,
  };

  if (e.estado === 'anulada' || e.compra_estado === 'anulada') {
    return responder('anulada', 'Esta entrada fue anulada y no es válida.', info);
  }
  if (e.estado === 'usada') {
    return responder('usada', `Esta entrada ya ingresó el ${fechaCorta(e.fecha_uso)} a las ${String(e.fecha_uso).slice(11, 16)}.`, info);
  }
  if (e.fecha_visita !== hoy()) {
    const vencida = e.fecha_visita < hoy();
    return responder(
      'otra_fecha',
      vencida ? `Esta entrada venció el ${fechaCorta(e.fecha_visita)}.` : `Esta entrada es para el ${fechaLarga(e.fecha_visita)}.`,
      info
    );
  }

  // Solo aquí se marca como usada. El affectedRows evita que dos lectores
  // al mismo tiempo dejen pasar la misma entrada.
  const marcada = await db.transaccion(async (conn) => {
    const exito = await m.marcarEntradaUsada(e.id, req.session.usuario.id, conn);
    if (exito) await registrar(req, bitacora.ACCIONES.ACTUALIZAR, 'entrada', e.id, { compra: e.compra_codigo }, conn);
    return exito;
  });

  if (!marcada) return responder('usada', 'Esta entrada acaba de ser utilizada por otro lector.');

  // Se vuelve a leer para mostrar la hora que puso la base, no la del servidor.
  const guardada = await m.buscarEntrada(codigo_qr);
  const hora = String(guardada.fecha_uso).slice(11, 16);
  return responder('valida', `Bienvenido. Entrada ${e.tipo_entrada} registrada a las ${hora}.`, {
    ...info,
    estado: guardada.estado,
    fecha_uso: guardada.fecha_uso,
  });
}

/** GET /api/entradas/ingresos/hoy */
async function ingresosHoy(req, res) {
  const resumen = await m.resumenIngresosHoy();
  const entradas_del_dia = Number(resumen?.entradas_del_dia || 0);
  const ingresados = Number(resumen?.ingresados || 0);
  return ok(res, {
    entradas_del_dia,
    ingresados,
    pendientes: entradas_del_dia - ingresados,
    ultimos: await m.ultimasValidaciones(10),
  });
}

// ================================================================= Reportes
/** GET /api/entradas/reportes/ventas-diarias */
async function reporteVentasDiarias(req, res) {
  return ok(res, await m.reporteVentasDiarias(req.query));
}

/** GET /api/entradas/reportes/por-tipo */
async function reportePorTipo(req, res) {
  const filas = await m.reportePorTipo(req.query);
  const total = filas.reduce((s, f) => s + Number(f.total || 0), 0);
  return ok(res, filas.map((f) => ({
    ...f,
    porcentaje: total ? Math.round((Number(f.total) / total) * 1000) / 10 : 0,
  })));
}

/** GET /api/entradas/reportes/promociones */
async function reportePromociones(req, res) {
  return ok(res, await m.reportePromociones(req.query));
}

module.exports = {
  calcularCotizacion,
  cotizar,
  compraWeb,
  consultarCompra,
  ventaTaquilla,
  listarVentas,
  obtenerVenta,
  anularVenta,
  validar,
  ingresosHoy,
  reporteVentasDiarias,
  reportePorTipo,
  reportePromociones,
};