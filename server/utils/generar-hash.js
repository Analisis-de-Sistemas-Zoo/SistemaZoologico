/**
 * Genera el hash bcrypt de una contraseña (para scripts SQL de prueba).
 * Uso:  npm run hash -- "MiContraseña"
 */
const bcrypt = require('bcryptjs');

const texto = process.argv[2];
if (!texto) {
  console.log('Uso: npm run hash -- "MiContraseña"');
  process.exit(1);
}
console.log(bcrypt.hashSync(texto, 10));
