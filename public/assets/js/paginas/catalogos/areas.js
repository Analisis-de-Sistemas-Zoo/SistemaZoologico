/**
 * Catálogo de áreas y jaulas.
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;

  const habitats = await Zoo.api.get('/api/catalogos/habitats', { activo: 1 });
  Zoo.ui.opciones(document.getElementById('fTipo'), E.opciones('tipoArea'), { vacio: 'Todos' });
  Zoo.ui.opciones(document.getElementById('fHabitat'), habitats, { vacio: 'Todos' });
  Zoo.ui.opciones(document.getElementById('aTipo'), E.opciones('tipoArea'), { vacio: 'Selecciona el tipo' });
  Zoo.ui.opciones(document.getElementById('aHabitat'), habitats, { vacio: 'Sin hábitat' });

  // El hábitat es obligatorio solo para las jaulas.
  const tipo = document.getElementById('aTipo');
  const actualizarAyuda = () => {
    const esJaula = tipo.value === 'jaula';
    document.getElementById('aHabitatAyuda').textContent = esJaula ? '(obligatorio para jaulas)' : '(opcional)';
    document.getElementById('aHabitat').required = esJaula;
  };
  tipo.addEventListener('change', actualizarAyuda);

  const crud = Zoo.crud({
    url: '/api/catalogos/areas',
    nombre: 'área',
    femenino: true,
    puedeEditar: Zoo.sesion.puede('catalogos.ubicaciones.gestionar'),
    icono: 'bi-geo-alt',
    alAbrir: (area) => {
      // Un hábitat inactivo no aparece en la lista, pero se muestra si el área ya lo tenía.
      if (area?.habitat_id && !habitats.some((h) => h.id === area.habitat_id)) {
        Zoo.ui.opciones(document.getElementById('aHabitat'), [...habitats, { id: area.habitat_id, nombre: `${area.habitat} (inactivo)` }],
          { vacio: 'Sin hábitat', seleccionado: area.habitat_id });
      }
      actualizarAyuda();
    },
    fila: (a, puedeEditar) => `
      <tr>
        <td><div class="fw-semibold">${esc(a.nombre)}</div>${a.descripcion ? `<div class="small text-secondary">${esc(a.descripcion)}</div>` : ''}</td>
        <td>${esc(E.texto('tipoArea', a.tipo))}</td>
        <td>${esc(a.habitat || '')}</td>
        <td>${esc(a.ubicacion)}</td>
        <td class="text-end">${a.tipo === 'jaula' ? a.animales : '<span class="text-secondary">No aplica</span>'}</td>
        <td>${E.estado('activo', a.activo)}</td>
        <td class="acciones">${Zoo.crud.botones(a, { editar: puedeEditar, estado: puedeEditar })}</td>
      </tr>`,
  });

  crud.recargar();
});
