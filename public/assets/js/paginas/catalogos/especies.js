/**
 * Catálogo de especies.
 */
Zoo.listo(() => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;

  Zoo.ui.opciones(document.getElementById('fClasificacion'), E.opciones('clasificacion'), { vacio: 'Todas' });
  Zoo.ui.opciones(document.getElementById('fDieta'), E.opciones('tipoDieta'), { vacio: 'Todas' });
  Zoo.ui.opciones(document.getElementById('eClasificacion'), E.opciones('clasificacion'), { vacio: 'Selecciona' });
  Zoo.ui.opciones(document.getElementById('eDieta'), E.opciones('tipoDieta'), { vacio: 'Selecciona' });
  Zoo.ui.opciones(document.getElementById('eConservacion'), E.opciones('conservacion'), { vacio: 'Sin evaluar' });

  const crud = Zoo.crud({
    url: '/api/catalogos/especies',
    nombre: 'especie',
    femenino: true,
    puedeEditar: Zoo.sesion.puede('catalogos.animales.gestionar'),
    icono: 'bi-feather',
    etiquetaRegistro: (e) => e.nombre_comun,
    fila: (e, puedeEditar) => `
      <tr>
        <td><div class="fw-semibold">${esc(e.nombre_comun)}</div><div class="small text-secondary fst-italic">${esc(e.nombre_cientifico)}</div></td>
        <td>${esc(E.texto('clasificacion', e.clasificacion))}</td>
        <td>${esc(E.texto('tipoDieta', e.tipo_dieta))}</td>
        <td>${e.estado_conservacion ? E.estado('conservacion', e.estado_conservacion) : '<span class="text-secondary">Sin evaluar</span>'}</td>
        <td class="text-end">${e.animales}</td>
        <td>${E.estado('activo', e.activo)}</td>
        <td class="acciones">${Zoo.crud.botones(e, { editar: puedeEditar, estado: puedeEditar })}</td>
      </tr>`,
  });

  crud.recargar();
});
