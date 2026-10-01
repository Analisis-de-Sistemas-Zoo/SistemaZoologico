/**
 * Protección contra CSRF para la API.
 *
 * Toda petición que modifica datos (POST, PUT, PATCH, DELETE) debe traer la
 * cabecera X-Requested-With: XMLHttpRequest. El cliente Zoo.api la agrega
 * automáticamente. Un sitio externo no puede enviar esa cabecera sin permiso
 * del servidor, y la cookie de sesión además es SameSite=Strict.
 */
const AppError = require('../utils/AppError');

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

function exigirAjax(req, _res, next) {
  if (METODOS_SEGUROS.has(req.method)) return next();
  if (req.get('X-Requested-With') === 'XMLHttpRequest') return next();
  return next(new AppError(403, 'Solicitud no permitida.'));
}

module.exports = exigirAjax;
