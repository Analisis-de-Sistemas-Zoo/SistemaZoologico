/**
 * Alimentación — Dietas: catálogo de dietas por especie o por animal y vista de qué come cada animal.
 * Solo el veterinario las registra; los demás roles las consultan.
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const A = window.Alimentacion;
  const puedeGestionar = Zoo.sesion.puede('alimentacion.dietas.gestionar');
  const form = $('formEditar');

  // ------------------------------------------------------------ Catálogos
  let especies = [];
  let animales = [];
  let alimentos = [];
  let jaulas = [];
  try {
    [especies, animales, alimentos, jaulas] = await Promise.all([
      Zoo.api.get('/api/comun/especies'),
      Zoo.api.get('/api/comun/animales'),
      Zoo.api.get('/api/alimentacion/alimentos/opciones'),
      Zoo.api.get('/api/comun/areas', { tipo: 'jaula' }),
    ]);
  } catch (err) {
    Zoo.ui.error(err);
  }
  const opcionesEspecie = { texto: 'nombre_comun' };
  Zoo.ui.opciones($('fEspecie'), especies, { ...opcionesEspecie, vacio: 'Todas' });
  Zoo.ui.opciones($('aEspecie'), especies, { ...opcionesEspecie, vacio: 'Todas' });
  Zoo.ui.opciones($('dEspecieId'), especies, { ...opcionesEspecie, vacio: 'Selecciona la especie' });
  Zoo.ui.opciones($('aJaula'), jaulas, { vacio: 'Todas' });
  A.opcionesAlimentos($('fAlimento'), alimentos, 'Todos');

  // Animales agrupados por especie
  const grupos = {};
  animales.forEach((a) => (grupos[a.especie] = grupos[a.especie] || []).push(a));
  $('dAnimalId').innerHTML = '<option value="">Selecciona el animal</option>' + Object.entries(grupos)
    .map(([especie, lista]) => `<optgroup label="${esc(especie)}">${lista
      .map((a) => `<option value="${a.id}">${esc(a.nombre)} (${esc(a.codigo)})</option>`).join('')}</optgroup>`).join('');

  // --------------------------------------------------------- Formulario
  const destino = () => form.querySelector('[name="destino"]:checked')?.value || 'especie';

  function actualizarFormulario() {
    const paraAnimal = destino() === 'animal';
    $('grupoEspecie').classList.toggle('d-none', paraAnimal);
    $('grupoAnimal').classList.toggle('d-none', !paraAnimal);
    $('dEspecieId').disabled = paraAnimal;
    $('dAnimalId').disabled = !paraAnimal;
    $('etiquetaMotivo').innerHTML = paraAnimal
      ? 'Motivo de la dieta propia'
      : 'Motivo <span class="text-secondary fw-normal">(opcional)</span>';
    $('dMotivo').required = paraAnimal;

    const unidad = $('dAlimento').selectedOptions[0]?.dataset.unidad || 'kg';
    $('dUnidad').textContent = E.texto('unidadAlimentoCorta', unidad);
    const racion = Number($('dCantidad').value || 0);
    const veces = Number($('dFrecuencia').value || 0);
    let texto = '';
    if (racion > 0 && veces > 0) {
      texto = `${veces} × ${A.cantidad(racion, unidad)} = <strong>${esc(A.cantidad(racion * veces, unidad))} al día</strong>`;
      if (!paraAnimal && $('dEspecieId').value) {
        const n = animales.filter((a) => String(a.especie_id) === $('dEspecieId').value).length;
        if (n > 1) texto += ` por animal (${n} animales: ${esc(A.cantidad(racion * veces * n, unidad))})`;
      }
    }
    $('dResumen').innerHTML = texto;
  }
  form.addEventListener('input', actualizarFormulario);
  form.addEventListener('change', actualizarFormulario);

  async function finalizar(dieta) {
    const motivo = await Zoo.ui.pedirTexto({
      titulo: 'Finalizar dieta',
      mensaje: `${dieta.alimento} para ${dieta.animal || dieta.especie} dejará de aplicarse desde hoy. Su historial se conserva.`,
      etiqueta: 'Motivo (opcional)',
      aceptar: 'Finalizar dieta',
      peligro: true,
      obligatorio: false,
    });
    if (motivo === null) return;
    try {
      await Zoo.api.patch(`/api/alimentacion/dietas/${dieta.id}/finalizar`, { motivo });
      Zoo.ui.toast('Dieta finalizada.', 'exito');
      crud.recargar();
      cargarAnimales();
    } catch (err) {
      Zoo.ui.error(err);
    }
  }

  // ---------------------------------------------------------------- Lista
  function para(d) {
    if (d.destino === 'animal') {
      return `<div class="fw-semibold">${esc(d.animal)} <span class="text-secondary fw-normal">(${esc(d.animal_codigo)})</span></div>
        <div class="small">${esc(d.especie)} · ${E.estado('origenDieta', 'animal')}</div>
        ${d.motivo ? `<div class="small text-secondary">${esc(d.motivo)}</div>` : ''}`;
    }
    const n = Number(d.animales_aplica);
    const animalesTexto = `${n} ${n === 1 ? 'animal' : 'animales'}`;
    let detalle;
    if (d.estado === 'finalizada') detalle = 'Ya no se aplica';
    else if (n === 0) detalle = 'Ningún animal la usa ahora';
    else detalle = d.estado === 'programada' ? `Se aplicará a ${animalesTexto}` : `Aplica a ${animalesTexto}`;
    return `<div class="fw-semibold">${esc(d.especie)}</div><div class="small text-secondary">${detalle}</div>`;
  }

  const crud = Zoo.crud({
    url: '/api/alimentacion/dietas',
    nombre: 'dieta',
    femenino: true,
    puedeEditar: puedeGestionar,
    icono: 'bi-clipboard2-pulse',
    vacio: 'No hay dietas con esos filtros.',
    acciones: { finalizar },
    alAbrir: (dieta) => {
      A.opcionesAlimentos($('dAlimento'), alimentos.filter((a) => Number(a.activo) || a.id === dieta?.alimento_id));
      if (dieta) {
        Zoo.ui.llenarFormulario(form, dieta);
      } else {
        form.fecha_inicio.value = Zoo.ui.hoy();
        form.frecuencia_diaria.value = 1;
        const especie = $('fEspecie').value;
        if (especie) $('dEspecieId').value = especie;
      }
      const conRaciones = dieta && Number(dieta.raciones_registradas) > 0;
      $('avisoReemplazo').classList.toggle('d-none', !conRaciones);
      $('avisoReemplazo').innerHTML = conRaciones
        ? `<i class="bi bi-info-circle me-1"></i>Esta dieta ya tiene ${dieta.raciones_registradas} raciones registradas. Al guardar, se cierra hoy y se crea una dieta nueva con los cambios, para no alterar el historial.`
        : '';
      actualizarFormulario();
    },
    alGuardar: () => cargarAnimales(),
    fila: (d, puede) => {
      const activa = d.estado !== 'finalizada';
      const extra = puede && activa
        ? `<button class="btn btn-sm btn-light" data-accion="finalizar" data-id="${d.id}" title="Finalizar"><i class="bi bi-stop-circle text-danger"></i><span class="visually-hidden">Finalizar</span></button>`
        : '';
      return `
        <tr class="${activa ? '' : 'text-secondary'}">
          <td>${para(d)}</td>
          <td><div class="fw-semibold">${esc(d.alimento)}</div>${d.indicaciones ? `<div class="small text-secondary">${esc(d.indicaciones)}</div>` : ''}</td>
          <td class="text-nowrap">${esc(A.cantidad(d.cantidad_racion, d.unidad_medida))}<div class="small text-secondary">${d.frecuencia_diaria} ${Number(d.frecuencia_diaria) === 1 ? 'vez' : 'veces'} al día</div></td>
          <td class="text-end text-nowrap fw-semibold">${esc(A.cantidad(d.racion_diaria, d.unidad_medida))}</td>
          <td class="text-nowrap">Desde ${esc(Zoo.ui.fecha(d.fecha_inicio))}${d.fecha_fin ? `<div class="small text-secondary">hasta ${esc(Zoo.ui.fecha(d.fecha_fin))}</div>` : '<div class="small text-secondary">Permanente</div>'}
            <div class="small text-secondary">${esc(d.veterinario)}</div></td>
          <td>${E.estado('estadoDieta', d.estado)}</td>
          <td class="text-end text-nowrap">${Zoo.crud.botones(d, { editar: puede && activa, estado: false, extra })}</td>
        </tr>`;
    },
  });

  // ---------------------------------------------------- Por animal (pestaña)
  const formAnimales = $('formAnimales');
  formAnimales.fecha.value = Zoo.ui.hoy();

  async function cargarAnimales() {
    const contenedor = $('listaAnimales');
    try {
      const lista = await Zoo.api.get('/api/alimentacion/dietas/por-animal', Zoo.ui.leerFormulario(formAnimales));
      if (!lista.length) {
        contenedor.innerHTML = '<div class="tabla-vacia"><i class="bi bi-search"></i>No hay animales con esos filtros.</div>';
        return;
      }
      let html = '';
      let jaula = null;
      lista.forEach((a) => {
        if (a.area !== jaula) {
          if (jaula !== null) html += '</div>';
          jaula = a.area;
          html += `<h3 class="grupo-jaula">${esc(jaula)}</h3><div class="dieta-animales">`;
        }
        const dietasHtml = a.dietas.length
          ? `<ul>${a.dietas.map((d) => `
              <li>
                <div class="d-flex justify-content-between gap-2"><strong>${esc(d.alimento)}</strong>
                  <span class="text-nowrap">${esc(A.cantidad(d.racion_diaria, d.unidad_medida))}/día</span></div>
                <div class="small text-secondary">${d.frecuencia_diaria} × ${esc(A.cantidad(d.cantidad_racion, d.unidad_medida))}${d.indicaciones ? ` · ${esc(d.indicaciones)}` : ''}</div>
              </li>`).join('')}</ul>`
          : '<p class="small mt-2 mb-0"><i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>No tiene dieta vigente en esta fecha.</p>';
        html += `
          <article class="dieta-animal ${a.dietas.length ? '' : 'sin-dieta'}">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div><h3>${esc(a.nombre)}</h3><div class="small text-secondary">${esc(a.especie)} · ${esc(a.codigo)}</div></div>
              ${a.origen ? E.estado('origenDieta', a.origen) : ''}
            </div>
            ${a.origen === 'animal' && a.dietas[0]?.motivo ? `<div class="small text-secondary mt-1">${esc(a.dietas[0].motivo)}</div>` : ''}
            ${dietasHtml}
          </article>`;
      });
      contenedor.innerHTML = `${html}</div>`;
    } catch (err) {
      Zoo.ui.error(err);
    }
  }
  let espera;
  formAnimales.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(cargarAnimales, 300); });
  formAnimales.addEventListener('submit', (e) => e.preventDefault());

  if (new URLSearchParams(location.search).get('vista') === 'animales') bootstrap.Tab.getOrCreateInstance($('pestanaAnimales')).show();
  crud.recargar();
  cargarAnimales();
});
