/**
 * Reglas de validación reutilizables (express-validator) para que todos los
 * módulos validen igual y con los mismos mensajes.
 *
 * Uso:
 *   const r = require('../../utils/reglas');
 *   router.post('/', validar([
 *     r.texto('nombre', { max: 100 }),
 *     r.texto('descripcion', { max: 255, opcional: true }),
 *     r.id('especie_id'),
 *     r.decimal('cantidad', { min: 0.001 }),
 *     r.enumerado('estado', ['activo', 'inactivo']),
 *     r.fecha('fecha_ingreso'),
 *   ]), controlador.crear);
 *
 * Los campos opcionales vacíos llegan como null a datosValidos(req).
 */
const { body, param, query } = require('express-validator');

const opcionalSi = (regla, opcional) => (opcional ? regla.optional({ values: 'falsy' }) : regla);

/** Texto: recorta espacios y valida longitud. */
function texto(campo, { max = 255, min = 1, opcional = false, mensaje } = {}) {
  let regla = body(campo).customSanitizer((v) => (typeof v === 'string' ? v.trim() : v));
  regla = opcionalSi(regla, opcional);
  return regla
    .isString().withMessage(mensaje || 'Este campo es obligatorio.')
    .bail()
    .isLength({ min: opcional ? 0 : min }).withMessage(mensaje || 'Este campo es obligatorio.')
    .bail()
    .isLength({ max }).withMessage(`Máximo ${max} caracteres.`);
}

/** Llave foránea u otro identificador entero positivo. */
function id(campo, { opcional = false, mensaje = 'Selecciona una opción válida.' } = {}) {
  return opcionalSi(body(campo), opcional).isInt({ min: 1 }).withMessage(mensaje).toInt();
}

function entero(campo, { min = 0, max, opcional = false } = {}) {
  const limites = max === undefined ? { min } : { min, max };
  const texto = max === undefined ? `Debe ser un número entero mayor o igual a ${min}.` : `Debe ser un número entero entre ${min} y ${max}.`;
  return opcionalSi(body(campo), opcional).isInt(limites).withMessage(texto).toInt();
}

function decimal(campo, { min = 0, max, opcional = false } = {}) {
  const limites = max === undefined ? { min } : { min, max };
  const texto = max === undefined ? `Debe ser un número mayor o igual a ${min}.` : `Debe ser un número entre ${min} y ${max}.`;
  return opcionalSi(body(campo), opcional).isFloat(limites).withMessage(texto).toFloat();
}

/** Valor dentro de una lista (campos ENUM). */
function enumerado(campo, valores, { opcional = false, mensaje = 'Selecciona una opción válida.' } = {}) {
  return opcionalSi(body(campo), opcional).isIn(valores).withMessage(mensaje);
}

/** Fecha en formato AAAA-MM-DD. */
function fecha(campo, { opcional = false } = {}) {
  return opcionalSi(body(campo), opcional)
    .isISO8601({ strict: true }).withMessage('Ingresa una fecha válida.')
    .customSanitizer((v) => (v ? String(v).slice(0, 10) : v));
}

/** Fecha y hora (acepta el valor de <input type="datetime-local">). Queda como 'AAAA-MM-DD HH:MM:SS'. */
function fechaHora(campo, { opcional = false } = {}) {
  return opcionalSi(body(campo), opcional)
    .matches(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/).withMessage('Ingresa una fecha y hora válidas.')
    .customSanitizer((v) => {
      if (!v) return v;
      const [f, h] = String(v).replace('T', ' ').split(' ');
      // Sin hora el valor llega incompleto: se devuelve igual y lo rechaza el `matches`.
      if (!h) return v;
      return `${f} ${h.length === 5 ? `${h}:00` : h}`;
    });
}

/** Hora en formato HH:MM o HH:MM:SS. */
function hora(campo, { opcional = false } = {}) {
  return opcionalSi(body(campo), opcional)
    .matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).withMessage('Ingresa una hora válida.');
}

function booleano(campo) {
  return body(campo).isBoolean().withMessage('Valor inválido.').toBoolean();
}

function correo(campo, { opcional = false } = {}) {
  return opcionalSi(body(campo), opcional)
    .trim().toLowerCase().isEmail().withMessage('Ingresa un correo válido.').isLength({ max: 120 });
}

/** :id de la URL */
const idParam = (nombre = 'id') => param(nombre).isInt({ min: 1 }).withMessage('Identificador inválido.').toInt();

/** Filtros de listados (?campo=...) */
const filtroTexto = (campo) => query(campo).optional({ values: 'falsy' }).isString().isLength({ max: 100 });
const filtroId = (campo) => query(campo).optional({ values: 'falsy' }).isInt({ min: 1 });
const filtroEnum = (campo, valores) => query(campo).optional({ values: 'falsy' }).isIn(valores);
const filtroActivo = () => query('activo').optional({ values: 'falsy' }).isIn(['0', '1']);
const filtroFecha = (campo) => query(campo).optional({ values: 'falsy' }).isISO8601();

module.exports = {
  texto, id, entero, decimal, enumerado, fecha, fechaHora, hora, booleano, correo,
  idParam, filtroTexto, filtroId, filtroEnum, filtroActivo, filtroFecha,
};
