/**
 * Funciones compartidas por las pantallas de Limpieza.
 */
window.Limpieza = (function () {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;

  /** Llena un <select> de áreas agrupadas por tipo (Jaulas, Sanitarios, ...). */
  function opcionesAreas(select, areas, vacio) {
    const grupos = {};
    areas.forEach((a) => (grupos[a.tipo] = grupos[a.tipo] || []).push(a));
    select.innerHTML =
      (vacio ? `<option value="">${esc(vacio)}</option>` : '') +
      Object.entries(grupos)
        .map(([tipo, lista]) => `<optgroup label="${esc(E.texto('tipoArea', tipo))}">${lista
          .map((a) => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('')}</optgroup>`)
        .join('');
  }

  function cantidad(valor, unidad) {
    return `${Zoo.ui.numero(valor, Number(valor) % 1 ? 2 : 0)} ${E.texto('unidadCorta', unidad)}`;
  }

  /** Minutos entre inicio y fin reales. */
  function duracion(t) {
    if (!t.inicio_real || !t.fin_real) return '';
    const min = Math.round((new Date(t.fin_real.replace(' ', 'T')) - new Date(t.inicio_real.replace(' ', 'T'))) / 60000);
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
  }

  /** Bloque de información de una tarea (detalle y verificación). */
  function detalleHtml(t) {
    const fila = (titulo, html) => (html ? `<dt class="col-sm-4 text-secondary fw-semibold">${esc(titulo)}</dt><dd class="col-sm-8">${html}</dd>` : '');
    const insumos = t.insumos?.length
      ? `<table class="table table-sm mb-0"><tbody>${t.insumos
          .map((i) => `<tr><td>${esc(i.nombre)}</td><td class="text-end">${esc(cantidad(i.cantidad_usada, i.unidad_medida))}</td></tr>`).join('')}</tbody></table>`
      : '<span class="text-secondary">No registró insumos</span>';
    return `<dl class="row mb-0">
      ${fila('Área', `${esc(t.area)} <span class="text-secondary">(${esc(E.texto('tipoArea', t.tipo_area))})</span>`)}
      ${fila('Programada', `${esc(Zoo.ui.fecha(t.fecha_programada))} a las ${esc(Zoo.ui.hora(t.hora_programada))}`)}
      ${fila('Tipo', esc(E.texto('tipoLimpieza', t.tipo)))}
      ${fila('Indicaciones', esc(t.descripcion))}
      ${fila('Asignada a', esc(t.asignado))}
      ${fila('Programada por', esc(t.programado_por))}
      ${fila('Estado', E.estado('estadoTarea', t.estado))}
      ${fila('Inicio', esc(Zoo.ui.fechaHora(t.inicio_real)))}
      ${fila('Fin', t.fin_real ? `${esc(Zoo.ui.fechaHora(t.fin_real))} <span class="text-secondary">(${esc(duracion(t))})</span>` : '')}
      ${fila('Reporte del personal', esc(t.observaciones))}
      ${t.estado === 'completada' || t.estado === 'verificada' || t.estado === 'rechazada' ? fila('Insumos usados', insumos) : ''}
      ${fila(t.estado === 'cancelada' ? 'Motivo de cancelación' : 'Revisión', t.verificado_por || t.observacion_verificacion
        ? `${esc(t.observacion_verificacion || '')}${t.verificado_por ? `<div class="small text-secondary">${esc(t.verificado_por)}, ${esc(Zoo.ui.fechaHora(t.fecha_verificacion))}</div>` : ''}` : '')}
    </dl>`;
  }

  return { opcionesAreas, cantidad, duracion, detalleHtml };
})();
