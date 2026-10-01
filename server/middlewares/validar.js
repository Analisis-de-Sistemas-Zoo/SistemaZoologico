/**
 * Ejecuta las reglas de express-validator y responde 422 si hay errores.
 *
 * Uso en un archivo de rutas:
 *   const { body } = require('express-validator');
 *   const validar = require('../../middlewares/validar');
 *
 *   router.post('/',
 *     validar([
 *       body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio.'),
 *       body('cantidad').isFloat({ gt: 0 }).withMessage('Debe ser mayor a 0.').toFloat(),
 *     ]),
 *     controlador.crear
 *   );
 *
 * Después de validar, usa `datosValidos(req)` para obtener solo los campos
 * que pasaron por las reglas (ignora cualquier campo extra que envíe el cliente).
 */
const { validationResult, matchedData } = require('express-validator');
const AppError = require('../utils/AppError');

function validar(reglas) {
  return async (req, _res, next) => {
    for (const regla of reglas) {
      await regla.run(req);
    }
    const resultado = validationResult(req);
    if (resultado.isEmpty()) return next();

    const errores = resultado.array({ onlyFirstError: true }).map((e) => ({
      campo: e.path,
      mensaje: e.msg,
    }));
    return next(AppError.validacion(errores));
  };
}

function datosValidos(req, ubicaciones = ['body']) {
  return matchedData(req, { locations: ubicaciones, includeOptionals: true });
}

module.exports = validar;
module.exports.datosValidos = datosValidos;
