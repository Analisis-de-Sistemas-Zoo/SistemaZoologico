/**
 * Middlewares de autenticación y autorización.
 *
 *   requiereAuth           -> exige sesión iniciada (y que el usuario siga activo)
 *   requierePermiso(...p)  -> exige al menos uno de los permisos indicados
 *   protegerPaginas        -> protege los archivos HTML de /app según el permiso de cada página
 *
 * Uso en las rutas de un módulo:
 *   router.post('/dietas', requierePermiso('alimentacion.dietas.editar'), controlador.crear);
 */
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { tienePermiso, permisoDePagina } = require('../core/acceso');
const bitacora = require('../core/bitacora/bitacora.service');

const esApi = (req) => req.originalUrl.startsWith('/api/');

/**
 * Verifica la sesión y vuelve a consultar al usuario en la BD para que, si el
 * administrador lo desactiva o le cambia el rol, el cambio aplique de inmediato.
 */
async function requiereAuth(req, res, next) {
  const sesion = req.session?.usuario;
  if (!sesion) return rechazarSinSesion(req, res, next);

  const usuario = await db.queryUno(
    `SELECT u.id, u.activo, r.codigo AS rol, r.nombre AS rol_nombre
       FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE u.id = ?`,
    [sesion.id]
  );

  if (!usuario || !usuario.activo) {
    return req.session.destroy(() => rechazarSinSesion(req, res, next));
  }

  // Mantiene la sesión sincronizada con la BD.
  sesion.rol = usuario.rol;
  sesion.rolNombre = usuario.rol_nombre;
  return next();
}

function rechazarSinSesion(req, res, next) {
  if (esApi(req)) return next(new AppError(401, 'Tu sesión expiró o no has iniciado sesión.'));
  const destino = encodeURIComponent(req.originalUrl);
  return res.redirect(`/login.html?next=${destino}`);
}

function requierePermiso(...permisos) {
  return async (req, res, next) => {
    const usuario = req.session?.usuario;
    if (!usuario) return rechazarSinSesion(req, res, next);
    if (permisos.some((p) => tienePermiso(usuario.rol, p))) return next();

    await bitacora.registrar(req, {
      modulo: 'seguridad',
      accion: bitacora.ACCIONES.ACCESO_DENEGADO,
      detalle: { ruta: `${req.method} ${req.originalUrl}`, requiere: permisos },
    });
    return next(AppError.prohibido());
  };
}

/** Protege /app/*.html: sin sesión -> login; sin permiso -> 403.html */
async function protegerPaginas(req, res, next) {
  const ruta = `/app${req.path}`;

  if (req.path === '/' || req.path === '') return res.redirect('/app/dashboard.html');
  if (!ruta.endsWith('.html')) return next();

  const permiso = permisoDePagina(ruta);
  if (tienePermiso(req.session.usuario.rol, permiso)) return next();

  await bitacora.registrar(req, {
    modulo: 'seguridad',
    accion: bitacora.ACCIONES.ACCESO_DENEGADO,
    detalle: { pagina: ruta, requiere: permiso },
  });
  return res.redirect('/403.html');
}

module.exports = { requiereAuth, requierePermiso, protegerPaginas };
