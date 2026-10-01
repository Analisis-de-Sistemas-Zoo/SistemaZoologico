/**
 * Conexión a MySQL mediante un pool de conexiones.
 *
 * Uso en los modelos:
 *   const db = require('../../config/db');
 *   const filas = await db.query('SELECT * FROM tabla WHERE id = ?', [id]);
 *
 *   // Varias operaciones que deben guardarse juntas o no guardarse:
 *   await db.transaccion(async (conn) => {
 *     await conn.query('INSERT ...', [..]);
 *     await conn.query('UPDATE ...', [..]);
 *   });
 *
 * IMPORTANTE: usa SIEMPRE los signos ? para los valores. Nunca concatenes
 * datos del usuario dentro del SQL (evita la inyección SQL).
 */
const mysql = require('mysql2/promise');
const { db: config } = require('./env');

const pool = mysql.createPool({
  ...config,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: '-06:00',
  dateStrings: true, // fechas como texto 'YYYY-MM-DD HH:MM:SS'
  decimalNumbers: true, // DECIMAL como número
});

// Asegura la zona horaria de Guatemala en cada conexión nueva.
pool.on('connection', (conexion) => {
  conexion.query("SET time_zone = '-06:00'");
});

/** Ejecuta una consulta y devuelve las filas (o el resultado de INSERT/UPDATE). */
async function query(sql, parametros = []) {
  const [resultado] = await pool.query(sql, parametros);
  return resultado;
}

/** Devuelve la primera fila o null. */
async function queryUno(sql, parametros = []) {
  const filas = await query(sql, parametros);
  return filas[0] || null;
}

/**
 * Ejecuta varias operaciones dentro de una transacción.
 * Si algo falla, se revierte todo (rollback).
 * La función recibe `conn`, que tiene los mismos métodos query y queryUno.
 */
async function transaccion(fn) {
  const conexion = await pool.getConnection();
  const conn = {
    query: async (sql, p = []) => (await conexion.query(sql, p))[0],
    queryUno: async (sql, p = []) => (await conexion.query(sql, p))[0][0] || null,
  };
  try {
    await conexion.beginTransaction();
    const resultado = await fn(conn);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

async function verificarConexion() {
  await pool.query('SELECT 1');
}

module.exports = { pool, query, queryUno, transaccion, verificarConexion };
