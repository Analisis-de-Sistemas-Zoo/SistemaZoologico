/**
 * Rutas de los catálogos compartidos: /api/catalogos/...
 * Ver exige catalogos.ver (se aplica en app.js); modificar exige el permiso de gestión.
 */
const { Router } = require('express');
const c = require('./catalogos.controller');
const validar = require('../../middlewares/validar');
const { requierePermiso } = require('../../middlewares/auth');
const r = require('../../utils/reglas');
const E = require('../../config/catalogos');

const router = Router();
const ubicaciones = requierePermiso('catalogos.ubicaciones.gestionar');
const fauna = requierePermiso('catalogos.animales.gestionar');
const id = validar([r.idParam()]);
const estado = validar([r.idParam(), r.booleano('activo')]);

// ---------------------------------------------------------------- Hábitats
const reglasHabitat = [
  r.texto('nombre', { max: 80 }),
  r.enumerado('tipo', E.TIPOS_HABITAT),
  r.texto('descripcion', { max: 255, opcional: true }),
  r.texto('ubicacion', { max: 100, opcional: true }),
  r.entero('capacidad_max', { min: 1, max: 65535, opcional: true }),
];
router.get('/habitats', validar([r.filtroTexto('buscar'), r.filtroEnum('tipo', E.TIPOS_HABITAT), r.filtroActivo()]), c.habitat.listar);
router.get('/habitats/:id', id, c.habitat.obtener);
router.post('/habitats', ubicaciones, validar(reglasHabitat), c.habitat.crear);
router.put('/habitats/:id', ubicaciones, validar([r.idParam(), ...reglasHabitat]), c.habitat.actualizar);
router.patch('/habitats/:id/estado', ubicaciones, estado, c.habitat.cambiarEstado);

// ------------------------------------------------------------------- Áreas
const reglasArea = [
  r.texto('nombre', { max: 80 }),
  r.enumerado('tipo', E.TIPOS_AREA),
  r.id('habitat_id', { opcional: true }),
  r.texto('ubicacion', { max: 100, opcional: true }),
  r.texto('descripcion', { max: 255, opcional: true }),
];
router.get('/areas', validar([r.filtroTexto('buscar'), r.filtroEnum('tipo', E.TIPOS_AREA), r.filtroId('habitat_id'), r.filtroActivo()]), c.area.listar);
router.get('/areas/:id', id, c.area.obtener);
router.post('/areas', ubicaciones, validar(reglasArea), c.area.crear);
router.put('/areas/:id', ubicaciones, validar([r.idParam(), ...reglasArea]), c.area.actualizar);
router.patch('/areas/:id/estado', ubicaciones, estado, c.area.cambiarEstado);

// ---------------------------------------------------------------- Especies
const reglasEspecie = [
  r.texto('nombre_comun', { max: 100 }),
  r.texto('nombre_cientifico', { max: 120 }),
  r.enumerado('clasificacion', E.CLASIFICACIONES),
  r.enumerado('tipo_dieta', E.TIPOS_DIETA),
  r.enumerado('estado_conservacion', E.ESTADOS_CONSERVACION, { opcional: true }),
  r.texto('descripcion', { max: 500, opcional: true }),
];
router.get('/especies', validar([r.filtroTexto('buscar'), r.filtroEnum('clasificacion', E.CLASIFICACIONES), r.filtroEnum('tipo_dieta', E.TIPOS_DIETA), r.filtroActivo()]), c.especie.listar);
router.get('/especies/:id', id, c.especie.obtener);
router.post('/especies', fauna, validar(reglasEspecie), c.especie.crear);
router.put('/especies/:id', fauna, validar([r.idParam(), ...reglasEspecie]), c.especie.actualizar);
router.patch('/especies/:id/estado', fauna, estado, c.especie.cambiarEstado);

// ---------------------------------------------------------------- Animales
const reglasAnimal = [
  r.texto('nombre', { max: 80 }),
  r.id('especie_id', { mensaje: 'Selecciona la especie.' }),
  r.id('area_id', { mensaje: 'Selecciona la jaula o recinto.' }),
  r.enumerado('sexo', E.SEXOS),
  r.fecha('fecha_nacimiento', { opcional: true }),
  r.fecha('fecha_ingreso'),
  r.texto('procedencia', { max: 120, opcional: true }),
  r.decimal('peso_kg', { min: 0.01, max: 999999, opcional: true }),
  r.enumerado('estado_salud', E.ESTADOS_SALUD),
  r.enumerado('estado', E.ESTADOS_ANIMAL),
  r.texto('observaciones', { max: 500, opcional: true }),
];
router.get('/animales', validar([
  r.filtroTexto('buscar'), r.filtroId('especie_id'), r.filtroId('area_id'),
  r.filtroEnum('estado', E.ESTADOS_ANIMAL), r.filtroEnum('estado_salud', E.ESTADOS_SALUD),
]), c.animal.listar);
router.get('/animales/:id', id, c.animal.obtener);
router.post('/animales', fauna, validar(reglasAnimal), c.animal.crear);
router.put('/animales/:id', fauna, validar([r.idParam(), ...reglasAnimal]), c.animal.actualizar);

module.exports = router;
