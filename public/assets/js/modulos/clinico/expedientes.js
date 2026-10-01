/**
 * Clínico — Expedientes: estado de salud de los animales y acceso a su expediente.
 * Contrato: docs/api/clinico.md → GET /expedientes
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);

  const especies = await Zoo.api.get('/api/comun/especies');
  Zoo.ui.opciones($('fEspecie'), especies, { vacio: 'Todas', texto: 'nombre_comun' });
  Zoo.ui.opciones($('fSalud'), E.opciones('estadoSalud'), { vacio: 'Todos' });

  const crud = Zoo.crud({
    url: '/api/clinico/expedientes',
    nombre: 'expediente',
    puedeEditar: false,
    icono: 'bi-folder2-open',
    vacio: 'No hay animales con esos filtros.',
    fila: (a) => {
      const revision = a.proxima_revision
        ? `${esc(Zoo.ui.fecha(a.proxima_revision))} <div class="small text-secondary">${esc(Clinico.textoDias(Clinico.diasHasta(a.proxima_revision)))}</div>`
        : '<span class="text-secondary">Sin programar</span>';
      const dosis = Number(a.dosis_pendientes) > 0
        ? `<span class="estado ${Number(a.dosis_vencidas) > 0 ? 'estado-peligro' : 'estado-alerta'}">${a.dosis_pendientes} dosis${Number(a.dosis_vencidas) > 0 ? ', vencida' : ''}</span>`
        : '<span class="text-secondary">Ninguna</span>';
      return `
        <tr>
          <td><div class="fw-semibold">${esc(a.nombre)} <span class="text-secondary fw-normal small">${esc(a.codigo)}</span></div><div class="small text-secondary">${esc(a.especie)}</div></td>
          <td>${esc(a.area)}</td>
          <td>${E.estado('estadoSalud', a.estado_salud)}</td>
          <td class="text-nowrap">${a.ultima_consulta ? esc(Zoo.ui.fecha(a.ultima_consulta)) : '<span class="text-secondary">Sin consultas</span>'}</td>
          <td class="text-nowrap">${revision}</td>
          <td>${dosis}</td>
          <td class="acciones"><a class="btn btn-sm btn-outline-primary" href="/app/clinico/expediente.html?animal=${a.id}">Ver expediente</a></td>
        </tr>`;
    },
  });

  crud.recargar();
});
