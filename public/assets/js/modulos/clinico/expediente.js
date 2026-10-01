/**
 * Clínico — Expediente de un animal: datos, consultas y aplicaciones.
 * Contrato: docs/api/clinico.md → GET /expedientes/:animal_id
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const contenedor = document.getElementById('contenido');
  const animalId = Number(new URLSearchParams(location.search).get('animal'));
  const puedeRegistrar = Zoo.sesion.puede('clinico.registrar');

  if (!animalId) {
    contenedor.innerHTML = '<div class="alert alert-warning">No se indicó el animal. Vuelve a la lista de expedientes.</div>';
    return;
  }

  let exp;
  try {
    exp = await Zoo.api.get(`/api/clinico/expedientes/${animalId}`);
  } catch (err) {
    contenedor.innerHTML = err.pendiente ? Zoo.ui.pendienteHtml(err.message) : `<div class="alert alert-danger">${esc(err.message)}</div>`;
    return;
  }

  const a = exp.animal;
  document.title = `Expediente de ${a.nombre} | Mirada Salvaje`;
  const edad = a.edad_anios === null || a.edad_anios === undefined ? 'Desconocida' : `${a.edad_anios} ${a.edad_anios === 1 ? 'año' : 'años'}`;

  const consultas = exp.consultas.length
    ? exp.consultas.map((c) => `
        <article class="border-bottom py-3">
          <div class="d-flex flex-wrap justify-content-between gap-2 mb-1">
            <div><strong>${esc(Zoo.ui.fechaHora(c.fecha))}</strong> ${E.estado('tipoConsulta', c.tipo)}</div>
            <div class="small text-secondary">${esc(c.veterinario)}</div>
          </div>
          <div class="fw-semibold">${esc(c.motivo)}</div>
          ${c.diagnostico ? `<div><span class="text-secondary">Diagnóstico:</span> ${esc(c.diagnostico)}</div>` : ''}
          ${c.tratamiento ? `<div><span class="text-secondary">Tratamiento:</span> ${esc(c.tratamiento)}</div>` : ''}
          <div class="small mt-1">Quedó: ${E.estado('estadoSalud', c.estado_salud_resultante)}${c.proxima_revision ? `, próxima revisión ${esc(Zoo.ui.fecha(c.proxima_revision))}` : ''}</div>
        </article>`).join('')
    : '<p class="text-secondary mb-0">Este animal todavía no tiene consultas registradas.</p>';

  contenedor.innerHTML = `
    <div class="pagina-encabezado">
      <div>
        <h2>${esc(a.nombre)} <span class="text-secondary fs-5 fw-normal">${esc(a.codigo)}</span></h2>
        <p>${esc(a.especie)} <span class="fst-italic">${esc(a.nombre_cientifico || '')}</span>, ${esc(a.area)}</p>
      </div>
      ${puedeRegistrar ? `<div class="d-flex flex-wrap gap-2">
        <a class="btn btn-outline-primary" href="/app/clinico/aplicaciones.html?nueva=1&animal_id=${a.id}"><i class="bi bi-eyedropper me-2"></i>Registrar aplicación</a>
        <a class="btn btn-primary" href="/app/clinico/consultas.html?nueva=1&animal_id=${a.id}"><i class="bi bi-plus-lg me-2"></i>Nueva consulta</a>
      </div>` : ''}
    </div>

    <div class="resumen mb-4">
      <div class="resumen-item"><span class="icono"><i class="bi bi-heart-pulse"></i></span><span><span class="d-block mb-1">${E.estado('estadoSalud', a.estado_salud)}</span><span class="etiqueta">Estado de salud</span></span></div>
      <div class="resumen-item"><span class="icono neutro"><i class="bi bi-speedometer2"></i></span><span><span class="valor">${a.peso_kg ? esc(Zoo.ui.numero(a.peso_kg, 1)) : '—'}</span><span class="etiqueta">Peso (kg)</span></span></div>
      <div class="resumen-item"><span class="icono neutro"><i class="bi bi-calendar3"></i></span><span><span class="valor">${esc(edad)}</span><span class="etiqueta">Edad, ${esc(E.texto('sexo', a.sexo).toLowerCase())}</span></span></div>
      <div class="resumen-item"><span class="icono neutro"><i class="bi bi-clipboard2-pulse"></i></span><span><span class="valor">${exp.consultas.length}</span><span class="etiqueta">Consultas registradas</span></span></div>
    </div>

    <div class="row g-4">
      <div class="col-12">
        <section class="panel">
          <div class="panel-encabezado"><h3>Historial de consultas</h3></div>
          <div class="panel-cuerpo pt-0">${consultas}</div>
        </section>
      </div>
      <div class="col-12">
        <section class="panel">
          <div class="panel-encabezado"><h3>Medicamentos, vacunas y vitaminas</h3></div>
          <div class="panel-cuerpo">${Clinico.tablaAplicaciones(exp.aplicaciones)}</div>
        </section>
      </div>
    </div>`;
  document.querySelector('.app-superior h1').textContent = `Expediente de ${a.nombre}`;
});
