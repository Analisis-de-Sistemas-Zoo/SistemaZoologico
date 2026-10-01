/**
 * Funciones compartidas por las pantallas de Alimentación.
 */
window.Alimentacion = (function () {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;

  /** "12.5 kg", "40 u." */
  function cantidad(valor, unidad) {
    const n = Number(Number(valor || 0).toFixed(3));
    return `${n.toLocaleString('es-GT', { maximumFractionDigits: 3 })} ${E.texto('unidadAlimentoCorta', unidad)}`;
  }

  /** Texto relativo del vencimiento: "Vence hoy", "Vence en 3 días", "Venció hace 2 días". */
  function vencimiento(fecha, dias) {
    if (!fecha) return '<span class="text-secondary">No vence</span>';
    const d = Number(dias);
    let detalle;
    if (d < 0) detalle = `<span class="text-danger">venció hace ${-d} ${-d === 1 ? 'día' : 'días'}</span>`;
    else if (d === 0) detalle = '<span class="text-danger">vence hoy</span>';
    else detalle = `en ${d} ${d === 1 ? 'día' : 'días'}`;
    return `${esc(Zoo.ui.fecha(fecha))}<div class="small text-secondary">${detalle}</div>`;
  }

  /** Tabla del historial de movimientos (de un alimento o de un lote). */
  function movimientosHtml(tbody, movimientos, { mostrarLote = true } = {}) {
    Zoo.ui.tabla(tbody, movimientos, (m) => `
      <tr>
        <td class="text-nowrap">${esc(Zoo.ui.fechaHora(m.fecha))}</td>
        <td>${E.estado('movimientoAlimento', m.tipo)}</td>
        ${mostrarLote ? `<td>${esc(m.numero_lote)}</td>` : ''}
        <td class="text-end text-nowrap">${m.tipo === 'entrada' ? '+' : '−'}${esc(cantidad(m.cantidad, m.unidad_medida))}</td>
        <td>${m.animal ? `Ración de ${esc(m.animal)} <span class="text-secondary">(${esc(m.animal_codigo)})</span>` : esc(m.motivo || '')}</td>
        <td>${esc(m.usuario)}</td>
      </tr>`, { vacio: 'Sin movimientos.', icono: 'bi-clock-history' });
  }

  /** <select> de alimentos agrupados por categoría, mostrando la unidad. */
  function opcionesAlimentos(select, alimentos, vacio = 'Selecciona el alimento') {
    const grupos = {};
    alimentos.forEach((a) => (grupos[a.categoria] = grupos[a.categoria] || []).push(a));
    select.innerHTML = (vacio ? `<option value="">${esc(vacio)}</option>` : '') + Object.entries(grupos)
      .map(([cat, lista]) => `<optgroup label="${esc(E.texto('categoriaAlimento', cat))}">${lista
        .map((a) => `<option value="${a.id}" data-unidad="${esc(a.unidad_medida)}">${esc(a.nombre)} (${esc(E.texto('unidadAlimentoCorta', a.unidad_medida))})</option>`).join('')}</optgroup>`)
      .join('');
  }

  return { cantidad, vencimiento, movimientosHtml, opcionesAlimentos };
})();
