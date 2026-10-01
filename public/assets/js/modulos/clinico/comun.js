/**
 * Funciones compartidas por las pantallas de Control Clínico.
 */
window.Clinico = (function () {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;

  const cantidad = (valor, unidad) =>
    `${Zoo.ui.numero(valor, Number(valor) % 1 ? 2 : 0)} ${E.texto('unidadClinica', unidad)}`;

  /** Valor por defecto para <input type="datetime-local">: ahora, en hora local. */
  function ahoraLocal() {
    const d = new Date();
    const dos = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
  }

  function sumarDias(fecha, dias) {
    const d = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
    d.setDate(d.getDate() + Number(dias));
    return d.toISOString().slice(0, 10);
  }

  /** <select> de insumos agrupados por tipo, con su existencia. */
  function opcionesInsumos(select, insumos, vacio = 'Selecciona') {
    const grupos = {};
    insumos.forEach((i) => (grupos[i.tipo] = grupos[i.tipo] || []).push(i));
    select.innerHTML =
      `<option value="">${esc(vacio)}</option>` +
      Object.entries(grupos)
        .map(([tipo, lista]) => `<optgroup label="${esc(E.texto('tipoInsumoClinico', tipo))}s">${lista
          .map((i) => `<option value="${i.id}" data-unidad="${esc(i.unidad_medida)}" data-intervalo="${i.intervalo_refuerzo_dias || ''}"
              ${Number(i.stock_actual) <= 0 ? 'disabled' : ''}>${esc(i.nombre)}${i.presentacion ? ` (${esc(i.presentacion)})` : ''}, hay ${esc(cantidad(i.stock_actual, i.unidad_medida))}</option>`)
          .join('')}</optgroup>`)
        .join('');
  }

  /** Tabla de aplicaciones (expediente y detalle de consulta). */
  function tablaAplicaciones(aplicaciones, { conAnimal = false } = {}) {
    if (!aplicaciones?.length) return '<p class="text-secondary mb-0">Sin aplicaciones registradas.</p>';
    return `<div class="table-responsive"><table class="table table-sm tabla-zoo mb-0">
      <thead><tr><th>Fecha</th>${conAnimal ? '<th>Animal</th>' : ''}<th>Aplicado</th><th class="text-end">Dosis</th><th>Vía</th><th>Próxima dosis</th><th>Veterinario</th></tr></thead>
      <tbody>${aplicaciones.map((a) => `
        <tr>
          <td class="text-nowrap">${esc(Zoo.ui.fechaHora(a.fecha_aplicacion))}</td>
          ${conAnimal ? `<td>${esc(a.animal)}</td>` : ''}
          <td>${esc(a.insumo)} ${E.estado('tipoInsumoClinico', a.tipo_insumo)}</td>
          <td class="text-end text-nowrap">${esc(cantidad(a.dosis, a.unidad_medida))}</td>
          <td>${esc(E.texto('via', a.via))}</td>
          <td class="text-nowrap">${esc(Zoo.ui.fecha(a.proxima_dosis))}</td>
          <td>${esc(a.veterinario)}</td>
        </tr>`).join('')}</tbody></table></div>`;
  }

  /** Detalle de una consulta. */
  function consultaHtml(c) {
    const fila = (titulo, valor) => (valor ? `<dt class="col-sm-3 text-secondary fw-semibold">${esc(titulo)}</dt><dd class="col-sm-9" style="white-space: pre-line">${valor}</dd>` : '');
    const signos = [c.peso_kg ? `${Zoo.ui.numero(c.peso_kg, 2)} kg` : '', c.temperatura_c ? `${Zoo.ui.numero(c.temperatura_c, 1)} °C` : ''].filter(Boolean).join(', ');
    return `<dl class="row mb-3">
      ${fila('Animal', `${esc(c.animal)} <span class="text-secondary">(${esc(c.animal_codigo)}, ${esc(c.especie)})</span>`)}
      ${fila('Fecha', esc(Zoo.ui.fechaHora(c.fecha)))}
      ${fila('Tipo', E.estado('tipoConsulta', c.tipo))}
      ${fila('Veterinario', esc(c.veterinario))}
      ${fila('Motivo', esc(c.motivo))}
      ${fila('Síntomas', esc(c.sintomas))}
      ${fila('Peso y temperatura', esc(signos))}
      ${fila('Diagnóstico', esc(c.diagnostico))}
      ${fila('Tratamiento', esc(c.tratamiento))}
      ${fila('Estado resultante', E.estado('estadoSalud', c.estado_salud_resultante))}
      ${fila('Próxima revisión', esc(Zoo.ui.fecha(c.proxima_revision)))}
      ${fila('Observaciones', esc(c.observaciones))}
    </dl>
    ${c.aplicaciones ? `<h6 class="titulo mb-2">Aplicado en esta consulta</h6>${tablaAplicaciones(c.aplicaciones)}` : ''}`;
  }

  /** Días entre hoy y una fecha (negativo si ya pasó). */
  function diasHasta(fecha) {
    const hoy = new Date(`${Zoo.ui.hoy()}T12:00:00`);
    const d = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
    return Math.round((d - hoy) / 86400000);
  }

  function textoDias(dias) {
    if (dias === 0) return 'hoy';
    if (dias === 1) return 'mañana';
    if (dias === -1) return 'ayer';
    return dias > 0 ? `en ${dias} días` : `hace ${-dias} días`;
  }

  return { cantidad, ahoraLocal, sumarDias, opcionesInsumos, tablaAplicaciones, consultaHtml, diasHasta, textoDias };
})();
