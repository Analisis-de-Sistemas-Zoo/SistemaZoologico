/**
 * Catálogo de hábitats.
 */
Zoo.listo(() => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;

  Zoo.ui.opciones(document.getElementById('fTipo'), E.opciones('tipoHabitat'), { vacio: 'Todos' });
  Zoo.ui.opciones(document.getElementById('hTipo'), E.opciones('tipoHabitat'), { vacio: 'Selecciona el tipo' });

  const crud = Zoo.crud({
    url: '/api/catalogos/habitats',
    nombre: 'hábitat',
    puedeEditar: Zoo.sesion.puede('catalogos.ubicaciones.gestionar'),
    icono: 'bi-tree',
    fila: (h, puedeEditar) => `
      <tr>
        <td><div class="fw-semibold">${esc(h.nombre)}</div>${h.descripcion ? `<div class="small text-secondary">${esc(h.descripcion)}</div>` : ''}</td>
        <td>${esc(E.texto('tipoHabitat', h.tipo))}</td>
        <td>${esc(h.ubicacion)}</td>
        <td class="text-end">${h.capacidad_max ?? ''}</td>
        <td class="text-end">${h.jaulas}</td>
        <td class="text-end">${h.animales}${h.capacidad_max && h.animales > h.capacidad_max ? ' <i class="bi bi-exclamation-triangle-fill text-warning" title="Supera la capacidad"></i>' : ''}</td>
        <td>${E.estado('activo', h.activo)}</td>
        <td class="acciones">${Zoo.crud.botones(h, { editar: puedeEditar, estado: puedeEditar })}</td>
      </tr>`,
  });

  crud.recargar();
});
