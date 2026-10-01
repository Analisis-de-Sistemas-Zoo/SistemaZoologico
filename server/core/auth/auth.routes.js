const { Router } = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const controlador = require('./auth.controller');
const validar = require('../../middlewares/validar');
const { requiereAuth } = require('../../middlewares/auth');
const { reglaPassword, reglaConfirmacion } = require('./politica');

const router = Router();

// Máximo 20 intentos de inicio de sesión por IP cada 15 minutos.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiados intentos de inicio de sesión. Espera unos minutos.' },
});

router.post(
  '/login',
  limiteLogin,
  validar([
    body('usuario').isString().trim().notEmpty().withMessage('Ingresa tu usuario o correo.').isLength({ max: 120 }),
    body('password').isString().notEmpty().withMessage('Ingresa tu contraseña.').isLength({ max: 72 }),
  ]),
  controlador.login
);

router.post('/logout', controlador.logout);

router.get('/yo', requiereAuth, controlador.yo);

router.put(
  '/password',
  requiereAuth,
  validar([
    body('actual').isString().notEmpty().withMessage('Ingresa tu contraseña actual.'),
    reglaPassword('nueva'),
    reglaConfirmacion('confirmacion', 'nueva'),
  ]),
  controlador.cambiarPassword
);

module.exports = router;
