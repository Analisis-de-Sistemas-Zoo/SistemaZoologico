/**
 * Alimentación — Raciones del día.
 * El cuidador ve sus turnos y registra lo que sirvió; el resto de roles consulta.
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const A = window.Alimentacion;
  const puedeRegistrar = Zoo.sesion.puede('alimentacion.raciones.registrar');
  const yo = Zoo.sesion.usuario;
  const filtros = $('formFiltros');

  // ------------------------------------------------------------ Filtros
  try {
    const [cuidadores, jaulas] = await Promise.all([
      Zoo.api.get('/api/comun/usuarios', { roles: 'cuidador' }),
      Zoo.api.get('/api/comun/areas', { tipo: 'jaula' }),
    ]);
    Zoo.ui.opciones($('fCuidador'), cuidadores.map((c) => ({ ...c, nombre: c.id === yo?.id ? `${c.nombre} (yo)` : c.nombre })), { vacio: 'Todos' });
    Zoo.ui.opciones($('fJaula'), jaulas, { vacio: 'Todas' });
  } catch (err) {
    Zoo.ui.error(err);
  }
  filtros.fecha.value = Zoo.ui.hoy();
  filtros.fecha.max = Zoo.ui.hoy();
  if (puedeRegistrar) filtros.cuidador_id.value = yo.id;

  let datos = null;

  // ------------------------------------------------------------ Resumen
  function pintarResumen(r, esHoy) {
    const tarjeta = (valor, titulo, icono, color = '') => `
      <div class="resumen-item"><span class="icono ${color}"><i class="bi ${icono}"></i></span>
        <span><span class="valor">${esc(valor)}</span><span class="etiqueta">${titulo}</span></span></div>`;
    const porcentaje = r.programadas ? Math.round((r.registradas / r.programadas) * 100) : 0;
    $('resumen').innerHTML =
      tarjeta(r.turnos, r.turnos === 1 ? 'Turno' : 'Turnos', 'bi-clock') +
      tarjeta(`${r.registradas} de ${r.programadas}`, `Raciones registradas (${porcentaje} %)`, 'bi-check2-circle') +
      tarjeta(r.pendientes, esHoy ? 'Raciones pendientes' : 'Raciones sin registrar', 'bi-basket', r.pendientes ? 'alerta' : '') +
      tarjeta(r.turnos_atrasados, 'Turnos atrasados', 'bi-alarm', r.turnos_atrasados ? 'peligro' : 'neutro');
  }

  // ------------------------------------------------------------- Turnos
  function racionHtml(t, a, r) {
    const reg = r.registro;
    const suficiente = Number(r.existencia) >= Number(r.cantidad_racion);
    let derecha;
    if (reg) {
      const propia = reg.usuario_id === yo?.id;
      derecha = `
        ${E.estado('consumo', reg.consumo)}
        <span class="small text-secondary">${esc(A.cantidad(reg.cantidad_suministrada, r.unidad_medida))} · ${esc(reg.hora)}${propia ? '' : ` · ${esc(reg.usuario)}`}</span>
        ${puedeRegistrar && propia && datos.es_hoy ? `<button class="btn btn-sm btn-light" type="button" data-deshacer="${reg.id}" title="Deshacer"><i class="bi bi-arrow-counterclockwise"></i><span class="visually-hidden">Deshacer</span></button>` : ''}
        ${reg.observaciones ? `<div class="w-100 text-end small text-secondary">${esc(reg.observaciones)}</div>` : ''}`;
    } else if (puedeRegistrar && datos.es_hoy) {
      derecha = `${suficiente ? '' : `<span class="small text-danger"><i class="bi bi-exclamation-triangle me-1"></i>En bodega hay ${esc(A.cantidad(r.existencia, r.unidad_medida))}</span>`}
        <button class="btn btn-sm btn-outline-primary" type="button" data-registrar="${t.horario_id}|${a.animal_id}|${r.dieta_id}">Registrar</button>`;
    } else {
      derecha = `<span class="small text-secondary">${datos.es_hoy ? 'Pendiente' : 'Sin registrar'}</span>`;
    }
    return `
      <div class="racion">
        <div><span class="fw-semibold">${esc(r.alimento)}</span> <span class="text-nowrap">${esc(A.cantidad(r.cantidad_racion, r.unidad_medida))}</span>
          ${r.indicaciones ? `<div class="small text-secondary">${esc(r.indicaciones)}</div>` : ''}</div>
        <div class="racion-registro">${derecha}</div>
      </div>`;
  }

  function turnoHtml(t) {
    const pendientes = t.total - t.registradas;
    const boton = puedeRegistrar && datos.es_hoy && pendientes > 1
      ? `<button class="btn btn-sm btn-primary ms-auto" type="button" data-turno="${t.horario_id}"><i class="bi bi-check2-all me-1"></i>Registrar ${pendientes} como completas</button>`
      : '';
    return `
      <article class="turno ${t.estado}">
        <header class="turno-encabezado">
          <div class="turno-hora">${esc(t.hora)}</div>
          <div>
            <div class="fw-semibold">${esc(t.area)} <span class="text-secondary fw-normal small">· ${t.numero}.° comida del día</span></div>
            <div class="small text-secondary">${esc(t.cuidador)}${t.observaciones ? ` · <i class="bi bi-info-circle"></i> ${esc(t.observaciones)}` : ''}</div>
          </div>
          <div class="d-flex align-items-center gap-2">${E.estado('estadoTurno', t.estado)}<span class="small text-secondary">${t.registradas}/${t.total}</span></div>
          ${boton}
        </header>
        ${t.animales.map((a) => `
          <div class="turno-animal">
            <div><div class="fw-semibold">${esc(a.nombre)}</div>
              <div class="small text-secondary">${esc(a.especie)} · ${esc(a.codigo)}</div>
              ${a.estado_salud !== 'sano' ? `<div class="mt-1">${E.estado('estadoSalud', a.estado_salud)}</div>` : ''}</div>
            <div>${a.raciones.map((r) => racionHtml(t, a, r)).join('')}</div>
          </div>`).join('')}
      </article>`;
  }

  async function cargar() {
    const contenedor = $('turnos');
    try {
      datos = await Zoo.api.get('/api/alimentacion/raciones', Zoo.ui.leerFormulario(filtros));
      pintarResumen(datos.resumen, datos.es_hoy);
      contenedor.innerHTML = datos.turnos.length
        ? datos.turnos.map(turnoHtml).join('')
        : '<div class="panel"><div class="tabla-vacia"><i class="bi bi-cup-hot"></i>No hay turnos de alimentación con esos filtros.</div></div>';
    } catch (err) {
      Zoo.ui.error(err);
    }
  }
  let espera;
  filtros.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(cargar, 250); });
  filtros.addEventListener('submit', (e) => e.preventDefault());

  // ----------------------------------------------------------- Registrar
  const form = $('formRacion');
  const modal = new bootstrap.Modal('#modalRacion');
  let actual = null;

  const buscar = (horarioId, animalId, dietaId) => {
    const t = datos.turnos.find((x) => x.horario_id === horarioId);
    const a = t?.animales.find((x) => x.animal_id === animalId);
    return { t, a, r: a?.raciones.find((x) => x.dieta_id === dietaId) };
  };

  function abrir(horarioId, animalId, dietaId) {
    actual = buscar(horarioId, animalId, dietaId);
    const { t, a, r } = actual;
    form.reset();
    Zoo.ui.limpiarErrores(form);
    $('tituloRacion').textContent = `Ración de ${a.nombre}`;
    $('infoRacion').innerHTML = `
      <div class="fw-semibold">${esc(r.alimento)}</div>
      <div class="small text-secondary">${esc(t.hora)} · ${esc(t.area)}${r.indicaciones ? ` · ${esc(r.indicaciones)}` : ''}</div>`;
    $('rUnidad').textContent = E.texto('unidadAlimentoCorta', r.unidad_medida);
    $('rCantidad').value = r.cantidad_racion;
    $('rSugerida').textContent = `Según la dieta: ${A.cantidad(r.cantidad_racion, r.unidad_medida)}. En bodega: ${A.cantidad(r.existencia, r.unidad_medida)}.`;
    modal.show();
  }

  async function enviar(horarioId, items, boton, formulario) {
    Zoo.ui.cargando(boton, true);
    try {
      const respuesta = await Zoo.api.post('/api/alimentacion/raciones', { horario_id: horarioId, items });
      Zoo.ui.toast(respuesta.length === 1 ? 'Ración registrada.' : `${respuesta.length} raciones registradas.`, 'exito');
      return true;
    } catch (err) {
      Zoo.ui.error(err, formulario);
      return false;
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Zoo.ui.leerFormulario(form);
    const { t, a, r } = actual;
    const listo = await enviar(t.horario_id, [{
      animal_id: a.animal_id, dieta_id: r.dieta_id, cantidad_suministrada: d.cantidad_suministrada, consumo: d.consumo, observaciones: d.observaciones,
    }], form.querySelector('[type="submit"]'), form);
    if (listo) { modal.hide(); cargar(); }
  });

  $('turnos').addEventListener('click', async (e) => {
    const registrar = e.target.closest('[data-registrar]');
    if (registrar) {
      const [h, a, d] = registrar.dataset.registrar.split('|').map(Number);
      abrir(h, a, d);
      return;
    }
    const todo = e.target.closest('[data-turno]');
    if (todo) {
      const t = datos.turnos.find((x) => x.horario_id === Number(todo.dataset.turno));
      const items = [];
      t.animales.forEach((a) => a.raciones.filter((r) => !r.registro).forEach((r) =>
        items.push({ animal_id: a.animal_id, dieta_id: r.dieta_id, cantidad_suministrada: r.cantidad_racion, consumo: 'completo' })));
      const ok = await Zoo.ui.confirmar(
        `Se registrarán ${items.length} raciones del turno de las ${t.hora} en ${t.area} con la cantidad de la dieta y "Comió todo". Si algún animal dejó comida, regístralo por separado.`,
        { titulo: 'Registrar turno completo', aceptar: 'Registrar' }
      );
      if (ok && (await enviar(t.horario_id, items, todo))) cargar();
      return;
    }
    const deshacer = e.target.closest('[data-deshacer]');
    if (deshacer) {
      const ok = await Zoo.ui.confirmar('¿Deshacer esta ración? El alimento vuelve a los lotes de donde salió.', { titulo: 'Deshacer ración', aceptar: 'Deshacer', peligro: true });
      if (!ok) return;
      try {
        await Zoo.api.del(`/api/alimentacion/raciones/${deshacer.dataset.deshacer}`);
        Zoo.ui.toast('Ración deshecha.', 'exito');
        cargar();
      } catch (err) {
        Zoo.ui.error(err);
      }
    }
  });

  cargar();
});
