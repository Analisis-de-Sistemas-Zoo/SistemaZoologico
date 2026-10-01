/**
 * Carga y valida las variables de entorno (.env).
 * Todo el código lee la configuración desde aquí, nunca de process.env directo.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const requeridas = ['DB_HOST', 'DB_USER', 'DB_NAME', 'SESSION_SECRET'];
const faltantes = requeridas.filter((clave) => !process.env[clave]);

if (faltantes.length > 0) {
  console.error(`\n[config] Faltan variables en el archivo .env: ${faltantes.join(', ')}`);
  console.error('[config] Copia .env.example como .env y completa los valores.\n');
  process.exit(1);
}

module.exports = {
  puerto: Number(process.env.PORT) || 3000,
  esProduccion: process.env.NODE_ENV === 'production',
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  },
  sesion: {
    secreto: process.env.SESSION_SECRET,
    duracionMin: Number(process.env.SESSION_MAX_AGE_MIN) || 120,
  },
};
