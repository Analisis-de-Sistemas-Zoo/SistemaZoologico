/**
 * Alimentación — Horarios de alimentación por jaula y resumen de cobertura.
 * Los gestionan el administrador y el veterinario; los demás roles los consultan.
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const A = window.Alimentacion;
  const puedeGestionar = Zoo.sesion.puede('alimentacion.horarios.gestionar');
  const form = $('formEditar');

  // ------------------------------------------------------------ Catálogos
  let jaulas = [];
  let cuidadores = [];
  try {
    [jaulas, cuidadores] = await Promise.all([
      Zoo.api.get('/api/comun/areas', { tipo: 'jaula' }),
      Zoo.api.get('/api/comun/usuarios', { roles: 'cuidador' }),
    ]);
  } catch (err) {
    Zoo.ui.error(err);
  }
  Zoo.ui.opciones($('fJaula'), jaulas, { vacio: 'Todas' });
  Zoo.ui.opciones($('fCuidador'), cuidadores, { vacio: 'Todos' });
  Zoo.ui.opciones($('fDia'), A.DIAS.map((d) => ({ id: d, nombre: E.texto('diaSemana', d) })), { vacio: 'Cualquier día' });
  Zoo.ui.opciones($('hJaula'), jaulas.map((j) => ({ ...j, nombre: j.habitat ? `${j.nombre} (${j.habitat})` : j.nombre })), { vacio: 'Selecciona la jaula' });
  Zoo.ui.opciones($('hCuidador'), cuidadores, { vacio: 'Selecciona el cuidador' });

  // El cuidador ve primero sus propios horarios.
  const yo = Zoo.sesion.usuario;
  if (yo?.rol === 'cuidador' && !new URLSearchParams(location.search).has('cuidador_id')) $('fCuidador').value = yo.id;

  // ---------------------------------------------------------- Días (form)
  $('hDias').innerHTML = A.DIAS.map((d) => `
    <input type="checkbox" id="dia-${d}" value="${d}" data-dia>
    <label for="dia-${d}" title="${esc(E.texto('diaSemana', d))}">${esc(E.texto('diaSemana', d).slice(0, 3))}</label>`).join('');
  const casillas = () => [...form.querySelectorAll('[data-dia]')];
  const marcarDias = (dias) => casillas().forEach((c) => { c.checked = dias.includes(c.value); });
  const RAPIDOS = { todos: A.DIAS, semana: A.DIAS.slice(0, 5), fin: ['sab', 'dom'] };
  form.querySelectorAll('[data-rapido]').forEach((b) => b.addEventListener('click', () => marcarDias(RAPIDOS[b.dataset.rapido])));

  // ------------------------------------------------------------ Cobertura
  async function cargarCobertura() {
    const tbody = $('tablaCobertura');
    try {
      const filas = await Zoo.api.get('/api/alimentacion/horarios/cobertura');
      const conAvisos = filas.filter((f) => f.avisos.length);
      const aviso = $('avisos');
      aviso.classList.toggle('d-none', !conAvisos.length);
      aviso.innerHTML = conAvisos.length
        ? `<div class="fw-semibold mb-1"><i class="bi bi-exclamation-triangle-fill me-2"></i>${conAvisos.length === 1 ? 'Una jaula necesita' : `${conAvisos.length} jaulas necesitan`} revisión</div>
           <ul class="mb-0">${conAvisos.map((f) => `<li><strong>${esc(f.area)}:</strong> ${f.avisos.map(esc).join(' ')}</li>`).join('')}</ul>`
        : '';
      Zoo.ui.tabla(tbody, filas, (f) => {
        const dias = A.DIAS.map((d) => `
          <span class="text-center" style="width:1.6rem" title="${esc(E.texto('diaSemana', d))}">
            <span class="d-block small text-secondary">${E.texto('diaCorto', d)}</span>
            <span class="d-block fw-semibold ${f.horarios_por_dia[d] && f.horarios_por_dia[d] < f.raciones_por_dia ? 'text-danger' : ''}">${f.horarios_por_dia[d] || '–'}</span>
          </span>`).join('');
        return `
          <tr>
            <td><div class="fw-semibold">${esc(f.area)}</div><div class="small text-secondary">${esc(f.habitat || '')}</div></td>
            <td class="text-end">${f.animales}${f.animales_con_dieta < f.animales ? `<div class="small text-danger">${f.animales - f.animales_con_dieta} sin dieta</div>` : ''}</td>
            <td class="text-end">${f.raciones_por_dia || '–'}</td>
            <td><div class="d-flex gap-1">${dias}</div></td>
            <td>${f.avisos.length ? f.avisos.map((a) => `<div class="small text-danger"><i class="bi bi-exclamation-circle me-1"></i>${esc(a)}</div>`).join('') : '<span class="estado estado-ok">Completo</span>'}</td>
          </tr>`;
      }, { vacio: 'No hay jaulas activas.' });
    } catch (err) {
      Zoo.ui.error(err);
    }
  }

  // ---------------------------------------------------------------- Lista
  const crud = Zoo.crud({
    url: '/api/alimentacion/horarios',
    nombre: 'horario',
    puedeEditar: puedeGestionar,
    icono: 'bi-clock',
    vacio: 'No hay horarios con esos filtros.',
    alCargar: cargarCobertura,
    alAbrir: (h) => {
      marcarDias(h ? h.dias : A.DIAS);
      if (!h && $('fJaula').value) $('hJaula').value = $('fJaula').value;
    },
    antesDeGuardar: (d) => ({ ...d, dias: casillas().filter((c) => c.checked).map((c) => c.value) }),
    fila: (h, puede) => `
      <tr class="${Number(h.activo) ? '' : 'text-secondary'}">
        <td class="fw-semibold fs-6">${esc(h.hora)}</td>
        <td><div class="fw-semibold">${esc(h.area)}</div><div class="small text-secondary">${esc(h.habitat || '')}</div>
          ${h.observaciones ? `<div class="small text-secondary"><i class="bi bi-info-circle me-1"></i>${esc(h.observaciones)}</div>` : ''}</td>
        <td>${A.diasHtml(h.dias)}</td>
        <td>${esc(h.cuidador)}${Number(h.cuidador_activo) ? '' : '<div class="small text-danger">Usuario inactivo</div>'}</td>
        <td class="text-end">${h.animales}</td>
        <td>${E.estado('activo', Number(h.activo))}</td>
        <td class="text-end text-nowrap">${Zoo.crud.botones(h, { editar: puede, estado: puede })}</td>
      </tr>`,
  });
  crud.recargar();
});
