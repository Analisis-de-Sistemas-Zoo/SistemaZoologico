/**
 * Errores controlados de la aplicación.
 *
 * En un controlador:
 *   throw new AppError(404, 'El producto no existe.');
 *   throw AppError.validacion([{ campo: 'cantidad', mensaje: 'Debe ser mayor a 0' }]);
 *
 * El manejador central (middlewares/errores.js) los convierte en respuestas JSON.
 */
class AppError extends Error {
  constructor(estado, mensaje, errores = []) {
    super(mensaje);
    this.estado = estado;
    this.errores = errores;
  }

  static noEncontrado(mensaje = 'El registro solicitado no existe.') {
    return new AppError(404, mensaje);
  }

  static prohibido(mensaje = 'No tienes permiso para realizar esta acción.') {
    return new AppError(403, mensaje);
  }

  static conflicto(mensaje) {
    return new AppError(409, mensaje);
  }

  static validacion(errores, mensaje = 'Revisa los datos ingresados.') {
    return new AppError(422, mensaje, errores);
  }
}

module.exports = AppError;
