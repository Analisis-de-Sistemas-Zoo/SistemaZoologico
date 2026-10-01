/**
 * Rutas del módulo de Limpieza: /api/limpieza/...
 *
 * El núcleo ya exige sesión y el permiso limpieza.ver para todo el módulo.
 * Aquí se exige el permiso específico de cada acción y se validan los datos.
 * Las reglas de validación ya están completas; Alan solo implementa los controladores.
 */
const { Router } = require('express');
const { body, query } = require('express-validator');
const validar = require('../../middlewares/validar');
const { requierePermiso } = require('../../middlewares/auth');
const r = require('../../utils/reglas');
const tareas = require('./tareas.controller');
const insumos = require('./insumos.controller');
const reportes = require('./reportes.controller');

const router = Router();

const TIPOS_TAREA = ['rutinaria', 'profunda', 'desinfeccion', 'emergencia'];
const ESTADOS_TAREA = ['pendiente', 'en_proceso', 'completada', 'verificada', 'rechazada', 'cancelada'];
const UNIDADES = ['l', 'ml', 'kg', 'g', 'galon', 'unidad'];

const puede = (permiso) => requierePermiso(permiso);
const rango = validar([r.filtroFecha('desde'), r.filtroFecha('hasta')]);

// ================================================================== Tareas
const reglasTarea = [
  r.id('area_id', { mensaje: 'Selecciona el área.' }),
  r.enumerado('tipo', TIPOS_TAREA),
  r.texto('descripcion', { max: 255, opcional: true }),
  r.fecha('fecha_programada'),
  r.hora('hora_programada'),
  r.id('asignado_id', { mensaje: 'Selecciona a quién se asigna.' }),
];

router.get('/tareas', puede('limpieza.tareas.ver'), validar([
  r.filtroFecha('fecha_desde'), r.filtroFecha('fecha_hasta'), r.filtroId('area_id'), r.filtroId('asignado_id'),
  r.filtroEnum('estado', ESTADOS_TAREA), r.filtroEnum('tipo', TIPOS_TAREA),
]), tareas.listar);
router.get('/tareas/:id', puede('limpieza.tareas.ver'), validar([r.idParam()]), tareas.obtener);
router.post('/tareas', puede('limpieza.tareas.programar'), validar(reglasTarea), tareas.crear);
router.put('/tareas/:id', puede('limpieza.tareas.programar'), validar([r.idParam(), ...reglasTarea]), tareas.actualizar);
router.patch('/tareas/:id/cancelar', puede('limpieza.tareas.programar'),
  validar([r.idParam(), r.texto('motivo', { max: 255, mensaje: 'Indica el motivo de la cancelación.' })]), tareas.cancelar);
router.patch('/tareas/:id/verificar', puede('limpieza.tareas.verificar'), validar([
  r.idParam(),
  r.enumerado('resultado', ['verificada', 'rechazada'], { mensaje: 'Indica si la tarea se verifica o se rechaza.' }),
  r.texto('observacion', { max: 500, opcional: true }),
]), tareas.verificar);

// ============================================================= Mis tareas
router.get('/mis-tareas', puede('limpieza.tareas.ejecutar'), validar([r.filtroFecha('fecha')]), tareas.misTareas);
router.patch('/mis-tareas/:id/iniciar', puede('limpieza.tareas.ejecutar'), validar([r.idParam()]), tareas.iniciar);
router.patch('/mis-tareas/:id/completar', puede('limpieza.tareas.ejecutar'), validar([
  r.idParam(),
  r.texto('observaciones', { max: 500, opcional: true }),
  body('insumos').optional().isArray({ max: 20 }).withMessage('Lista de insumos inválida.'),
  body('insumos.*.insumo_limpieza_id').isInt({ min: 1 }).withMessage('Insumo inválido.').toInt(),
  body('insumos.*.cantidad').isFloat({ gt: 0, max: 99999 }).withMessage('La cantidad debe ser mayor a 0.').toFloat(),
]), tareas.completar);

// ================================================================= Insumos
// Listar lo pueden hacer todos los roles del módulo (el personal lo usa al completar tareas).
const reglasInsumo = [
  r.texto('nombre', { max: 100 }),
  r.enumerado('unidad_medida', UNIDADES),
  r.decimal('stock_minimo', { min: 0, max: 99999999 }),
  r.texto('descripcion', { max: 255, opcional: true }),
];
router.get('/insumos', validar([r.filtroTexto('buscar'), r.filtroActivo(), query('bajo_minimo').optional().isIn(['0', '1'])]), insumos.listar);
router.get('/insumos/:id', validar([r.idParam()]), insumos.obtener);
router.post('/insumos', puede('limpieza.insumos.gestionar'),
  validar([...reglasInsumo, r.decimal('stock_actual', { min: 0, max: 99999999, opcional: true })]), insumos.crear);
router.put('/insumos/:id', puede('limpieza.insumos.gestionar'), validar([r.idParam(), ...reglasInsumo]), insumos.actualizar);
router.patch('/insumos/:id/estado', puede('limpieza.insumos.gestionar'), validar([r.idParam(), r.booleano('activo')]), insumos.cambiarEstado);
router.get('/insumos/:id/movimientos', puede('limpieza.insumos.ver'), validar([r.idParam()]), insumos.movimientos);
router.post('/insumos/:id/movimientos', puede('limpieza.insumos.gestionar'), validar([
  r.idParam(),
  r.enumerado('tipo', ['entrada', 'merma']),
  r.decimal('cantidad', { min: 0.01, max: 99999 }),
  r.texto('motivo', { max: 255, opcional: true }),
]), insumos.registrarMovimiento);

// ================================================================ Reportes
router.get('/reportes/cumplimiento', puede('limpieza.reportes.ver'), rango, reportes.cumplimiento);
router.get('/reportes/consumo-insumos', puede('limpieza.reportes.ver'), rango, reportes.consumoInsumos);
router.get('/reportes/personal', puede('limpieza.reportes.ver'), rango, reportes.personal);

module.exports = router;
