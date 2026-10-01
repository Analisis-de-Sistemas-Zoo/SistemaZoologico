/**
 * Alimentación — Proveedores y el historial de sus entregas.
 */
Zoo.listo(() => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const A = window.Alimentacion;

  async function verCompras(p) {
    $('tituloCompras').textContent = `Entregas de ${p.nombre}`;
    const tbody = $('tablaCompras');
    tbody.innerHTML = '';
    bootstrap.Modal.getOrCreateInstance('#modalCompras').show();
    try {
      const lotes = await Zoo.api.get('/api/alimentacion/lotes', { proveedor_id: p.id });
      lotes.sort((a, b) => (a.fecha_ingreso < b.fecha_ingreso ? 1 : -1));
      Zoo.ui.tabla(tbody, lotes, (l) => `
        <tr>
          <td class="text-nowrap">${esc(Zoo.ui.fecha(l.fecha_ingreso))}</td>
          <td>${esc(l.alimento)}</td>
          <td>${esc(l.numero_lote)}</td>
          <td>${esc(l.numero_factura || '')}</td>
          <td class="text-end text-nowrap">${esc(A.cantidad(l.cantidad_inicial, l.unidad_medida))}</td>
          <td class="text-end">${l.costo_unitario !== null ? esc(Zoo.ui.moneda(l.costo_unitario)) : ''}</td>
          <td class="text-end">${esc(Zoo.ui.moneda(l.costo_total))}</td>
          <td>${E.estado('estadoLote', l.estado)}</td>
        </tr>`, { vacio: 'Este proveedor todavía no tiene entregas.', icono: 'bi-truck' });
    } catch (err) {
      Zoo.ui.error(err);
    }
  }

  const crud = Zoo.crud({
    url: '/api/alimentacion/proveedores',
    nombre: 'proveedor',
    puedeEditar: Zoo.sesion.puede('alimentacion.inventario.gestionar'),
    icono: 'bi-shop',
    acciones: { compras: verCompras },
    antesDeGuardar: (d) => ({ ...d, nit: d.nit ? d.nit.toUpperCase() : '' }),
    fila: (p, puede) => {
      const extra = `<button class="btn btn-sm btn-light" data-accion="compras" data-id="${p.id}" title="Ver entregas"><i class="bi bi-truck"></i><span class="visually-hidden">Ver entregas</span></button>`;
      const contacto = [p.contacto ? `<div>${esc(p.contacto)}</div>` : '', p.telefono ? `<div class="small text-nowrap"><i class="bi bi-telephone me-1"></i>${esc(p.telefono)}</div>` : ''].join('');
      return `
        <tr>
          <td><div class="fw-semibold">${esc(p.nombre)}</div><div class="small text-secondary">${p.nit ? `NIT ${esc(p.nit)}` : 'Sin NIT'}${p.direccion ? ` · ${esc(p.direccion)}` : ''}</div></td>
          <td>${contacto || '<span class="text-secondary">—</span>'}${p.correo ? `<div class="small"><a href="mailto:${esc(p.correo)}">${esc(p.correo)}</a></div>` : ''}</td>
          <td class="text-end">${esc(Zoo.ui.numero(p.compras))}</td>
          <td class="text-nowrap">${p.ultima_compra ? esc(Zoo.ui.fecha(p.ultima_compra)) : '<span class="text-secondary">—</span>'}</td>
          <td class="text-end text-nowrap">${esc(Zoo.ui.moneda(p.total_comprado))}</td>
          <td>${E.estado('activo', Number(p.activo))}</td>
          <td class="text-end text-nowrap">${Zoo.crud.botones(p, { editar: puede, estado: puede, extra })}</td>
        </tr>`;
    },
  });
  crud.recargar();
});
