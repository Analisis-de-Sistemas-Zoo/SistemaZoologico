/**
 * Pruebas de solo lectura: carga de módulos, sesión, dashboard, páginas y
 * listados de los cuatro módulos. No escribe nada en la base.
 */
const path = require('path');
const { BASE, rangoAnio } = require('../ayuda');

const MODULOS = ['alimentacion', 'entradas', 'limpieza', 'clinico'];

const PAGINAS = [
  '/app/dashboard.html',
  '/app/alimentacion/raciones.html',
  '/app/alimentacion/dietas.html',
  '/app/alimentacion/horarios.html',
  '/app/alimentacion/alimentos.html',
  '/app/alimentacion/lotes.html',
  '/app/alimentacion/proveedores.html',
  '/app/alimentacion/reportes.html',
  '/app/entradas/tipos.html',
  '/app/entradas/promociones.html',
  '/app/entradas/ventas.html',
  '/app/entradas/venta.html',
  '/app/entradas/validar.html',
  '/app/entradas/reportes.html',
  '/app/limpieza/tareas.html',
  '/app/limpieza/insumos.html',
  '/app/limpieza/reportes.html',
  '/app/clinico/expedientes.html',
  '/app/clinico/consultas.html',
  '/app/clinico/aplicaciones.html',
  '/app/clinico/inventario.html',
  '/app/clinico/reportes.html',
];

module.exports = {
  nombre: 'Lectura',
  soloLectura: true,

  async pruebas(t) {
    const { pedir, revisar, revisarOk } = t;
    let r;

    // ------------------------------------------------------ Carga de módulos
    t.seccion('Los módulos cargan sin errores de sintaxis');
    const raiz = path.join(__dirname, '..', '..', 'server', 'modulos');
    for (const m of MODULOS) {
      try {
        require(path.join(raiz, m));
        revisar(`${m} se carga`, true);
      } catch (e) {
        revisar(`${m} se carga`, false, e.message);
      }
    }
    // Cada módulo exporta el contrato que exige server/modulos/index.js.
    const { modulos } = require(path.join(__dirname, '..', '..', 'server', 'modulos'));
    revisar('el cargador registró 4 módulos', modulos.length === 4, modulos.map((m) => m.clave));
    revisar('todos declaran clave, nombre, permisos y menu',
      modulos.every((m) => m.clave && m.nombre && m.permisos && m.menu && m.router), modulos.map((m) => m.clave));
    revisar('todos tienen resumenDashboard',
      modulos.every((m) => typeof m.resumenDashboard === 'function'), modulos.map((m) => m.clave));

    // -------------------------------------------------------------- Sesión
    t.seccion('Sesión');
    await t.sesion('admin');
    r = await pedir('GET', '/auth/yo', null, 'admin');
    revisarOk('devuelve el usuario conectado', r);
    revisar('con rol y nombre', Boolean(r.json.datos.usuario?.rol && r.json.datos.usuario?.nombre), r.json.datos);

    r = await pedir('POST', '/auth/login', { usuario: 'admin', password: 'incorrecta' }, 'otro');
    revisarEstado('contraseña incorrecta 401', r, 401);
    r = await pedir('POST', '/auth/login', { usuario: 'noexiste', password: 'Zoo2026!' }, 'otro');
    revisarEstado('usuario inexistente 401', r, 401);

    // El middleware CSRF exige la cabecera; sin ella se rechaza.
    const sinAjax = await fetch(`${BASE}/api/dashboard/resumen`, { headers: { Cookie: t.cookies.get('admin') } });
    revisar('petición sin X-Requested-With: 403', sinAjax.status === 403, sinAjax.status);

    r = await pedir('GET', '/usuarios', null, 'admin');
    revisarEstado('sin permiso de usuarios no entra 403', r, 403);

    // ----------------------------------------------------------- Dashboard
    t.seccion('Dashboard');
    r = await pedir('GET', '/dashboard/resumen', null, 'admin');
    revisarOk('resumen del día', r);
    const tarjetas = r.json.datos.tarjetas || [];
    revisar('devuelve tarjetas', tarjetas.length > 0, tarjetas.length);
    revisar('cada tarjeta tiene título, valor y url',
      tarjetas.every((x) => x.titulo !== undefined && x.valor !== undefined && x.url), tarjetas[0]);
    revisar('cada tarjeta tiene un color del catálogo',
      tarjetas.every((x) => ['primary', 'alerta', 'peligro', 'neutro', 'exito'].includes(x.color)), [...new Set(tarjetas.map((x) => x.color))]);
    revisar('los cuatro módulos aportan tarjetas',
      MODULOS.every((m) => tarjetas.some((x) => x.modulo === m)),
      [...new Set(tarjetas.map((x) => x.modulo))]);

    // ----------------------------------------------------------- Listados
    t.seccion('Listados de cada módulo');
    const lecturas = [
      ['alimentación: alimentos', '/alimentacion/alimentos'],
      ['alimentación: proveedores', '/alimentacion/proveedores'],
      ['alimentación: dietas', '/alimentacion/dietas'],
      ['alimentación: horarios', '/alimentacion/horarios'],
      ['alimentación: raciones del día', '/alimentacion/raciones'],
      ['entradas: tipos', '/entradas/tipos'],
      ['entradas: promociones', '/entradas/promociones'],
      ['entradas: ventas', '/entradas/ventas'],
      ['limpieza: tareas', '/limpieza/tareas'],
      ['limpieza: insumos', '/limpieza/insumos'],
      ['clínico: expedientes', '/clinico/expedientes'],
      ['clínico: consultas', '/clinico/consultas'],
      ['clínico: aplicaciones', '/clinico/aplicaciones'],
      ['clínico: inventario', '/clinico/inventario'],
    ];
    for (const [nombre, ruta] of lecturas) {
      r = await pedir('GET', ruta, null, 'admin');
      revisarOk(nombre, r);
      revisar(`${nombre}: datos en arreglo`, Array.isArray(r.json.datos), typeof r.json.datos);
    }

    // ------------------------------------------------------------ Reportes
    t.seccion('Reportes');
    const reportes = [
      ['alimentación: consumo', '/alimentacion/reportes/consumo-alimentos'],
      ['alimentación: cumplimiento', '/alimentacion/reportes/cumplimiento'],
      ['alimentación: compras', '/alimentacion/reportes/compras'],
      ['alimentación: vencimientos', '/alimentacion/reportes/vencimientos'],
      ['entradas: ventas diarias', '/entradas/reportes/ventas-diarias'],
      ['entradas: por tipo', '/entradas/reportes/por-tipo'],
      ['entradas: promociones', '/entradas/reportes/promociones'],
      ['limpieza: cumplimiento', '/limpieza/reportes/cumplimiento'],
      ['limpieza: consumo', '/limpieza/reportes/consumo-insumos'],
      ['limpieza: personal', '/limpieza/reportes/personal'],
      ['clínico: atenciones', '/clinico/reportes/atenciones'],
      ['clínico: consumo', '/clinico/reportes/consumo'],
      ['clínico: vacunación', '/clinico/reportes/vacunacion'],
    ];
    for (const [nombre, ruta] of reportes) {
      r = await pedir('GET', `${ruta}?${rangoAnio()}`, null, 'admin');
      revisarOk(nombre, r);
    }

    t.seccion('Validación de filtros de fecha');
    r = await pedir('GET', '/clinico/reportes/consumo?desde=2027-01-01&hasta=2026-01-01', null, 'admin');
    revisarEstado('rango invertido 422', r, 422);
    r = await pedir('GET', '/clinico/reportes/consumo?desde=ayer', null, 'admin');
    revisarEstado('fecha con texto 422', r, 422);
    r = await pedir('GET', '/clinico/consultas?desde=2026-13-45', null, 'admin');
    revisarEstado('fecha imposible 422', r, 422);
    r = await pedir('GET', '/clinico/expedientes?estado_salud=inventado', null, 'admin');
    revisarEstado('enumerado inválido 422', r, 422);

    // ---------------------------------------------------------- Páginas
    t.seccion('Las pantallas cargan');
    for (const pagina of PAGINAS) {
      const res = await fetch(`${BASE}${pagina}`, { headers: { Cookie: t.cookies.get('admin') }, redirect: 'manual' });
      revisar(`${pagina} -> 200`, res.status === 200, res.status);
    }

    // Sin sesión, /app redirige al login.
    const anonimo = await fetch(`${BASE}/app/dashboard.html`, { redirect: 'manual' });
    revisar('sin sesión redirige al login', anonimo.status === 302 && /login/.test(anonimo.headers.get('location') || ''),
      { status: anonimo.status, location: anonimo.headers.get('location') });

    r = await pedir('GET', '/clinico/expedientes/99999', null, 'admin');
    revisarEstado('recurso inexistente 404', r, 404);
  },
};
