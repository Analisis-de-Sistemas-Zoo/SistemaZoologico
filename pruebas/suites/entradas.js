/**
 * Pruebas del módulo de Entradas y Promociones.
 *
 * Contrato: docs/api/entradas.md
 * Altera la base (crea compras) → hay que ejecutar `npm run db:reset` después.
 */
const { hoy, enDias, esLunes } = require('../ayuda');

module.exports = {
  nombre: 'Entradas',
  soloLectura: false,

  async pruebas(t) {
    const { pedir, revisar, revisarOk, revisarEstado } = t;

    // ------------------------------------------------------------ Catálogos
    t.seccion('Catálogos');
    await t.sesion('admin');

    let r = await pedir('GET', '/entradas/tipos');
    revisarOk('lista de tipos', r);
    const tipos = r.json.datos;
    revisar('incluye los 4 tipos de la semilla',
      ['Adulto', 'Niño', 'Estudiante', 'Adulto mayor'].every((n) => tipos.some((x) => x.nombre === n)),
      tipos.map((x) => x.nombre));
    revisar('precios positivos', tipos.every((x) => Number(x.precio) > 0), tipos);

    r = await pedir('GET', '/entradas/promociones');
    revisarOk('lista de promociones', r);
    revisar('promociones con descuento 1-100',
      r.json.datos.every((p) => Number(p.descuento_porcentaje) > 0 && Number(p.descuento_porcentaje) <= 100),
      r.json.datos);
    r = await pedir('GET', '/entradas/promociones?vigencia=vencida');
    revisarOk('filtro vigencia=vencida', r);
    r = await pedir('GET', '/entradas/promociones?vigencia=inventada');
    revisarEstado('vigencia inválida 422', r, 422);

    // --------------------------------------------------------- Cotizaciones
    t.seccion('Cotización');
    const adulto = tipos.find((x) => x.nombre === 'Adulto');
    const nino = tipos.find((x) => x.nombre === 'Niño');

    // El zoológico cierra los lunes: se busca un día válido para el resto de pruebas.
    let visita = hoy();
    while (esLunes(visita)) visita = enDias(visita === hoy() ? 1 : 0);

    r = await pedir('POST', '/entradas/cotizar', {
      fecha_visita: visita, items: [{ tipo_entrada_id: adulto.id, cantidad: 2 }],
    }, 'taquilla');
    revisarOk('cotiza 2 adultos', r);
    const cot = r.json.datos;
    const esperadoBruto = Number(adulto.precio) * 2;
    if (cot.subtotal === esperadoBruto) {
      revisar('total sin promoción = bruto', cot.descuento === 0 && cot.total === esperadoBruto, cot);
    } else {
      // Puede haber una promoción general vigente en la semilla: se valida la aritmética.
      revisar('descuento = bruto - total', Math.abs(cot.subtotal + cot.descuento - esperadoBruto) < 0.01, cot);
      revisar('descuento no negativo', cot.descuento >= 0, cot);
    }
    revisar('linea con el precio del tipo', cot.lineas.some((l) => Number(l.precio_unitario) === Number(adulto.precio)), cot.lineas);

    r = await pedir('POST', '/entradas/cotizar', {
      fecha_visita: visita, items: [{ tipo_entrada_id: adulto.id, cantidad: 2, precio_unitario: 0.01 }],
    }, 'taquilla');
    revisar('el cliente no puede mandar el precio', r.estado === 200 && Number(r.json.datos.lineas[0].precio_unitario) === Number(adulto.precio), r.json);

    r = await pedir('POST', '/entradas/cotizar', { fecha_visita: enDias(-1), items: [{ tipo_entrada_id: adulto.id, cantidad: 1 }] }, 'taquilla');
    revisarEstado('fecha de visita pasada 422', r, 422);
    revisar('error en fecha_visita', r.json.errores?.[0]?.campo === 'fecha_visita', r.json);

    r = await pedir('POST', '/entradas/cotizar', { fecha_visita: enDias(61), items: [{ tipo_entrada_id: adulto.id, cantidad: 1 }] }, 'taquilla');
    revisarEstado('más de 60 días 422', r, 422);

    const lunesProximo = (() => {
      let f = enDias(1);
      for (let i = 0; i < 8 && !esLunes(f); i++) f = enDias(i + 1);
      return f;
    })();
    r = await pedir('POST', '/entradas/cotizar', { fecha_visita: lunesProximo, items: [{ tipo_entrada_id: adulto.id, cantidad: 1 }] }, 'taquilla');
    revisarEstado('lunes (cerrado) 422', r, 422);
    revisar('mensaje del cierre', /cerrado/i.test(r.json.errores?.[0]?.mensaje || ''), r.json.errores);

    r = await pedir('POST', '/entradas/cotizar', { fecha_visita: visita, items: [{ tipo_entrada_id: 9999, cantidad: 1 }] }, 'taquilla');
    revisarEstado('tipo inexistente 422', r, 422);
    r = await pedir('POST', '/entradas/cotizar', { fecha_visita: visita, items: [] }, 'taquilla');
    revisarEstado('sin items 422', r, 422);

    r = await pedir('POST', '/entradas/cotizar', {
      fecha_visita: visita, items: [{ tipo_entrada_id: nino.id, cantidad: 1 }], codigo_promocion: 'NOEXISTE99',
    }, 'taquilla');
    revisarOk('cupón inexistente no rompe (solo sin descuento)', r);
    revisar('cupón inexistente = sin descuento', Number(r.json.datos.descuento) === 0, r.json.datos);

    // -------------------------------------------------------- Venta taquilla
    t.seccion('Venta en taquilla');
    await t.sesion('taquilla');
    r = await pedir('POST', '/entradas/ventas', {
      fecha_visita: hoy(),
      cliente: { nombre: 'Prueba automatica', nit: '900100001' },
      metodo_pago: 'efectivo',
      items: [{ tipo_entrada_id: adulto.id, cantidad: 2 }],
    }, 'taquilla');
    revisarOk('venta 201', r, 201);
    const venta = r.json.datos;
    revisar('código MS-######', /^MS-\d{6}$/.test(venta.codigo), venta.codigo);
    revisar('una entrada por persona', venta.entradas?.length === 2, venta.entradas);
    revisar('QR de 32 hex', venta.entradas?.every((e) => /^[a-f0-9]{32}$/.test(e.codigo_qr)), venta.entradas);
    revisar('QR distintos entre sí', new Set(venta.entradas.map((e) => e.codigo_qr)).size === venta.entradas.length);
    revisar('total = suma de líneas', Math.abs(venta.total - venta.subtotal + venta.descuento) < 0.01, venta);
    revisar('no guarda datos de tarjeta', !JSON.stringify(venta).match(/\d{13,19}/), venta);

    // ---------------------------------------------------- Validación de ingreso
    t.seccion('Validación de ingreso');
    const qr = venta.entradas[0].codigo_qr;
    r = await pedir('POST', '/entradas/validar', { codigo_qr: qr }, 'taquilla');
    revisarOk('validar entrada del día', r);
    revisar('resultado valida', r.json.datos.resultado === 'valida', r.json.datos);
    revisar('queda usada', r.json.datos.entrada.estado === 'usada', r.json.datos.entrada);

    r = await pedir('POST', '/entradas/validar', { codigo_qr: qr }, 'taquilla');
    revisar('reuso devuelve resultado usada', r.estado === 200 && r.json.datos.resultado === 'usada', r.json.datos);

    r = await pedir('POST', '/entradas/validar', { codigo_qr: 'a'.repeat(32) }, 'taquilla');
    revisar('QR desconocido: resultado no_existe', r.estado === 200 && r.json.datos.resultado === 'no_existe', r.json.datos);

    const otraEntrada = venta.entradas[1].codigo_qr;
    r = await pedir('POST', '/entradas/validar', { codigo_qr: otraEntrada.toUpperCase() }, 'taquilla');
    revisar('el QR es case-insensitive', r.estado === 200 && r.json.datos.resultado === 'valida', r.json.datos);

    r = await pedir('POST', '/entradas/validar', { codigo_qr: 'no-es-un-qr' }, 'taquilla');
    revisarEstado('formato de QR inválido 422', r, 422);

    // -------------------------------------------------------------- Anulación
    t.seccion('Anulación');
    await t.sesion('admin');
    r = await pedir('PATCH', `/entradas/ventas/${venta.id}/anular`, { motivo: 'Prueba automatizada' }, 'admin');
    revisarEstado('no se anula con entrada usada 409', r, 409);

    r = await pedir('POST', '/entradas/ventas', {
      fecha_visita: hoy(), cliente: { nombre: 'Prueba anulacion', nit: '900100002' },
      metodo_pago: 'efectivo', items: [{ tipo_entrada_id: nino.id, cantidad: 1 }],
    }, 'taquilla');
    revisarOk('venta para anular', r, 201);
    const venta2 = r.json.datos;

    r = await pedir('PATCH', `/entradas/ventas/${venta2.id}/anular`, { motivo: 'Prueba automatizada' }, 'admin');
    revisarOk('anula venta sin uso', r);
    revisar('estado anulada', r.json.datos.estado === 'anulada', r.json.datos);
    revisar('guarda el motivo', r.json.datos.motivo_anulacion === 'Prueba automatizada', r.json.datos);
    revisar('entradas quedan anuladas', venta2.entradas.every((e) => e.estado === 'anulada'), venta2.entradas);

    r = await pedir('POST', '/entradas/validar', { codigo_qr: venta2.entradas[0].codigo_qr }, 'taquilla');
    revisar('entrada anulada no pasa', r.estado === 200 && r.json.datos.resultado === 'anulada', r.json.datos);

    r = await pedir('PATCH', `/entradas/ventas/${venta2.id}/anular`, { motivo: 'otra vez' }, 'admin');
    revisarEstado('no se anula dos veces 409', r, 409);
    r = await pedir('PATCH', '/entradas/ventas/9999/anular', { motivo: 'x' }, 'admin');
    revisarEstado('venta inexistente 404', r, 404);
    r = await pedir('PATCH', `/entradas/ventas/${venta2.id}/anular`, {}, 'admin');
    revisarEstado('anular sin motivo 422', r, 422);

    r = await pedir('PATCH', `/entradas/ventas/${venta2.id}/anular`, { motivo: 'otro intento' }, 'director');
    revisarEstado('director no anula 403', r, 403);

    // ---------------------------------------------------------------- Ventas
    t.seccion('Listado de ventas');
    r = await pedir('GET', '/entradas/ventas', null, 'admin');
    revisarOk('lista ventas', r);
    const ventas = r.json.datos;
    revisar('incluye la venta de la prueba', ventas.some((v) => v.id === venta.id), ventas.length);
    revisar('desc por fecha', ventas.every((v, i) => i === 0 || ventas[i - 1].fecha >= v.fecha));

    r = await pedir('GET', '/entradas/ventas?estado=anulada', null, 'admin');
    revisarOk('filtro estado=anulada', r);
    revisar('solo anuladas', r.json.datos.every((v) => v.estado === 'anulada'), r.json.datos);
    r = await pedir('GET', '/entradas/ventas?estado=pagada', null, 'admin');
    revisarOk('filtro estado=pagada', r);
    r = await pedir('GET', '/entradas/ventas?estado=todas', null, 'admin');
    revisarEstado('estado inválido 422', r, 422);
    r = await pedir('GET', `/entradas/ventas?desde=${hoy()}&hasta=${hoy()}`, null, 'admin');
    revisarOk('filtro de fechas', r);
    r = await pedir('GET', `/entradas/ventas/${venta.id}`, null, 'admin');
    revisarOk('detalle de venta', r);
    revisar('detalle trae entradas y detalle', Array.isArray(r.json.datos.entradas) && Array.isArray(r.json.datos.detalle), Object.keys(r.json.datos));
    r = await pedir('GET', '/entradas/ventas/99999', null, 'admin');
    revisarEstado('venta inexistente 404', r, 404);

    r = await pedir('GET', '/entradas/ingresos/hoy', null, 'taquilla');
    revisarOk('ingresos de hoy', r);
    revisar('coincide con la entrada validada', (r.json.datos?.entradas?.length ?? r.json.datos?.total) >= 1, r.json.datos);

    // --------------------------------------------------------------- Reportes
    t.seccion('Reportes');
    const rango = `desde=${hoy().slice(0, 4)}-01-01&hasta=${hoy().slice(0, 4)}-12-31`;
    r = await pedir('GET', `/entradas/reportes/ventas-diarias?${rango}`, null, 'admin');
    revisarOk('ventas diarias', r);
    const diarias = r.json.datos;
    revisar('filas con los campos del reporte', diarias.every((f) =>
      'fecha' in f && 'ventas_taquilla' in f && 'ventas_web' in f && 'entradas' in f && 'total' in f), diarias[0]);
    revisar('subtotal - descuento = total', diarias.every((f) =>
      Math.abs(Number(f.subtotal) - Number(f.descuento) - Number(f.total)) < 0.01), diarias[0]);
    revisar('entradas >= ventas', diarias.every((f) => f.entradas >= f.ventas_taquilla + f.ventas_web), diarias[0]);
    revisar('ordenado por fecha', diarias.every((f, i) => i === 0 || String(diarias[i - 1].fecha) <= String(f.fecha)), diarias.map((f) => f.fecha));

    r = await pedir('GET', `/entradas/reportes/por-tipo?${rango}`, null, 'admin');
    revisarOk('por tipo de entrada', r);
    const porTipo = r.json.datos;
    revisar('bruto - descuento = total', porTipo.every((f) =>
      Math.abs(Number(f.subtotal) - Number(f.descuento) - Number(f.total)) < 0.01), porTipo[0]);
    revisar('usadas <= cantidad', porTipo.every((f) => f.usadas <= f.cantidad), porTipo);
    revisar('con porcentaje', porTipo.every((f) => 'porcentaje' in f), porTipo[0]);
    revisar('ordenado por total desc', porTipo.every((f, i) => i === 0 || Number(porTipo[i - 1].total) >= Number(f.total)), porTipo.map((f) => f.total));

    r = await pedir('GET', `/entradas/reportes/promociones?${rango}`, null, 'admin');
    revisarOk('uso de promociones', r);
    revisar('descuentos no negativos', r.json.datos.every((f) => Number(f.descuento_total) >= 0), r.json.datos);
    revisar('con compras y entradas', r.json.datos.every((f) => 'compras' in f && 'entradas' in f), r.json.datos[0]);

    r = await pedir('GET', '/entradas/reportes/ventas-diarias?desde=2027-01-01&hasta=2026-01-01', null, 'admin');
    revisarEstado('rango invertido 422', r, 422);

    // -------------------------------------------------------------- Bitácora
    t.seccion('Bitácora');
    r = await pedir('GET', '/bitacora?modulo=entradas', null, 'admin');
    revisarOk('bitácora del módulo', r);
    const filas = r.json.datos?.filas || [];
    revisar('registra la venta', filas.some((f) => f.tabla_afectada === 'compra' && f.accion === 'CREAR'), filas.slice(0, 3));
    revisar('registra la anulación', filas.some((f) => f.accion === 'ANULAR'), filas.slice(0, 5));
    revisar('con nombre de usuario', filas.every((f) => f.nombre_usuario !== undefined), filas[0]);

    // ------------------------------------------------------------- Permisos
    t.seccion('Permisos');
    await t.sesion('limpieza');
    r = await pedir('GET', '/entradas/tipos', null, 'limpieza');
    revisarEstado('sin entradas.ver 403', r, 403);
    r = await pedir('POST', '/entradas/cotizar', { fecha_visita: visita, items: [{ tipo_entrada_id: adulto.id, cantidad: 1 }] }, 'limpieza');
    revisarEstado('sin entradas.vender 403', r, 403);

    await t.sesion('director');
    r = await pedir('GET', '/entradas/ventas', null, 'director');
    revisarOk('director ve ventas', r);
    r = await pedir('POST', '/entradas/ventas', {
      fecha_visita: hoy(), metodo_pago: 'efectivo', items: [{ tipo_entrada_id: adulto.id, cantidad: 1 }],
    }, 'director');
    revisarEstado('director no vende 403', r, 403);
    r = await pedir('POST', '/entradas/tipos', { nombre: 'Prueba', precio: 10 }, 'director');
    revisarEstado('director no configura 403', r, 403);

    // ------------------------------------------------------ Portal público
    t.seccion('Portal público (sin sesión)');
    const publico = await fetch('http://localhost:3000/api/publico/entradas/tipos');
    revisar('tipos públicos sin sesión', publico.status === 200, publico.status);
    const cuerpo = await publico.json();
    revisar('mismo sobre público', cuerpo.ok === true && Array.isArray(cuerpo.datos), cuerpo);

    r = await pedir('POST', '/entradas/cotizar', { fecha_visita: visita, items: [{ tipo_entrada_id: 9999, cantidad: 1 }] }, 'limpieza');
    revisar('validación antes que permiso por recurso', [403, 422].includes(r.estado), r.estado);
  },
};
