/**
 * Rutas del módulo de Alimentación.  Base: /api/alimentacion
 * El núcleo ya exige sesión y el permiso `alimentacion.ver` antes de llegar aquí.
 * Documentación: docs/api/alimentacion.md
 */
const { Router } = require('express');
const { body } = require('express-validator');
const validar = require('../../middlewares/validar');
const { requierePermiso } = require('../../middlewares/auth');
const r = require('../../utils/reglas');
const { CATEGORIAS_ALIMENTO, UNIDADES_ALIMENTO, ESTADOS_LOTE, ALERTAS_ALIMENTO, ESTADOS_DIETA, DIAS } = require('./constantes');
const alimentos = require('./alimentos.controller');
const lotes = require('./lotes.controller');
const proveedores = require('./proveedores.controller');
const dietas = require('./dietas.controller');
const horarios = require('./horarios.controller');
const db = require('../../config/db');
const { ok } = require('../../utils/respuesta');

const router = Router();
const verInventario = requierePermiso('alimentacion.inventario.ver');
const gestionarInventario = requierePermiso('alimentacion.inventario.gestionar');
const verDietas = requierePermiso('alimentacion.dietas.ver');
const gestionarDietas = requierePermiso('alimentacion.dietas.gestionar');
const verHorarios = requierePermiso('alimentacion.horarios.ver');
const gestionarHorarios = requierePermiso('alimentacion.horarios.gestionar');

/** GET /alimentos/opciones — lista corta para los selectores de cualquier pantalla del módulo. */
router.get('/alimentos/opciones', async (_req, res) => {
  ok(res, await db.query('SELECT id, nombre, categoria, unidad_medida, activo FROM alimento ORDER BY nombre'));
});

// ================================================================ Alimentos
const reglasAlimento = [
  r.texto('nombre', { max: 100 }),
  r.enumerado('categoria', CATEGORIAS_ALIMENTO),
  r.enumerado('unidad_medida', UNIDADES_ALIMENTO),
  r.decimal('stock_minimo', { min: 0, max: 9999999 }),
  r.entero('dias_aviso_vencimiento', { min: 0, max: 365 }),
  r.texto('descripcion', { max: 255, opcional: true }),
];

router.get('/alimentos', verInventario, validar([
  r.filtroTexto('buscar'), r.filtroEnum('categoria', CATEGORIAS_ALIMENTO), r.filtroEnum('alerta', ALERTAS_ALIMENTO), r.filtroActivo(),
]), alimentos.listar);
router.get('/alimentos/alertas', verInventario, alimentos.alertas);
router.get('/alimentos/:id', verInventario, validar([r.idParam()]), alimentos.obtener);
router.get('/alimentos/:id/movimientos', verInventario, validar([r.idParam(), r.filtroFecha('desde'), r.filtroFecha('hasta')]), alimentos.movimientos);
router.post('/alimentos', gestionarInventario, validar(reglasAlimento), alimentos.crear);
router.put('/alimentos/:id', gestionarInventario, validar([r.idParam(), ...reglasAlimento]), alimentos.actualizar);
router.patch('/alimentos/:id/estado', gestionarInventario, validar([r.idParam(), r.booleano('activo')]), alimentos.cambiarEstado);

// ==================================================================== Lotes
const reglasDocumento = [
  r.id('proveedor_id', { mensaje: 'Selecciona el proveedor.' }),
  r.texto('numero_lote', { max: 40, mensaje: 'Escribe el número de lote.' }),
  r.texto('numero_factura', { max: 40, opcional: true }),
  r.fecha('fecha_ingreso'),
  r.fecha('fecha_vencimiento', { opcional: true }),
  r.decimal('costo_unitario', { min: 0, max: 99999999, opcional: true }),
  r.texto('observaciones', { max: 255, opcional: true }),
];

router.get('/lotes', verInventario, validar([
  r.filtroId('alimento_id'), r.filtroId('proveedor_id'), r.filtroEnum('estado', [...ESTADOS_LOTE, 'con_existencia']),
  r.filtroFecha('desde'), r.filtroFecha('hasta'), r.filtroTexto('buscar'),
]), lotes.listar);
router.get('/lotes/:id', verInventario, validar([r.idParam()]), lotes.obtener);
router.get('/lotes/:id/movimientos', verInventario, validar([r.idParam()]), lotes.movimientos);
router.post('/lotes', gestionarInventario, validar([
  r.id('alimento_id', { mensaje: 'Selecciona el alimento.' }),
  r.decimal('cantidad', { min: 0.001, max: 9999999 }),
  ...reglasDocumento,
]), lotes.crear);
router.put('/lotes/:id', gestionarInventario, validar([r.idParam(), ...reglasDocumento]), lotes.actualizar);
router.post('/lotes/:id/mermas', gestionarInventario, validar([
  r.idParam(),
  r.decimal('cantidad', { min: 0.001, max: 9999999 }),
  r.texto('motivo', { max: 255, mensaje: 'Indica el motivo de la merma.' }),
]), lotes.registrarMerma);

// ============================================================== Proveedores
const reglasProveedor = [
  r.texto('nombre', { max: 120 }),
  body('nit').optional({ values: 'falsy' }).trim().toUpperCase()
    .matches(/^\d{1,12}-?[\dK]$/).withMessage('Escribe un NIT válido, por ejemplo 1234567-8.'),
  r.texto('contacto', { max: 100, opcional: true }),
  r.texto('telefono', { max: 20, opcional: true }),
  r.correo('correo', { opcional: true }),
  r.texto('direccion', { max: 200, opcional: true }),
];

router.get('/proveedores', verInventario, validar([r.filtroTexto('buscar'), r.filtroActivo()]), proveedores.listar);
router.get('/proveedores/:id', verInventario, validar([r.idParam()]), proveedores.obtener);
router.post('/proveedores', gestionarInventario, validar(reglasProveedor), proveedores.crear);
router.put('/proveedores/:id', gestionarInventario, validar([r.idParam(), ...reglasProveedor]), proveedores.actualizar);
router.patch('/proveedores/:id/estado', gestionarInventario, validar([r.idParam(), r.booleano('activo')]), proveedores.cambiarEstado);

// =================================================================== Dietas
const reglasDieta = [
  r.enumerado('destino', ['especie', 'animal'], { mensaje: 'Indica si la dieta es para una especie o para un animal.' }),
  body('especie_id').if(body('destino').equals('especie')).isInt({ min: 1 }).withMessage('Selecciona la especie.').toInt(),
  body('animal_id').if(body('destino').equals('animal')).isInt({ min: 1 }).withMessage('Selecciona el animal.').toInt(),
  r.id('alimento_id', { mensaje: 'Selecciona el alimento.' }),
  r.decimal('cantidad_racion', { min: 0.001, max: 99999 }),
  r.entero('frecuencia_diaria', { min: 1, max: 12 }),
  r.texto('indicaciones', { max: 255, opcional: true }),
  r.texto('motivo', { max: 255, opcional: true }),
  r.fecha('fecha_inicio'),
  r.fecha('fecha_fin', { opcional: true }),
];

router.get('/dietas', verDietas, validar([
  r.filtroEnum('destino', ['especie', 'animal']), r.filtroId('especie_id'), r.filtroId('animal_id'), r.filtroId('alimento_id'),
  r.filtroEnum('estado', ESTADOS_DIETA), r.filtroTexto('buscar'),
]), dietas.listar);
router.get('/dietas/por-animal', verDietas, validar([
  r.filtroFecha('fecha'), r.filtroId('area_id'), r.filtroId('especie_id'), r.filtroId('animal_id'), r.filtroTexto('buscar'),
]), dietas.porAnimal);
router.get('/dietas/:id', verDietas, validar([r.idParam()]), dietas.obtener);
router.post('/dietas', gestionarDietas, validar(reglasDieta), dietas.crear);
router.put('/dietas/:id', gestionarDietas, validar([r.idParam(), ...reglasDieta]), dietas.actualizar);
router.patch('/dietas/:id/finalizar', gestionarDietas, validar([r.idParam(), r.texto('motivo', { max: 255, opcional: true })]), dietas.finalizar);

// ================================================================= Horarios
const reglasHorario = [
  r.id('area_id', { mensaje: 'Selecciona la jaula.' }),
  r.hora('hora'),
  body('dias').isArray({ min: 1, max: 7 }).withMessage('Elige al menos un día.'),
  body('dias.*').isIn(DIAS).withMessage('Día inválido.'),
  r.id('cuidador_id', { mensaje: 'Selecciona el cuidador responsable.' }),
  r.texto('observaciones', { max: 255, opcional: true }),
];

router.get('/horarios', verHorarios, validar([
  r.filtroId('area_id'), r.filtroId('cuidador_id'), r.filtroEnum('dia', DIAS), r.filtroActivo(),
]), horarios.listar);
router.get('/horarios/cobertura', verHorarios, horarios.cobertura);
router.get('/horarios/:id', verHorarios, validar([r.idParam()]), horarios.obtener);
router.post('/horarios', gestionarHorarios, validar(reglasHorario), horarios.crear);
router.put('/horarios/:id', gestionarHorarios, validar([r.idParam(), ...reglasHorario]), horarios.actualizar);
router.patch('/horarios/:id/estado', gestionarHorarios, validar([r.idParam(), r.booleano('activo')]), horarios.cambiarEstado);

module.exports = router;
