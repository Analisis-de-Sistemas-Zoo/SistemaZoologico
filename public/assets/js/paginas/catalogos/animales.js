/**
 * Catálogo de animales: registro, ficha y exportación del inventario.
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);

  const [especies, jaulas] = await Promise.all([
    Zoo.api.get('/api/catalogos/especies', { activo: 1 }),
    Zoo.api.get('/api/comun/areas', { tipo: 'jaula' }),
  ]);
  const textoEspecie = (e) => e.nombre_comun;

  // Filtros
  Zoo.ui.opciones($('fEspecie'), especies, { vacio: 'Todas', texto: textoEspecie });
  Zoo.ui.opciones($('fArea'), jaulas, { vacio: 'Todas' });
  Zoo.ui.opciones($('fSalud'), E.opciones('estadoSalud'), { vacio: 'Todos' });
  Zoo.ui.opciones($('fEstado'), E.opciones('estadoAnimal'), { vacio: 'Todas', seleccionado: 'activo' });

  // Formulario
  Zoo.ui.opciones($('nEspecie'), especies, { vacio: 'Selecciona la especie', texto: textoEspecie });
  Zoo.ui.opciones($('nArea'), jaulas, { vacio: 'Selecciona la jaula', texto: (a) => `${a.nombre} (${a.habitat})` });
  Zoo.ui.opciones($('nSexo'), E.opciones('sexo'));
  Zoo.ui.opciones($('nSalud'), E.opciones('estadoSalud'));
  Zoo.ui.opciones($('nEstado'), E.opciones('estadoAnimal'));
  $('nNacimiento').max = Zoo.ui.hoy();
  $('nIngreso').max = Zoo.ui.hoy();

  const edad = (a) => {
    if (a.edad_anios === null || a.edad_anios === undefined) return '';
    return a.edad_anios === 0 ? 'Menos de 1 año' : `${a.edad_anios} ${a.edad_anios === 1 ? 'año' : 'años'}`;
  };
  const peso = (a) => (a.peso_kg ? `${Zoo.ui.numero(a.peso_kg, a.peso_kg < 10 ? 2 : 1)} kg` : '');

  /** Agrega una opción al select si el registro actual usa un valor que ya no está activo. */
  function asegurarOpcion(select, valor, texto) {
    if (!valor || [...select.options].some((o) => o.value === String(valor))) return;
    select.add(new Option(`${texto} (inactivo)`, valor));
    select.value = String(valor);
  }

  function verFicha(a) {
    $('tituloFicha').textContent = `${a.nombre} (${a.codigo})`;
    const sinDato = '<span class="text-secondary">Sin dato</span>';
    const filas = [
      ['Especie', `${esc(a.especie)} <span class="fst-italic text-secondary">${esc(a.nombre_cientifico)}</span>`],
      ['Jaula', esc(a.habitat ? `${a.area}, ${a.habitat}` : a.area)],
      ['Sexo', esc(E.texto('sexo', a.sexo))],
      ['Nacimiento', a.fecha_nacimiento ? `${esc(Zoo.ui.fecha(a.fecha_nacimiento))} (${esc(edad(a))})` : 'Desconocido'],
      ['Ingreso', esc(Zoo.ui.fecha(a.fecha_ingreso))],
      ['Procedencia', esc(a.procedencia) || sinDato],
      ['Peso', esc(peso(a)) || sinDato],
      ['Estado de salud', E.estado('estadoSalud', a.estado_salud)],
      ['Situación', E.estado('estadoAnimal', a.estado)],
      ['Observaciones', esc(a.observaciones) || sinDato],
    ];
    $('datosFicha').innerHTML = filas
      .map(([titulo, html]) => `<dt class="col-sm-4 text-secondary fw-semibold">${esc(titulo)}</dt><dd class="col-sm-8">${html}</dd>`)
      .join('');
    bootstrap.Modal.getOrCreateInstance('#modalFicha').show();
  }

  const crud = Zoo.crud({
    url: '/api/catalogos/animales',
    nombre: 'animal',
    puedeEditar: Zoo.sesion.puede('catalogos.animales.gestionar'),
    icono: 'bi-clipboard-heart',
    acciones: { ver: verFicha },
    alAbrir: (animal) => {
      const nuevo = !animal;
      $('grupoCodigo').classList.toggle('d-none', nuevo);
      $('grupoNombre').className = nuevo ? 'col-12' : 'col-md-8';
      if (nuevo) {
        $('nIngreso').value = Zoo.ui.hoy();
        $('nSalud').value = 'sano';
        $('nEstado').value = 'activo';
        $('nSexo').value = 'desconocido';
      } else {
        asegurarOpcion($('nEspecie'), animal.especie_id, animal.especie);
        asegurarOpcion($('nArea'), animal.area_id, animal.area);
      }
    },
    alCargar: (items) => {
      $('totalAnimales').textContent = `${items.length} ${items.length === 1 ? 'animal' : 'animales'}`;
    },
    fila: (a, puedeEditar) => `
      <tr>
        <td class="text-nowrap fw-semibold">${esc(a.codigo)}</td>
        <td><div class="fw-semibold">${esc(a.nombre)}</div><div class="small text-secondary">${esc(a.especie)}</div></td>
        <td>${esc(a.area)}<div class="small text-secondary">${esc(a.habitat || '')}</div></td>
        <td>${esc(E.texto('sexo', a.sexo))}</td>
        <td class="text-end text-nowrap">${esc(edad(a))}</td>
        <td class="text-end text-nowrap">${esc(peso(a))}</td>
        <td>${E.estado('estadoSalud', a.estado_salud)}</td>
        <td>${E.estado('estadoAnimal', a.estado)}</td>
        <td class="acciones">${Zoo.crud.botones(a, {
          editar: puedeEditar,
          extra: `<button class="btn btn-sm btn-light" data-accion="ver" data-id="${a.id}" title="Ver ficha"><i class="bi bi-eye"></i><span class="visually-hidden">Ver ficha</span></button>`,
        })}</td>
      </tr>`,
  });

  // Exportación del inventario de animales con los filtros actuales
  const columnas = [
    { titulo: 'Código', campo: 'codigo' },
    { titulo: 'Nombre', campo: 'nombre' },
    { titulo: 'Especie', campo: 'especie' },
    { titulo: 'Jaula', campo: 'area' },
    { titulo: 'Sexo', campo: (a) => E.texto('sexo', a.sexo) },
    { titulo: 'Edad', campo: edad },
    { titulo: 'Peso (kg)', campo: 'peso_kg', alinear: 'right' },
    { titulo: 'Fecha de ingreso', campo: 'fecha_ingreso', formato: Zoo.ui.fecha },
    { titulo: 'Salud', campo: (a) => E.texto('estadoSalud', a.estado_salud) },
    { titulo: 'Situación', campo: (a) => E.texto('estadoAnimal', a.estado) },
  ];
  async function exportar(tipo, boton) {
    Zoo.ui.cargando(boton, true);
    try {
      const opciones = { titulo: 'Inventario de animales', subtitulo: `${crud.items.length} registros`, columnas, filas: crud.items, orientacion: 'landscape' };
      if (tipo === 'pdf') Zoo.reportes.pdf(opciones);
      else await Zoo.reportes.excel(opciones);
    } catch (err) {
      Zoo.ui.error(err);
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  }
  $('btnPdf').addEventListener('click', (e) => exportar('pdf', e.currentTarget));
  $('btnExcel').addEventListener('click', (e) => exportar('excel', e.currentTarget));

  crud.recargar();
});
