/**
 * Utilidades compartidas por la barrera de pruebas.
 *
 * Todo corre en un solo proceso a propósito: el login tiene un rate limit de
 * 20 intentos por cada 15 minutos (ver server/core/auth/auth.routes.js), y un
 * runner que lanzara cada archivo por separado lo agotaria. Aqui se abre una
 * sesion por usuario y se reutiliza en todas las suites.
 *
 * Contrato de cada suite en pruebas/suites/*.js:
 *   module.exports = { nombre, soloLectura: true|false, pruebas: async (t) => {} }
 * donde `t` es el contexto con { pedir, revisar, seccion, revisarEstado, sesion }.
 */
const BASE = process.env.ZOO_URL || 'http://localhost:3000';
const PASSWORD = process.env.ZOO_PASSWORD || 'Zoo2026!';

// El servidor usa la zona -06:00; se resta 6 h para no depender de la del equipo.
const DESFASE_HORAS = 6;
const hoy = () => new Date(Date.now() - DESFASE_HORAS * 3600e3).toISOString().slice(0, 10);
const ahora = () => new Date(Date.now() - DESFASE_HORAS * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
const enDias = (n) => new Date(Date.now() - DESFASE_HORAS * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const esLunes = (fecha = hoy()) => new Date(`${fecha}T12:00:00Z`).getUTCDay() === 1;

/** Rango de fechas para los reportes: del 1 de enero al 31 de diciembre de este año. */
const rangoAnio = () => `desde=${hoy().slice(0, 4)}-01-01&hasta=${hoy().slice(0, 4)}-12-31`;

class Contexto {
  constructor({ verboso = false } = {}) {
    this.verboso = verboso;
    this.cookies = new Map();
    this.ok = 0;
    this.fallos = 0;
    this.fallidas = [];
    this.suite = '';
  }

  /** Pide una ruta ya sin el prefijo /api. Guarda la cookie de sesión de quien llama. */
  async pedir(metodo, ruta, cuerpo, quien = 'admin') {
    const res = await fetch(`${BASE}${ruta.startsWith('/') ? ruta : `/api/${ruta}`}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        // Sin esta cabecera el middleware CSRF responde 403.
        'X-Requested-With': 'XMLHttpRequest',
        ...(this.cookies.has(quien) ? { Cookie: this.cookies.get(quien) } : {}),
      },
      ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
      redirect: 'manual',
    });
    for (const c of res.headers.getSetCookie?.() || []) {
      if (c.startsWith('zoo.sid')) this.cookies.set(quien, c.split(';')[0]);
    }
    const texto = await res.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { json = { crudo: texto.slice(0, 300) }; }
    return { estado: res.status, json };
  }

  /** Abre (o reutiliza) la sesión de un usuario. */
  async sesion(usuario, contrasena = PASSWORD) {
    if (this.cookies.has(usuario)) return this.cookies.get(usuario);
    const r = await this.pedir('POST', '/auth/login', { usuario, password: contrasena }, usuario);
    if (r.estado !== 200) {
      throw new Error(`No se pudo iniciar sesión como "${usuario}": ${r.estado} ${JSON.stringify(r.json)}`);
    }
    return this.cookies.get(usuario);
  }

  seccion(titulo) {
    this.seccionActual = titulo;
    console.log(`\n  ${titulo}`);
  }

  /** Registra una comprobación. `extra` solo se imprime si falla. */
  revisar(nombre, condicion, extra) {
    if (condicion) {
      this.ok++;
      if (this.verboso) console.log(`    ok  ${nombre}`);
    } else {
      this.fallos++;
      this.fallidas.push(`${this.seccionActual} › ${nombre}`);
      console.log(`    FALLA  ${nombre}${extra !== undefined ? ` :: ${JSON.stringify(extra).slice(0, 400)}` : ''}`);
    }
  }

  /** Comprueba el estado HTTP y que la respuesta no venga con ok:false. */
  revisarEstado(nombre, respuesta, esperado, extra) {
    this.revisar(nombre, respuesta.estado === esperado, extra ?? respuesta.json ?? respuesta.estado);
  }

  /** Comprueba que la respuesta traiga el sobre { ok: true, datos } del proyecto. */
  revisarOk(nombre, respuesta, esperado = 200) {
    this.revisar(
      nombre,
      respuesta.estado === esperado && respuesta.json?.ok === true,
      respuesta.json ?? respuesta.estado
    );
  }

  /** Muestra un dato de contexto sin comprobar nada (solo para leer la salida). */
  info(etiqueta, valor) {
    if (this.verboso) console.log(`    · ${etiqueta}: ${typeof valor === 'string' ? valor : JSON.stringify(valor)}`);
  }

  resumenParcial() {
    return { ok: this.ok, fallos: this.fallos, fallidas: [...this.fallidas] };
  }
}

module.exports = { Contexto, BASE, PASSWORD, hoy, ahora, enDias, esLunes, rangoAnio };
