/**
 * Zoo.crud — Pantalla de catálogo estándar: filtros + tabla + modal de formulario
 * + acciones por fila. Todas las pantallas de registro del sistema la usan para
 * comportarse igual.
 *
 * HTML mínimo (ver public/app/catalogos/habitats.html):
 *   <form id="formFiltros" class="filtros">...</form>
 *   <table><thead>...</thead><tbody id="tabla"></tbody></table>
 *   <div class="modal" id="modalEditar"><form id="formEditar" class="modal-content">
 *     <h5 class="modal-title"></h5> ...campos con name=... <button type="submit">
 *   </form></div>
 *   <button id="btnNuevo">
 *
 * JS:
 *   const crud = Zoo.crud({
 *     url: '/api/catalogos/habitats',
 *     nombre: 'hábitat',                       // para títulos y mensajes
 *     femenino: false,                          // "Nueva área" / "Nuevo hábitat"
 *     puedeEditar: Zoo.sesion.puede('catalogos.ubicaciones.gestionar'),
 *     fila: (item, puedeEditar) => `<tr>...${Zoo.crud.botones(item, { editar: puedeEditar, estado: puedeEditar })}</tr>`,
 *     etiquetaRegistro: (item) => item.nombre,   // para confirmaciones
 *     alAbrir: (item, form) => {},              // opcional: ajustar el formulario
 *     antesDeGuardar: (datos, form) => datos,   // opcional: transformar los datos
 *     acciones: { ver: (item) => {} },          // opcional: acciones propias por data-accion
 *   });
 *   crud.recargar();
 */
(function () {
  const Zoo = (window.Zoo = window.Zoo || {});
  const { esc } = Zoo.ui;

  function botones(item, { editar = true, estado = false, extra = '' } = {}) {
    const partes = [extra];
    if (editar) {
      partes.push(`<button class="btn btn-sm btn-light" data-accion="editar" data-id="${esc(item.id)}" title="Editar">
        <i class="bi bi-pencil"></i><span class="visually-hidden">Editar</span></button>`);
    }
    if (estado && 'activo' in item) {
      const activo = Number(item.activo) === 1;
      partes.push(`<button class="btn btn-sm btn-light" data-accion="estado" data-id="${esc(item.id)}" title="${activo ? 'Desactivar' : 'Activar'}">
        <i class="bi ${activo ? 'bi-toggle-on text-success' : 'bi-toggle-off'}"></i><span class="visually-hidden">${activo ? 'Desactivar' : 'Activar'}</span></button>`);
    }
    return partes.join(' ');
  }

  function crud(opciones) {
    const cfg = {
      tabla: '#tabla',
      filtros: '#formFiltros',
      modal: '#modalEditar',
      form: '#formEditar',
      botonNuevo: '#btnNuevo',
      femenino: false,
      puedeEditar: false,
      etiquetaRegistro: (item) => item.nombre,
      acciones: {},
      vacio: 'No hay registros con esos filtros.',
      icono: 'bi-inbox',
      ...opciones,
    };

    const tbody = document.querySelector(cfg.tabla);
    const formFiltros = document.querySelector(cfg.filtros);
    const nodoModal = document.querySelector(cfg.modal);
    const form = document.querySelector(cfg.form);
    const modal = nodoModal ? new bootstrap.Modal(nodoModal) : null;
    const botonNuevo = document.querySelector(cfg.botonNuevo);
    const articulo = cfg.femenino ? 'Nueva' : 'Nuevo';

    let items = [];
    let editando = null;

    // Los filtros pueden venir en la URL (ej. ?estado_salud=critico desde el inicio).
    if (formFiltros) {
      const params = new URLSearchParams(location.search);
      formFiltros.querySelectorAll('[name]').forEach((campo) => {
        if (params.has(campo.name)) campo.value = params.get(campo.name);
      });
    }

    async function recargar() {
      try {
        items = await Zoo.api.get(cfg.url, formFiltros ? Zoo.ui.leerFormulario(formFiltros) : {});
        Zoo.ui.tabla(tbody, items, (item) => cfg.fila(item, cfg.puedeEditar), { vacio: cfg.vacio, icono: cfg.icono });
        cfg.alCargar?.(items);
      } catch (err) {
        if (err.pendiente) Zoo.ui.tablaPendiente(tbody, err);
        else Zoo.ui.error(err);
      }
    }

    function abrir(item = null) {
      if (!form) return;
      editando = item;
      form.reset();
      Zoo.ui.limpiarErrores(form);
      const titulo = nodoModal.querySelector('.modal-title');
      if (titulo) titulo.textContent = item ? `Editar ${cfg.nombre}` : `${articulo} ${cfg.nombre}`;
      if (item) Zoo.ui.llenarFormulario(form, item);
      cfg.alAbrir?.(item, form);
      modal.show();
    }

    async function guardar(evento) {
      evento.preventDefault();
      const boton = form.querySelector('[type="submit"]');
      let datos = Zoo.ui.leerFormulario(form);
      if (cfg.antesDeGuardar) datos = cfg.antesDeGuardar(datos, form, editando);

      Zoo.ui.cargando(boton, true);
      try {
        if (editando) await Zoo.api.put(`${cfg.url}/${editando.id}`, datos);
        else await Zoo.api.post(cfg.url, datos);
        modal.hide();
        Zoo.ui.toast(editando ? `Cambios guardados.` : `${cfg.nombre.charAt(0).toUpperCase()}${cfg.nombre.slice(1)} registrad${cfg.femenino ? 'a' : 'o'}.`, 'exito');
        cfg.alGuardar?.(datos, editando);
        recargar();
      } catch (err) {
        Zoo.ui.error(err, form);
      } finally {
        Zoo.ui.cargando(boton, false);
      }
    }

    async function cambiarEstado(item) {
      const activar = Number(item.activo) !== 1;
      const etiqueta = cfg.etiquetaRegistro(item);
      const confirmado = await Zoo.ui.confirmar(
        activar
          ? `¿Activar "${etiqueta}"? Volverá a estar disponible en todo el sistema.`
          : `¿Desactivar "${etiqueta}"? Dejará de aparecer en los formularios, pero su historial se conserva.`,
        { titulo: activar ? 'Activar registro' : 'Desactivar registro', aceptar: activar ? 'Activar' : 'Desactivar', peligro: !activar }
      );
      if (!confirmado) return;
      try {
        await Zoo.api.patch(`${cfg.url}/${item.id}/estado`, { activo: activar });
        Zoo.ui.toast(activar ? 'Registro activado.' : 'Registro desactivado.', 'exito');
        recargar();
      } catch (err) {
        Zoo.ui.error(err);
      }
    }

    // Eventos
    if (botonNuevo) {
      if (cfg.puedeEditar) botonNuevo.addEventListener('click', () => abrir());
      else botonNuevo.remove();
    }
    form?.addEventListener('submit', guardar);

    if (formFiltros) {
      let espera;
      formFiltros.addEventListener('input', () => {
        clearTimeout(espera);
        espera = setTimeout(recargar, 300);
      });
      formFiltros.addEventListener('submit', (e) => e.preventDefault());
    }

    tbody.addEventListener('click', (evento) => {
      const boton = evento.target.closest('[data-accion]');
      if (!boton) return;
      const item = items.find((i) => String(i.id) === boton.dataset.id);
      if (!item) return;
      const accion = boton.dataset.accion;
      if (accion === 'editar') abrir(item);
      else if (accion === 'estado') cambiarEstado(item);
      else cfg.acciones[accion]?.(item, boton);
    });

    return {
      recargar,
      abrir,
      get items() { return items; },
    };
  }

  crud.botones = botones;
  Zoo.crud = crud;
})();
