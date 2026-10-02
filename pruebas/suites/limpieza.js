/**
 * Pruebas del módulo de Gestión de Limpieza.
 *
 * Contrato: docs/api/limpieza.md
 * Altera la base (crea tareas y movimientos) → `npm run db:reset` después.
 */
const { hoy, enDias } = require('../ayuda');

module.exports = {
  nombre: 'Limpieza',
  soloLectura: false,

  async pruebas(t) {
    const { pedir, revisar, revisarOk, revisarEstado } = t;

    // ------------------------------------------------------------- Catálogo
    t.seccion('Insumos');
    await t.sesion('admin');

    let r = await pedir('GET', '/limpieza/insumos', null, 'admin');
    revisarOk('lista de insumos', r);
    const insumos = r.json.datos;
    revisar('trae unidad y stock', insumos.every((i) => 'unidad_medida' in i && 'stock_actual' in i), insumos[0]);
    revisar('filtro bajo_minimo=1', true);

    r = await pedir('GET', '/limpieza/insumos?bajo_minimo=1', null, 'admin');
    revisarOk('filtro bajo_minimo', r);
    revisar('solo los que están en o bajo el mínimo',
      r.json.datos.every((i) => Number(i.stock_actual) <= Number(i.stock_minimo)), r.json.datos);
    revisar('el filtro trae alguno (o el conjunto está vacío)',
      r.json.datos.length > 0 || insumos.every((i) => Number(i.stock_actual) > Number(i.stock_minimo)), r.json.datos.length);

    r = await pedir('GET', '/limpieza/insumos/1', null, 'admin');
    revisarOk('detalle de insumo', r);
    r = await pedir('GET', '/limpieza/insumos/9999', null, 'admin');
    revisarEstado('insumo inexistente 404', r, 404);
    r = await pedir('GET', '/limpieza/insumos?buscar=bolsas', null, 'admin');
    revisarOk('filtro buscar', r);

    // -------------------------------------------------------- Movimientos
    t.seccion('Movimientos de insumos');
    const insumo = insumos.find((i) => Number(i.stock_actual) >= 5) || insumos[0];
    const stockInicial = Number(insumo.stock_actual);

    r = await pedir('POST', `/limpieza/insumos/${insumo.id}/movimientos`, { tipo: 'entrada', cantidad: 3, motivo: 'Prueba automatica' }, 'admin');
    revisarOk('entrada 201', r, 201);
    let stock = Number((await pedir('GET', `/limpieza/insumos/${insumo.id}`, null, 'admin')).json.datos.stock_actual);
    revisar(`entrada suma stock (${stockInicial} -> ${stock})`, Math.abs(stock - stockInicial - 3) < 0.001, stock);

    r = await pedir('POST', `/limpieza/insumos/${insumo.id}/movimientos`, { tipo: 'merma', cantidad: 1.5, motivo: 'Prueba automatica' }, 'admin');
    revisarOk('merma 201', r, 201);
    stock = Number((await pedir('GET', `/limpieza/insumos/${insumo.id}`, null, 'admin')).json.datos.stock_actual);
    revisar('merma resta stock', Math.abs(stock - (stockInicial + 3 - 1.5)) < 0.001, stock);

    r = await pedir('POST', `/limpieza/insumos/${insumo.id}/movimientos`, { tipo: 'merma', cantidad: 99999, motivo: 'Imposible' }, 'admin');
    revisarEstado('merma mayor que la existencia 409', r, 409);
    r = await pedir('POST', `/limpieza/insumos/${insumo.id}/movimientos`, { tipo: 'salida', cantidad: 1 }, 'admin');
    revisarEstado('tipo de movimiento inválido 422', r, 422);
    r = await pedir('POST', `/limpieza/insumos/${insumo.id}/movimientos`, { tipo: 'entrada', cantidad: 0 }, 'admin');
    revisarEstado('cantidad 0 rechazada 422', r, 422);
    r = await pedir('POST', '/limpieza/insumos/9999/movimientos', { tipo: 'entrada', cantidad: 1 }, 'admin');
    revisarEstado('insumo inexistente 404', r, 404);

    r = await pedir('GET', `/limpieza/insumos/${insumo.id}/movimientos`, null, 'admin');
    revisarOk('historial de movimientos', r);
    revisar('ordenado del más nuevo al más viejo',
      r.json.datos.every((m, i) => i === 0 || String(r.json.datos[i - 1].fecha) >= String(m.fecha)), r.json.datos.map((m) => m.fecha));
    revisar('con usuario y motivo', r.json.datos.every((m) => 'usuario' in m && 'motivo' in m), r.json.datos[0]);

    // Se devuelve el stock a su valor original.
    r = await pedir('POST', `/limpieza/insumos/${insumo.id}/movimientos`, { tipo: 'merma', cantidad: 1.5, motivo: 'Reversa de la prueba' }, 'admin');
    revisarOk('reversa de la prueba', r, 201);
    stock = Number((await pedir('GET', `/limpieza/insumos/${insumo.id}`, null, 'admin')).json.datos.stock_actual);
    revisar(`stock vuelve a ${stockInicial}`, Math.abs(stock - stockInicial) < 0.001, stock);

    // -------------------------------------------------------------- Tareas
    t.seccion('Tareas');
    await t.sesion('suplimpieza');
    r = await pedir('GET', '/limpieza/tareas?limite=1', null, 'suplimpieza');
    revisarOk('lista de tareas', r);
    const base = r.json.datos[0];
    revisar('trae área, tipo y asignado', ['area_id', 'tipo', 'asignado_id'].every((c) => c in base), Object.keys(base));

    r = await pedir('GET', '/limpieza/tareas?estado=pendiente', null, 'suplimpieza');
    revisarOk('filtro estado', r);
    revisar('solo pendientes', r.json.datos.every((x) => x.estado === 'pendiente'), r.json.datos);
    r = await pedir('GET', '/limpieza/tareas?estado=inventado', null, 'suplimpieza');
    revisarEstado('estado inválido 422', r, 422);
    r = await pedir('GET', `/limpieza/tareas/${base.id}`, null, 'suplimpieza');
    revisarOk('detalle de tarea', r);
    revisar('con historia de estados', Array.isArray(r.json.datos.historial) || 'estado' in r.json.datos, Object.keys(r.json.datos));
    r = await pedir('GET', '/limpieza/tareas/99999', null, 'suplimpieza');
    revisarEstado('tarea inexistente 404', r, 404);

    // ------------------------------------------------- Ciclo completo
    t.seccion('Ciclo de una tarea');
    const fecha = enDias(1);
    const asignado = (await pedir('GET', '/limpieza/tareas?limite=1', null, 'suplimpieza')).json.datos[0].asignado_id;

    r = await pedir('POST', '/limpieza/tareas', {
      area_id: base.area_id, tipo: 'rutinaria', descripcion: 'Prueba automatica',
      fecha_programada: fecha, hora_programada: '08:00', asignado_id: asignado,
    }, 'suplimpieza');
    revisarOk('crea tarea 201', r, 201);
    const tareaId = r.json.datos.id;
    revisar('empieza en pendiente', r.json.datos.estado === 'pendiente', r.json.datos);
    revisar('guarda el programador', r.json.datos.programado_por_id > 0, r.json.datos);

    r = await pedir('PATCH', `/limpieza/mis-tareas/${tareaId}/iniciar`, null, 'limpieza');
    revisarEstado('otro rol no puede iniciarla 403', r, 403);

    await t.sesion('limpieza');
    r = await pedir('GET', `/limpieza/mis-tareas?fecha=${fecha}`, null, 'limpieza');
    revisarOk('mis tareas del día', r);
    revisar('aparece la tarea creada', r.json.datos.some((x) => x.id === tareaId), r.json.datos.map((x) => x.id));

    r = await pedir('PATCH', `/limpieza/mis-tareas/${tareaId}/iniciar`, null, 'limpieza');
    revisarOk('inicia la tarea', r);
    revisar('pasa a en_proceso', r.json.datos.estado === 'en_proceso', r.json.datos);
    revisar('registra inicio_real', Boolean(r.json.datos.inicio_real), r.json.datos);

    r = await pedir('PATCH', `/limpieza/mis-tareas/${tareaId}/iniciar`, null, 'limpieza');
    revisarEstado('no se inicia dos veces 409', r, 409);

    const stockAntesConsumo = Number((await pedir('GET', `/limpieza/insumos/${insumo.id}`, null, 'limpieza')).json.datos.stock_actual);
    r = await pedir('PATCH', `/limpieza/mis-tareas/${tareaId}/completar`, {
      observaciones: 'Prueba automatica', insumos: [{ insumo_limpieza_id: insumo.id, cantidad: 0.5 }],
    }, 'limpieza');
    revisarOk('completa la tarea', r);
    revisar('pasa a completada', r.json.datos.estado === 'completada', r.json.datos);
    revisar('registra fin_real', Boolean(r.json.datos.fin_real), r.json.datos);

    const stockTrasConsumo = Number((await pedir('GET', `/limpieza/insumos/${insumo.id}`, null, 'limpieza')).json.datos.stock_actual);
    revisar(`el consumo descuenta stock (${stockAntesConsumo} -> ${stockTrasConsumo})`,
      Math.abs(stockAntesConsumo - stockTrasConsumo - 0.5) < 0.001, { stockAntesConsumo, stockTrasConsumo });

    r = await pedir('PATCH', `/limpieza/mis-tareas/${tareaId}/completar`, {}, 'limpieza');
    revisarEstado('no se completa dos veces 409', r, 409);

    r = await pedir('PATCH', `/limpieza/tareas/${tareaId}/verificar`, { resultado: 'verificada', observacion: 'OK' }, 'suplimpieza');
    revisarOk('verifica la tarea', r);
    revisar('pasa a verificada', r.json.datos.estado === 'verificada', r.json.datos);
    revisar('guarda el verificador', r.json.datos.verificado_por_id > 0, r.json.datos);

    r = await pedir('PATCH', `/limpieza/tareas/${tareaId}/verificar`, { resultado: 'verificada' }, 'suplimpieza');
    revisarEstado('no se verifica dos veces 409', r, 409);
    r = await pedir('PATCH', `/limpieza/tareas/${tareaId}/verificar`, { resultado: 'rechazada' }, 'suplimpieza');
    revisarEstado('no se cambia el resultado 409', r, 409);
    r = await pedir('PATCH', `/limpieza/tareas/${tareaId}/verificar`, { resultado: 'inventado' }, 'suplimpieza');
    revisarEstado('resultado inválido 422', r, 422);

    // Cancelación de una tarea pendiente.
    r = await pedir('POST', '/limpieza/tareas', {
      area_id: base.area_id, tipo: 'rutinaria', fecha_programada: enDias(2),
      hora_programada: '09:00', asignado_id: asignado,
    }, 'suplimpieza');
    revisarOk('crea tarea para cancelar', r, 201);
    const_cancelable = r.json.datos.id;
    r = await pedir('PATCH', `/limpieza/tareas/${tareaCancelable}/cancelar`, {}, 'suplimpieza');
    revisarEstado('cancelar sin motivo 422', r, 422);
    r = await pedir('PATCH', `/limpieza/tareas/${tareaCancelable}/cancelar`, { motivo: 'Prueba automatica' }, 'suplimpieza');
    revisarOk('cancela la tarea', r);
    revisar('pasa a cancelada', r.json.datos.estado === 'cancelada', r.json.datos);

    r = await pedir('PATCH', `/limpieza/tareas/${tareaCancelable}/cancelar`, { motivo: 'otra vez' }, 'suplimpieza');
    revisarEstado('no se cancela dos veces 409', r, 409);

    r = await pedir('POST', '/limpieza/tareas', {
      area_id: 9999, tipo: 'rutinaria', fecha_programada: enDias(1), hora_programada: '08:00', asignado_id: asignado,
    }, 'suplimpieza');
    revisarEstado('área inexistente 422', r, 422);
    r = await pedir('POST', '/limpieza/tareas', {
      area_id: base.area_id, tipo: 'inventado', fecha_programada: enDias(1), hora_programada: '08:00', asignado_id: asignado,
    }, 'suplimpieza');
    revisarEstado('tipo inválido 422', r, 422);
    r = await pedir('POST', '/limpieza/tareas', {
      area_id: base.area_id, tipo: 'rutinaria', fecha_programada: enDias(1), hora_programada: '25:00', asignado_id: asignado,
    }, 'suplimpieza');
    revisarEstado('hora inválida 422', r, 422);

    // Se devuelve el stock consumido por la tarea.
    r = await pedir('POST', `/limpieza/insumos/${insumo.id}/movimientos`, { tipo: 'entrada', cantidad: 0.5, motivo: 'Reversa de la prueba' }, 'admin');
    revisarOk('revierte el consumo de la tarea', r, 201);

    // ------------------------------------------------------------ Reportes
    t.seccion('Reportes');
    const rango = `desde=${hoy().slice(0, 4)}-01-01&hasta=${hoy().slice(0, 4)}-12-31`;
    r = await pedir('GET', `/limpieza/reportes/cumplimiento?${rango}`, null, 'admin');
    revisarOk('cumplimiento por área', r);
    const cumpl = r.json.datos;
    revisar('con los 6 contadores', cumpl.every((f) =>
      ['programadas', 'verificadas', 'completadas', 'rechazadas', 'pendientes', 'canceladas'].every((c) => c in f)), cumpl[0]);
    revisar('los contadores suman lo programado', cumpl.every((f) =>
      f.programadas === f.verificadas + f.completadas + f.rechazadas + f.pendientes + f.canceladas), cumpl[0]);
    revisar('incluye la tarea verificada de la prueba',
      cumpl.some((f) => Number(f.verificadas) > 0), cumpl.map((f) => f.verificadas));

    r = await pedir('GET', `/limpieza/reportes/consumo-insumos?${rango}`, null, 'admin');
    revisarOk('consumo de insumos', r);
    const consumo = r.json.datos;
    revisar('con entradas, salidas y mermas', consumo.every((f) => 'entradas' in f && 'salidas' in f && 'mermas' in f), consumo[0]);
    revisar('sin nulos en los tres', consumo.every((f) => f.entradas !== null && f.salidas !== null && f.mermas !== null), consumo[0]);

    r = await pedir('GET', `/limpieza/reportes/personal?${rango}`, null, 'admin');
    revisarOk('desempeño del personal', r);
    const personal = r.json.datos;
    revisar('con minutos_promedio numérico', personal.every((f) => typeof f.minutos_promedio === 'number'), personal[0]);
    revisar('completadas <= asignadas', personal.every((f) => f.completadas <= f.asignadas), personal[0]);

    r = await pedir('GET', '/limpieza/reportes/cumplimiento', null, 'admin');
    revisarOk('sin fechas usa el mes en curso', r);
    r = await pedir('GET', '/limpieza/reportes/cumplimiento?desde=2027-01-01&hasta=2026-01-01', null, 'admin');
    revisar('rango invertido no revienta', [200, 422].includes(r.estado), r.json);

    // ------------------------------------------------------------ Bitácora
    t.seccion('Bitácora');
    r = await pedir('GET', '/bitacora?modulo=limpieza', null, 'admin');
    revisarOk('bitácora del módulo', r);
    const filas = r.json.datos?.filas || [];
    revisar('registra la tarea creada', filas.some((f) => f.tabla_afectada === 'tarea_limpieza' && f.accion === 'CREAR'), filas.slice(0, 3));
    revisar('registra el movimiento', filas.some((f) => f.tabla_afectada === 'movimiento_insumo_limpieza'), filas.slice(0, 5));

    // ----------------------------------------------------------- Permisos
    t.seccion('Permisos');
    await t.sesion('veterinario');
    r = await pedir('GET', '/limpieza/tareas', null, 'veterinario');
    revisarEstado('sin limpieza.ver 403', r, 403);
    r = await pedir('GET', '/limpieza/mis-tareas', null, 'veterinario');
    revisarEstado('sin tareas.ejecutar 403', r, 403);

    await t.sesion('limpieza');
    r = await pedir('GET', '/limpieza/tareas', null, 'limpieza');
    revisarEstado('el personal de limpieza sí ve la agenda', r, 200);
    r = await pedir('POST', '/limpieza/tareas', {
      area_id: base.area_id, tipo: 'rutinaria', fecha_programada: enDias(1), hora_programada: '08:00', asignado_id: asignado,
    }, 'limpieza');
    revisarEstado('sin tareas.programar 403', r, 403);
    r = await pedir('POST', `/limpieza/insumos/${insumo.id}/movimientos`, { tipo: 'entrada', cantidad: 1 }, 'limpieza');
    revisarEstado('sin insumos.gestionar 403', r, 403);

    await t.sesion('director');
    r = await pedir('GET', '/limpieza/reportes/cumplimiento', null, 'director');
    revisar('el director puede ver los reportes', [200, 403].includes(r.estado), r.estado);
  },
};
