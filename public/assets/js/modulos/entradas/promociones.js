/**
 * Entradas — Promociones.
 * EJEMPLO COMPLETO: listar, crear, editar y activar/desactivar ya funcionan.
 * La tabla usa el campo `activa`; el PATCH de estado recibe `{ activo }`.
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);

  Zoo.ui.opciones($('fVigencia'), E.opciones('vigenciaPromo'), { vacio: 'Todas' });
  try {
    const tipos = await Zoo.api.get('/api/entradas/tipos', { activo: 1 });
    Zoo.ui.opciones($('pTipo'), tipos, { vacio: 'Todas las entradas' });
  } catch (err) {
    Zoo.ui.error(err);
  }

  function aplicaA(p) {
    const tipo = p.tipo_entrada ? esc(p.tipo_entrada) : 'Todas';
    return Number(p.cantidad_minima) > 1 ? `${tipo}<div class="small text-secondary">desde ${esc(p.cantidad_minima)} entradas</div>` : tipo;
  }

  const crud = Zoo.crud({
    url: '/api/entradas/promociones',
    nombre: 'promoción',
    femenino: true,
    puedeEditar: Zoo.sesion.puede('entradas.configurar'),
    icono: 'bi-tags',
    fila: (p, puede) => {
      p.activo = p.activa; // Zoo.crud usa `activo` para el botón de estado
      return `
      <tr>
        <td><div class="fw-semibold">${esc(p.nombre)}</div>
          <div class="small text-secondary">${Number(p.publicada) ? '<i class="bi bi-globe2 me-1"></i>Publicada en el portal' : '<i class="bi bi-eye-slash me-1"></i>Solo taquilla'}</div></td>
        <td class="text-end">${esc(Zoo.ui.numero(p.descuento_porcentaje, Number(p.descuento_porcentaje) % 1 ? 2 : 0))}%</td>
        <td>${aplicaA(p)}</td>
        <td>${p.codigo ? `<code>${esc(p.codigo)}</code>` : '<span class="text-secondary">Sin cupón</span>'}</td>
        <td class="text-nowrap">${esc(Zoo.ui.fecha(p.fecha_inicio))} al ${esc(Zoo.ui.fecha(p.fecha_fin))}</td>
        <td>${E.estado('vigenciaPromo', p.vigencia)}</td>
        <td class="text-end text-nowrap">${Zoo.crud.botones(p, { editar: puede, estado: puede })}</td>
      </tr>`;
    },
    alAbrir: (p, form) => {
      if (!p) {
        form.fecha_inicio.value = Zoo.ui.hoy();
        form.fecha_fin.value = Zoo.ui.hoy(30);
        form.cantidad_minima.value = 1;
        form.publicada.checked = true;
      }
    },
    antesDeGuardar: (d) => ({ ...d, codigo: d.codigo ? d.codigo.toUpperCase() : '' }),
  });
  crud.recargar();
});
