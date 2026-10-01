/**
 * Rutas del módulo de Entradas y Promociones.
 *
 *   router         /api/entradas/...          personal (exige sesión y entradas.ver)
 *   routerPublico  /api/publico/entradas/...  portal de visitantes (SIN sesión)
 *
 * Las reglas de validación están completas; Mario implementa ventas.controller.js.
 */
const { Router } = require('express');
const { body, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validar = require('../../middlewares/validar');
const { requierePermiso } = require('../../middlewares/auth');
const r = require('../../utils/reglas');
const { tipo, promocion, publico } = require('./catalogo.controller');
const v = require('./ventas.controller');

const VIGENCIAS = ['vigente', 'programada', 'vencida', 'inactiva'];

/** Entradas solicitadas: [{ tipo_entrada_id, cantidad }] */
const reglasItems = [
  r.fecha('fecha_visita'),
  body('items').isArray({ min: 1, max: 10 }).withMessage('Elige al menos un tipo de entrada.'),
  body('items.*.tipo_entrada_id').isInt({ min: 1 }).withMessage('Tipo de entrada inválido.').toInt(),
  body('items.*.cantidad').isInt({ min: 1, max: 50 }).withMessage('La cantidad debe estar entre 1 y 50.').toInt(),
  body('codigo_promocion').optional({ values: 'falsy' }).isString().trim().toUpperCase().isLength({ max: 20 }).withMessage('Cupón inválido.'),
];

const reglaNit = (campo) =>
  body(campo).optional({ values: 'falsy' }).trim().toUpperCase()
    .matches(/^(CF|\d{1,12}-?[\dK])$/).withMessage('Escribe CF o un NIT válido.');

// ============================================================ Portal público
const routerPublico = Router();

const limiteCompras = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' },
});

routerPublico.get('/tipos', publico.tipos);
routerPublico.get('/promociones', publico.promociones);
routerPublico.post('/cotizar', validar(reglasItems), v.cotizar);
routerPublico.post('/compras', limiteCompras, validar([
  ...reglasItems,
  r.texto('cliente.nombre', { max: 120, mensaje: 'Escribe tu nombre.' }),
  r.correo('cliente.correo'),
  r.texto('cliente.telefono', { max: 20, opcional: true }),
  reglaNit('cliente.nit'),
  // Pago simulado: se validan los datos pero NUNCA se guardan (solo los últimos 4 dígitos como referencia).
  r.texto('pago.titular', { min: 3, max: 120, mensaje: 'Escribe el nombre que aparece en la tarjeta.' }),
  body('pago.numero').customSanitizer((v) => String(v || '').replace(/\D/g, ''))
    .isLength({ min: 13, max: 19 }).withMessage('El número de tarjeta no es válido.'),
  body('pago.vencimiento').matches(/^(0[1-9]|1[0-2])\/\d{2}$/).withMessage('Usa el formato MM/AA.'),
  body('pago.cvv').matches(/^\d{3,4}$/).withMessage('Código de seguridad inválido.'),
]), v.compraWeb);
routerPublico.get('/compras/consulta', limiteCompras, validar([
  query('codigo').trim().toUpperCase().matches(/^MS-\d{6}$/).withMessage('Escribe el número de compra, por ejemplo MS-000123.'),
  query('correo').trim().toLowerCase().isEmail().withMessage('Escribe el correo con el que compraste.'),
]), v.consultarCompra);

// ================================================================== Personal
const router = Router();
const puede = (permiso) => requierePermiso(permiso);
const rango = validar([r.filtroFecha('desde'), r.filtroFecha('hasta')]);

// Tipos de entrada ✅
const reglasTipo = [
  r.texto('nombre', { max: 60 }),
  r.texto('descripcion', { max: 200, opcional: true }),
  r.decimal('precio', { min: 0, max: 9999 }),
];
router.get('/tipos', validar([r.filtroActivo()]), tipo.listar);
router.post('/tipos', puede('entradas.configurar'), validar(reglasTipo), tipo.crear);
router.put('/tipos/:id', puede('entradas.configurar'), validar([r.idParam(), ...reglasTipo]), tipo.actualizar);
router.patch('/tipos/:id/estado', puede('entradas.configurar'), validar([r.idParam(), r.booleano('activo')]), tipo.cambiarEstado);

// Promociones ✅
const reglasPromocion = [
  r.texto('nombre', { max: 100 }),
  r.texto('descripcion', { max: 255, opcional: true }),
  r.decimal('descuento_porcentaje', { min: 0.01, max: 100 }),
  r.id('tipo_entrada_id', { opcional: true }),
  r.entero('cantidad_minima', { min: 1, max: 50 }),
  body('codigo').optional({ values: 'falsy' }).trim().toUpperCase()
    .matches(/^[A-Z0-9-]{3,20}$/).withMessage('De 3 a 20 letras, números o guiones.'),
  r.fecha('fecha_inicio'),
  r.fecha('fecha_fin'),
  r.booleano('publicada'),
];
router.get('/promociones', validar([r.filtroTexto('buscar'), r.filtroEnum('vigencia', VIGENCIAS)]), promocion.listar);
router.post('/promociones', puede('entradas.configurar'), validar(reglasPromocion), promocion.crear);
router.put('/promociones/:id', puede('entradas.configurar'), validar([r.idParam(), ...reglasPromocion]), promocion.actualizar);
router.patch('/promociones/:id/estado', puede('entradas.configurar'), validar([r.idParam(), r.booleano('activo')]), promocion.cambiarEstado);

// Venta en taquilla ⏳
router.post('/cotizar', puede('entradas.vender'), validar(reglasItems), v.cotizar);
router.post('/ventas', puede('entradas.vender'), validar([
  ...reglasItems,
  r.enumerado('metodo_pago', ['efectivo', 'tarjeta']),
  r.texto('cliente.nombre', { max: 120, opcional: true }),
  reglaNit('cliente.nit'),
]), v.ventaTaquilla);

// Ventas ⏳
router.get('/ventas', puede('entradas.ventas.ver'), validar([
  r.filtroFecha('desde'), r.filtroFecha('hasta'), r.filtroEnum('canal', ['web', 'taquilla']),
  r.filtroEnum('estado', ['pagada', 'anulada']), r.filtroTexto('buscar'),
]), v.listarVentas);
router.get('/ventas/:id', puede('entradas.ventas.ver'), validar([r.idParam()]), v.obtenerVenta);
router.patch('/ventas/:id/anular', puede('entradas.ventas.anular'),
  validar([r.idParam(), r.texto('motivo', { max: 255, mensaje: 'Indica el motivo de la anulación.' })]), v.anularVenta);

// Validación de ingreso ⏳
router.post('/validar', puede('entradas.validar'), validar([
  body('codigo_qr').isString().trim().toLowerCase().matches(/^[a-f0-9]{32}$/).withMessage('El código no es válido.'),
]), v.validar);
router.get('/ingresos/hoy', puede('entradas.validar'), v.ingresosHoy);

// Reportes ⏳
router.get('/reportes/ventas-diarias', puede('entradas.reportes.ver'), rango, v.reporteVentasDiarias);
router.get('/reportes/por-tipo', puede('entradas.reportes.ver'), rango, v.reportePorTipo);
router.get('/reportes/promociones', puede('entradas.reportes.ver'), rango, v.reportePromociones);

module.exports = { router, routerPublico };
