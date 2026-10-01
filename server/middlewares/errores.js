/**
 * Manejo central de errores. Cualquier error lanzado en un controlador
 * (incluso dentro de async) llega aquí y se responde con el formato estándar.
 */
const path = require('path');
const AppError = require('../utils/AppError');

const PUBLIC = path.join(__dirname, '..', '..', 'public');

/** Traduce errores comunes de MySQL a mensajes entendibles. */
function traducirErrorMysql(error) {
  switch (error.code) {
    case 'ER_DUP_ENTRY':
      return new AppError(409, 'Ya existe un registro con ese valor. Verifica los datos únicos.');
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      return new AppError(409, 'No se puede eliminar porque tiene registros relacionados.');
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return new AppError(400, 'Uno de los datos relacionados no existe.');
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return new AppError(400, 'Los datos no cumplen una regla de la base de datos.');
    case 'ER_DATA_TOO_LONG':
      return new AppError(400, 'Uno de los campos excede la longitud permitida.');
    default:
      return null;
  }
}

function noEncontrado(req, res) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada.' });
  }
  return res.status(404).sendFile(path.join(PUBLIC, '404.html'));
}

// eslint-disable-next-line no-unused-vars
function manejarErrores(error, req, res, _next) {
  let err = error;

  if (!(err instanceof AppError)) {
    err = traducirErrorMysql(error);
  }
  if (!err && error.type === 'entity.parse.failed') {
    err = new AppError(400, 'El cuerpo de la solicitud no es un JSON válido.');
  }
  if (!err && error.type === 'entity.too.large') {
    err = new AppError(413, 'La información enviada es demasiado grande.');
  }
  if (!err) {
    console.error(`[error] ${req.method} ${req.originalUrl}\n`, error);
    err = new AppError(500, 'Ocurrió un error interno. Intenta de nuevo o contacta al administrador.');
  }

  if (!req.originalUrl.startsWith('/api/')) {
    return res.status(err.estado).send(`<h1>${err.estado}</h1><p>${err.message}</p><a href="/">Volver</a>`);
  }

  const cuerpo = { ok: false, mensaje: err.message };
  if (err.errores?.length) cuerpo.errores = err.errores;
  return res.status(err.estado).json(cuerpo);
}

module.exports = { noEncontrado, manejarErrores };
