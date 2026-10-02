/**
 * Barrera de pruebas del sistema.
 *
 *   npm test                 -> todas las suites
 *   npm test -- clinico      -> solo las suites cuyo nombre coincide
 *   npm test -- --lectura    -> solo las suites que no alteran la base
 *   npm test -- --verbose    -> muestra cada comprobación, no solo las fallas
 *
 * Requiere el servidor arriba (npm run dev) y la base sembrada (npm run db:reset).
 * Sale con código 1 si alguna comprobación falla.
 */
const fs = require('fs');
const path = require('path');
const { Contexto, BASE } = require('./ayuda');

const argumentos = process.argv.slice(2);
const opciones = argumentos.filter((a) => a.startsWith('--'));
const filtros = argumentos.filter((a) => !a.startsWith('--')).map((a) => a.toLowerCase());

const soloLectura = opciones.includes('--lectura');
const verboso = opciones.includes('--verbose');
const reiniciar = opciones.includes('--reset');

const CARPETA = path.join(__dirname, 'suites');

/** Ejecuta `npm run db:reset` y espera a que MySQL responda de nuevo. */
function reiniciarBase() {
  const { execFileSync } = require('child_process');
  console.log('\nReiniciando la base de datos…');
  execFileSync('npm', ['run', 'db:reset'], { cwd: path.join(__dirname, '..'), stdio: 'inherit', shell: true });
}

/** Espera a que el servidor responda en / (hasta `intentos` segundos). */
async function esperarServidor(intentos = 60) {
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.status < 500) return true;
    } catch { /* todavía no levanta */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function cargarSuites() {
  const archivos = fs.readdirSync(CARPETA).filter((f) => f.endsWith('.js')).sort();
  const suites = archivos
    .map((f) => require(path.join(CARPETA, f)))
    .filter(Boolean)
    .filter((s) => !filtros.length || filtros.some((f) => s.nombre.toLowerCase().includes(f)))
    .filter((s) => !soloLectura || s.soloLectura !== false);
  return suites;
}

(async () => {
  if (reiniciar) reiniciarBase();

  if (!(await esperarServidor())) {
    console.error(`\nNo responde el servidor en ${BASE}.`);
    console.error('Levántalo con "npm run dev" y vuelve a intentarlo.');
    process.exit(2);
  }

  const suites = cargarSuites();
  if (!suites.length) {
    console.error(`\nNinguna suite coincide con ${filtros.join(', ') || '(todas)'}.`);
    process.exit(2);
  }

  console.log(`\nBarrera de pruebas — ${BASE}`);
  console.log(`Suites: ${suites.map((s) => s.nombre).join(', ')}`);
  if (!soloLectura) console.log('Aviso: algunas suites alteran la base; ejecuta "npm run db:reset" al terminar.');

  const t = new Contexto({ verboso });
  const resumen = [];
  let total = 0;

  for (const suite of suites) {
    console.log(`\n${'='.repeat(70)}\n  ${suite.nombre}\n${'='.repeat(70)}`);
    const antes = t.resumenParcial();
    try {
      await suite.pruebas(t);
    } catch (e) {
      t.revisar(`la suite ${suite.nombre} no terminó`, false, e.message);
    }
    const despues = t.resumenParcial();
    const ok = despues.ok - antes.ok;
    const fallos = despues.fallos - antes.fallos;
    total += fallos;
    resumen.push({ nombre: suite.nombre, ok, fallos });
    console.log(`  -- ${suite.nombre}: ${ok} ok, ${fallos} fallas`);
  }

  console.log(`\n${'='.repeat(70)}`);
  for (const s of resumen) {
    console.log(`  ${s.fallos ? 'FALLA' : ' ok  '}  ${s.nombre.padEnd(12)} ${String(s.ok).padStart(4)} ok  ${s.fallos} fallas`);
  }
  console.log(`${'='.repeat(70)}`);
  console.log(`\nTotal: ${t.ok} ok / ${t.fallos} fallas`);
  if (t.fallidas.length) {
    console.log('\nFallaron:');
    t.fallidas.forEach((f) => console.log(`  · ${f}`));
  }
  process.exit(total ? 1 : 0);
})();
