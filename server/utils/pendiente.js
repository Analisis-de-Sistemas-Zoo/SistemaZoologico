/**
 * Marca una funcionalidad del backend como pendiente de implementar.
 *
 * La interfaz ya está construida y llama a estas rutas. Mientras el responsable
 * del módulo no programe la lógica, responden 501 y la pantalla muestra un aviso
 * en lugar de fallar.
 *
 * Uso en un controlador:
 *   const { pendiente } = require('../../utils/pendiente');
 *   async function verificar(req, res) {
 *     pendiente('Verificar o rechazar una tarea completada');
 *     // TODO: implementar según docs/api/limpieza.md
 *   }
 *
 * Al implementar la función, simplemente borra la línea `pendiente(...)`.
 */
const AppError = require('./AppError');

function pendiente(funcionalidad) {
  throw new AppError(501, `Pendiente de implementar: ${funcionalidad}.`);
}

module.exports = { pendiente };
