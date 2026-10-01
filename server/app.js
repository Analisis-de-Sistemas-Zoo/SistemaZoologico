/**
 * Punto de entrada del servidor — Zoológico "Mirada Salvaje".
 *
 * Orden de las capas:
 *   seguridad (helmet) -> sesiones -> API (núcleo + módulos) -> páginas protegidas
 *   -> archivos públicos -> 404 -> manejo de errores
 */
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');

const env = require('./config/env');
const db = require('./config/db');
const SesionStore = require('./core/sesion-store');
const exigirAjax = require('./middlewares/csrf');
const { requiereAuth, requierePermiso, protegerPaginas } = require('./middlewares/auth');
const { noEncontrado, manejarErrores } = require('./middlewares/errores');
const { cargarModulos } = require('./modulos');

const authRoutes = require('./core/auth/auth.routes');
const usuariosRoutes = require('./core/usuarios/usuarios.routes');
const bitacoraRoutes = require('./core/bitacora/bitacora.routes');
const dashboardRoutes = require('./core/dashboard/dashboard.routes');

const RAIZ = path.join(__dirname, '..');
const PUBLIC = path.join(RAIZ, 'public');
const NODE_MODULES = path.join(RAIZ, 'node_modules');

const app = express();
app.disable('x-powered-by');

// ---------------------------------------------------------------- Seguridad
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: env.esProduccion ? [] : null,
      },
    },
    strictTransportSecurity: env.esProduccion,
  })
);

app.use(express.json({ limit: '200kb' }));

// ------------------------------------------------------------------ Sesiones
const duracionMs = env.sesion.duracionMin * 60 * 1000;
app.use(
  session({
    name: 'zoo.sid',
    secret: env.sesion.secreto,
    store: new SesionStore({ duracionMs }),
    resave: false,
    saveUninitialized: false,
    rolling: true, // la sesión se renueva con la actividad
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.esProduccion,
      maxAge: duracionMs,
    },
  })
);

// ---------------------------------------------------------------------- API
app.use('/api', exigirAjax);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', requiereAuth, dashboardRoutes);
app.use('/api/usuarios', requiereAuth, requierePermiso('usuarios.gestionar'), usuariosRoutes);
app.use('/api/bitacora', requiereAuth, requierePermiso('bitacora.ver'), bitacoraRoutes);

const modulos = cargarModulos();
for (const modulo of modulos) {
  if (modulo.routerPublico) {
    app.use(`/api/publico/${modulo.clave}`, modulo.routerPublico);
  }
  if (modulo.router) {
    app.use(`/api/${modulo.clave}`, requiereAuth, requierePermiso(`${modulo.clave}.ver`), modulo.router);
  }
}

app.use('/api', noEncontrado);

// ------------------------------------------------- Librerías del navegador
// Se sirven desde node_modules para que la app funcione sin internet.
const librerias = {
  '/vendor/bootstrap': 'bootstrap/dist',
  '/vendor/bootstrap-icons': 'bootstrap-icons/font',
  '/vendor/jspdf': 'jspdf/dist',
  '/vendor/jspdf-autotable': 'jspdf-autotable/dist',
  '/vendor/exceljs': 'exceljs/dist',
  '/vendor/fuentes/bricolage': '@fontsource-variable/bricolage-grotesque',
  '/vendor/fuentes/public-sans': '@fontsource-variable/public-sans',
};
for (const [ruta, carpeta] of Object.entries(librerias)) {
  app.use(ruta, express.static(path.join(NODE_MODULES, carpeta), { maxAge: '7d' }));
}

// ------------------------------------------------------ Páginas protegidas
app.use('/app', requiereAuth, protegerPaginas, express.static(path.join(PUBLIC, 'app'), { index: false }));

// -------------------------------------------------------- Archivos públicos
// Defensa extra: ninguna variante de ruta (/./app, //app, %2Fapp...) puede
// llegar a public/app sin pasar por la protección anterior.
app.use((req, res, next) => {
  let ruta;
  try {
    ruta = path.posix.normalize(decodeURIComponent(req.path)).toLowerCase();
  } catch {
    return res.status(400).end();
  }
  if (ruta === '/app' || ruta.startsWith('/app/')) return noEncontrado(req, res);
  return next();
});
app.use(express.static(PUBLIC, { index: 'index.html' }));

app.use(noEncontrado);
app.use(manejarErrores);

// -------------------------------------------------------------- Arranque
async function esperarBaseDeDatos(intentos = 10) {
  for (let i = 1; i <= intentos; i += 1) {
    try {
      await db.verificarConexion();
      return;
    } catch (error) {
      console.warn(`[db] Sin conexión a MySQL (intento ${i}/${intentos}): ${error.code || error.message}`);
      if (i === intentos) throw error;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function iniciar() {
  try {
    await esperarBaseDeDatos();
  } catch {
    console.error('\n[db] No se pudo conectar a MySQL.');
    console.error('     ¿Levantaste la base de datos con  npm run db:up ?');
    console.error('     Revisa también DB_HOST, DB_PORT, DB_USER y DB_PASSWORD en tu .env\n');
    process.exit(1);
  }

  app.listen(env.puerto, () => {
    console.log('\n  Zoológico "Mirada Salvaje" — sistema de control');
    console.log(`  Portal público ...... http://localhost:${env.puerto}`);
    console.log(`  Acceso del personal . http://localhost:${env.puerto}/login.html`);
    console.log(`  Módulos cargados .... ${modulos.map((m) => m.clave).join(', ') || '(ninguno)'}\n`);
  });
}

if (require.main === module) iniciar();

module.exports = app;
