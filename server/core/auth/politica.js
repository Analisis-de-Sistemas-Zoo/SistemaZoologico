/**
 * Política de contraseñas y bloqueo de cuentas.
 */
const { body } = require('express-validator');

const POLITICA = Object.freeze({
  INTENTOS_MAXIMOS: 5,
  MINUTOS_BLOQUEO: 15,
  LONGITUD_MINIMA: 8,
});

/** Regla de express-validator para una contraseña nueva. */
function reglaPassword(campo = 'password') {
  return body(campo)
    .isString().withMessage('La contraseña es obligatoria.')
    .isLength({ min: POLITICA.LONGITUD_MINIMA, max: 72 })
    .withMessage(`La contraseña debe tener entre ${POLITICA.LONGITUD_MINIMA} y 72 caracteres.`)
    .matches(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/).withMessage('La contraseña debe incluir al menos una letra.')
    .matches(/\d/).withMessage('La contraseña debe incluir al menos un número.');
}

/** Regla para confirmar que dos campos coinciden. */
function reglaConfirmacion(campo, referencia) {
  return body(campo).custom((valor, { req }) => {
    if (valor !== req.body[referencia]) throw new Error('Las contraseñas no coinciden.');
    return true;
  });
}

module.exports = { POLITICA, reglaPassword, reglaConfirmacion };
