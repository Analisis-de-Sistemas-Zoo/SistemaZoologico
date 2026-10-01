/**
 * Rutas del módulo de Control Clínico: /api/clinico/...
 *
 * El núcleo ya exige sesión y el permiso clinico.ver para todo el módulo.
 * Las reglas de validación están completas; Daniela implementa los controladores.
 */
const { Router } = require('express');
const { body, query } = require('express-validator');
const validar = require('../../middlewares/validar');
const { requierePermiso } = require('../../middlewares/auth');
const r = require('../../utils/reglas');
const E = require('../../config/catalogos');
const c = require('./clinico.controller');
const inventario = require('./inventario.controller');

const router = Router();

const TIPOS_INSUMO = ['medicamento', 'vacuna', 'vitamina'];
const UNIDADES = ['ml', 'mg', 'g', 'tableta', 'dosis', 'unidad'];
const VIAS = ['oral', 'intramuscular', 'subcutanea', 'intravenosa', 'topica', 'inhalada', 'otra'];
const TIPOS_CONSULTA = ['rutina', 'emergencia', 'seguimiento', 'ingreso'];

const registrar = requierePermiso('clinico.registrar');
const gestionar = requierePermiso('clinico.inventario.gestionar');
const reportes = requierePermiso('clinico.reportes.ver');
const rango = validar([r.filtroFecha('desde'), r.filtroFecha('hasta')]);

/** Reglas de una aplicación; `prefijo` permite validarlas dentro del arreglo de una consulta. */
const reglasAplicacion = (prefijo = '') => [
  r.id(`${prefijo}insumo_clinico_id`, { mensaje: 'Selecciona el medicamento, vacuna o vitamina.' }),
  r.decimal(`${prefijo}dosis`, { min: 0.01, max: 99999 }),
  r.enumerado(`${prefijo}via`, VIAS, { mensaje: 'Selecciona la vía de aplicación.' }),
  r.fecha(`${prefijo}proxima_dosis`, { opcional: true }),
  r.texto(`${prefijo}observaciones`, { max: 255, opcional: true }),
];

// =============================================================== Expedientes
router.get('/expedientes', validar([
  r.filtroTexto('buscar'), r.filtroId('especie_id'), r.filtroEnum('estado_salud', E.ESTADOS_SALUD),
]), c.listarExpedientes);
router.get('/expedientes/:animal_id', validar([r.idParam('animal_id')]), c.obtenerExpediente);

// ================================================================= Consultas
router.get('/consultas', validar([
  r.filtroFecha('desde'), r.filtroFecha('hasta'), r.filtroId('animal_id'), r.filtroId('veterinario_id'),
  r.filtroEnum('tipo', TIPOS_CONSULTA),
]), c.listarConsultas);
router.get('/consultas/:id', validar([r.idParam()]), c.obtenerConsulta);
router.post('/consultas', registrar, validar([
  r.id('animal_id', { mensaje: 'Selecciona el animal.' }),
  r.fechaHora('fecha'),
  r.enumerado('tipo', TIPOS_CONSULTA),
  r.texto('motivo', { max: 255 }),
  r.texto('sintomas', { max: 2000, opcional: true }),
  r.texto('diagnostico', { max: 2000, opcional: true }),
  r.texto('tratamiento', { max: 2000, opcional: true }),
  r.decimal('peso_kg', { min: 0.01, max: 999999, opcional: true }),
  r.decimal('temperatura_c', { min: 10, max: 50, opcional: true }),
  r.enumerado('estado_salud_resultante', E.ESTADOS_SALUD, { mensaje: 'Indica cómo queda el estado de salud.' }),
  r.fecha('proxima_revision', { opcional: true }),
  r.texto('observaciones', { max: 2000, opcional: true }),
  body('aplicaciones').optional().isArray({ max: 15 }).withMessage('Lista de aplicaciones inválida.'),
  ...reglasAplicacion('aplicaciones.*.'),
]), c.crearConsulta);

// ============================================================== Aplicaciones
router.get('/aplicaciones', validar([
  r.filtroFecha('desde'), r.filtroFecha('hasta'), r.filtroId('animal_id'), r.filtroEnum('tipo_insumo', TIPOS_INSUMO),
]), c.listarAplicaciones);
router.get('/aplicaciones/pendientes', validar([query('dias').optional().isInt({ min: 0, max: 90 }).toInt()]), c.dosisPendientes);
router.post('/aplicaciones', registrar, validar([
  r.id('animal_id', { mensaje: 'Selecciona el animal.' }),
  r.fechaHora('fecha_aplicacion'),
  ...reglasAplicacion(),
]), c.registrarAplicacion);

// ================================================================ Inventario
const reglasInsumo = [
  r.enumerado('tipo', TIPOS_INSUMO),
  r.texto('nombre', { max: 100 }),
  r.texto('presentacion', { max: 80, opcional: true }),
  r.enumerado('unidad_medida', UNIDADES),
  r.decimal('stock_minimo', { min: 0, max: 99999999 }),
  r.texto('dosis_recomendada', { max: 100, opcional: true }),
  r.texto('enfermedad_previene', { max: 120, opcional: true }),
  r.entero('intervalo_refuerzo_dias', { min: 1, max: 3650, opcional: true }),
];
router.get('/inventario', validar([
  r.filtroTexto('buscar'), r.filtroEnum('tipo', TIPOS_INSUMO), r.filtroActivo(), query('bajo_minimo').optional().isIn(['0', '1']),
]), inventario.listar);
router.get('/inventario/:id', validar([r.idParam()]), inventario.obtener);
router.post('/inventario', gestionar,
  validar([...reglasInsumo, r.decimal('stock_actual', { min: 0, max: 99999999, opcional: true })]), inventario.crear);
router.put('/inventario/:id', gestionar, validar([r.idParam(), ...reglasInsumo]), inventario.actualizar);
router.patch('/inventario/:id/estado', gestionar, validar([r.idParam(), r.booleano('activo')]), inventario.cambiarEstado);
router.get('/inventario/:id/movimientos', validar([r.idParam()]), inventario.movimientos);
router.post('/inventario/:id/movimientos', gestionar, validar([
  r.idParam(),
  r.enumerado('tipo', ['entrada', 'merma']),
  r.decimal('cantidad', { min: 0.01, max: 99999 }),
  r.texto('numero_lote', { max: 40, opcional: true }),
  r.fecha('fecha_vencimiento', { opcional: true }),
  r.texto('motivo', { max: 255, opcional: true }),
]), inventario.registrarMovimiento);

// ================================================================== Reportes
router.get('/reportes/atenciones', reportes, rango, c.reporteAtenciones);
router.get('/reportes/consumo', reportes, rango, c.reporteConsumo);
router.get('/reportes/vacunacion', reportes, rango, c.reporteVacunacion);

module.exports = router;
