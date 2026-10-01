/**
 * Entradas — Tipos de entrada.
 * EJEMPLO COMPLETO: listar, crear, editar y activar/desactivar ya funcionan.
 */
Zoo.listo(() => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;

  const crud = Zoo.crud({
    url: '/api/entradas/tipos',
    nombre: 'tipo de entrada',
    puedeEditar: Zoo.sesion.puede('entradas.configurar'),
    icono: 'bi-ticket-perforated',
    fila: (t, puede) => `
      <tr>
        <td class="fw-semibold">${esc(t.nombre)}</td>
        <td>${esc(t.descripcion || '')}</td>
        <td class="text-end text-nowrap">${esc(Zoo.ui.moneda(t.precio))}</td>
        <td>${E.estado('activo', Number(t.activo))}</td>
        <td class="text-end text-nowrap">${Zoo.crud.botones(t, { editar: puede, estado: puede })}</td>
      </tr>`,
  });
  crud.recargar();
});
