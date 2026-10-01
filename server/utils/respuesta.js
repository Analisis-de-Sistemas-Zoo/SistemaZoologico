/**
 * Formato único de respuestas de la API.
 *
 *   Éxito:  { ok: true,  datos: ..., mensaje?: '...' }
 *   Error:  { ok: false, mensaje: '...', errores?: [{ campo, mensaje }] }
 *
 * Uso:
 *   ok(res, filas);
 *   ok(res, { id }, 'Dieta registrada correctamente.', 201);
 */
function ok(res, datos = null, mensaje = undefined, estado = 200) {
  const cuerpo = { ok: true, datos };
  if (mensaje) cuerpo.mensaje = mensaje;
  return res.status(estado).json(cuerpo);
}

function creado(res, datos, mensaje = 'Registro creado correctamente.') {
  return ok(res, datos, mensaje, 201);
}

module.exports = { ok, creado };
