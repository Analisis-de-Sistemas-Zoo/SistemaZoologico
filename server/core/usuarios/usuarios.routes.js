const { Router } = require('express');
const { body, param } = require('express-validator');
const controlador = require('./usuarios.controller');
const validar = require('../../middlewares/validar');
const { reglaPassword } = require('../auth/politica');

const router = Router();

const reglaId = param('id').isInt({ min: 1 }).withMessage('Identificador inválido.').toInt();

const reglasDatos = [
  body('rol_id').isInt({ min: 1 }).withMessage('Selecciona un rol.').toInt(),
  body('nombres').isString().trim().notEmpty().withMessage('Los nombres son obligatorios.')
    .isLength({ max: 80 }).withMessage('Máximo 80 caracteres.'),
  body('apellidos').isString().trim().notEmpty().withMessage('Los apellidos son obligatorios.')
    .isLength({ max: 80 }).withMessage('Máximo 80 caracteres.'),
  body('usuario').isString().trim().toLowerCase()
    .matches(/^[a-z0-9._-]{3,40}$/).withMessage('De 3 a 40 caracteres: letras, números, punto, guion o guion bajo.'),
  body('correo').isString().trim().toLowerCase()
    .isEmail().withMessage('Ingresa un correo válido.').isLength({ max: 120 }),
];

router.get('/', controlador.listar);
router.get('/roles', controlador.roles);
router.get('/:id', validar([reglaId]), controlador.obtener);

router.post('/', validar([...reglasDatos, reglaPassword('password')]), controlador.crear);

router.put('/:id', validar([reglaId, ...reglasDatos]), controlador.actualizar);

router.patch(
  '/:id/estado',
  validar([reglaId, body('activo').isBoolean().withMessage('Valor inválido.').toBoolean()]),
  controlador.cambiarEstado
);

router.patch('/:id/password', validar([reglaId, reglaPassword('password')]), controlador.restablecerPassword);

module.exports = router;
