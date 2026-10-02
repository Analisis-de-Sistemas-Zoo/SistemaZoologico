/**
 * Limpieza — Tareas (supervisor): programar, consultar, cancelar y verificar.
 * Contrato de la API: docs/api/limpieza.md
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;
  const E = Zoo.etiquetas;
  const $ = (id) => document.getElementById(id);
  const puedeProgramar = Zoo.sesion.puede('limpieza.tareas.programar');
  const puedeVerificar = Zoo.sesion.puede('limpieza.tareas.verificar');

  const [areas, personal] = await Promise.all([
    Zoo.api.get('/api/comun/areas'),
    Zoo.api.get('/api/comun/usuarios', { roles: 'personal_limpieza' }),
  ]);

  // ------------------------------------------------------------- Filtros
  $('fDesde').value = Zoo.ui.hoy();
  $('fHasta').value = Zoo.ui.hoy(6);
  Limpieza.opcionesAreas($('fArea'), areas, 'Todas');
  Zoo.ui.opciones($('fAsignado'), personal, { vacio: 'Todo el personal' });
  Zoo.ui.opciones($('fEstado'), E.opciones('estadoTarea'), { vacio: 'Todos' });

  // ---------------------------------------------------------- Formulario
  Limpieza.opcionesAreas($('tArea'), areas, 'Selecciona el área');
  Zoo.ui.opciones($('tTipo'), E.opciones('tipoLimpieza'));
  Zoo.ui.opciones($('tAsignado'), personal, { vacio: 'Selecciona a una persona' });

  // ------------------------------------------------------------- Resumen
  function pintarResumen(tareas) {
    const contar = (fn) => tareas.filter(fn).length;
    const tarjetas = [
      ['Pendientes', contar((t) => t.estado === 'pendiente'), 'bi-hourglass', 'neutro'],
      ['En proceso', contar((t) => t.estado === 'en_proceso'), 'bi-play-circle', 'alerta'],
      ['Por verificar', contar((t) => t.estado === 'completada'), 'bi-clipboard-check', ''],
      ['Atrasadas', contar((t) => Number(t.atrasada) === 1), 'bi-alarm', 'peligro'],
    ];
    $('resumenTareas').innerHTML = tarjetas
      .map(([titulo, valor, icono, color]) => `
        <div class="resumen-item">
          <span class="icono ${color}"><i class="bi ${icono}"></i></span>
          <span><span class="valor">${valor}</span><span class="etiqueta">${titulo}</span></span>
        </div>`)
      .join('');
    $('resumenTareas').classList.remove('d-none');
  }

  // --------------------------------------------------------- Acciones
  async function obtenerDetalle(tarea) {
    return Zoo.api.get(`/api/limpieza/tareas/${tarea.id}`);
  }

  async function ver(tarea) {
    try {
      const detalle = await obtenerDetalle(tarea);
      $('tituloDetalle').textContent = `Tarea en ${detalle.area}`;
      $('cuerpoDetalle').innerHTML = Limpieza.detalleHtml(detalle);
      bootstrap.Modal.getOrCreateInstance('#modalDetalle').show();
    } catch (err) {
      Zoo.ui.error(err);
    }
  }

  async function cancelar(tarea) {
    const motivo = await Zoo.ui.pedirTexto({
      titulo: 'Cancelar tarea',
      mensaje: `${tarea.area}, ${Zoo.ui.fecha(tarea.fecha_programada)} a las ${Zoo.ui.hora(tarea.hora_programada)}.`,
      etiqueta: 'Motivo de la cancelación',
      aceptar: 'Cancelar tarea',
      peligro: true,
    });
    if (motivo === null) return;
    try {
      await Zoo.api.patch(`/api/limpieza/tareas/${tarea.id}/cancelar`, { motivo });
      Zoo.ui.toast('Tarea cancelada.', 'exito');
      crud.recargar();
    } catch (err) {
      Zoo.ui.error(err);
    }
  }

  // Verificación
  const formVerificar = $('formVerificar');
  const modalVerificar = new bootstrap.Modal('#modalVerificar');
  let verificando = null;

  formVerificar.addEventListener('change', () => {
    const rechazar = formVerificar.resultado.value === 'rechazada';
    $('vObsAyuda').textContent = rechazar ? '(obligatoria: explica qué falta)' : '(opcional)';
  });

  async function abrirVerificacion(tarea) {
    try {
      const detalle = await obtenerDetalle(tarea);
      verificando = detalle;
      formVerificar.reset();
      Zoo.ui.limpiarErrores(formVerificar);
      $('vObsAyuda').textContent = '(opcional)';
      $('tituloVerificar').textContent = `Verificar tarea en ${detalle.area}`;
      $('resumenVerificar').innerHTML = Limpieza.detalleHtml(detalle);
      modalVerificar.show();
    } catch (err) {
      Zoo.ui.error(err);
    }
  }

  formVerificar.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const datos = Zoo.ui.leerFormulario(formVerificar);
    if (datos.resultado === 'rechazada' && !datos.observacion) {
      Zoo.ui.error({ message: 'Explica por qué se rechaza la tarea.', errores: [{ campo: 'observacion', mensaje: 'Obligatoria al rechazar.' }] }, formVerificar);
      return;
    }
    const boton = formVerificar.querySelector('[type="submit"]');
    Zoo.ui.cargando(boton, true);
    try {
      await Zoo.api.patch(`/api/limpieza/tareas/${verificando.id}/verificar`, datos);
      modalVerificar.hide();
      Zoo.ui.toast(datos.resultado === 'verificada' ? 'Tarea verificada.' : 'Tarea rechazada.', 'exito');
      crud.recargar();
    } catch (err) {
      Zoo.ui.error(err, formVerificar);
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  });

  // ---------------------------------------------------------------- Lista
  const crud = Zoo.crud({
    url: '/api/limpieza/tareas',
    nombre: 'tarea',
    femenino: true,
    puedeEditar: puedeProgramar,
    icono: 'bi-calendar-check',
    vacio: 'No hay tareas programadas en esas fechas.',
    acciones: { ver, cancelar, verificar: abrirVerificacion },
    alCargar: pintarResumen,
    alAbrir: (tarea) => {
      $('tFecha').min = Zoo.ui.hoy();
      if (!tarea) {
        $('tFecha').value = Zoo.ui.hoy();
        $('tTipo').value = 'rutinaria';
      }
    },
    fila: (t, puedeEditar) => {
      const boton = (accion, icono, titulo, clase = 'btn-light') =>
        `<button class="btn btn-sm ${clase}" data-accion="${accion}" data-id="${t.id}" title="${titulo}"><i class="bi ${icono}"></i><span class="visually-hidden">${titulo}</span></button>`;
      const extra = [
        t.estado === 'completada' && puedeVerificar ? `<button class="btn btn-sm btn-primary" data-accion="verificar" data-id="${t.id}">Verificar</button>` : '',
        boton('ver', 'bi-eye', 'Ver detalle'),
        puedeEditar && ['pendiente', 'en_proceso'].includes(t.estado) ? boton('cancelar', 'bi-x-circle', 'Cancelar tarea') : '',
      ].join(' ');
      return `
        <tr>
          <td class="text-nowrap">
            <div class="fw-semibold">${esc(Zoo.ui.fecha(t.fecha_programada))}</div>
            <div class="small text-secondary">${esc(Zoo.ui.hora(t.hora_programada))}${Number(t.atrasada) ? ' <span class="estado estado-peligro ms-1">Atrasada</span>' : ''}</div>
          </td>
          <td><div class="fw-semibold">${esc(t.area)}</div><div class="small text-secondary">${esc(E.texto('tipoArea', t.tipo_area))}</div></td>
          <td>${esc(E.texto('tipoLimpieza', t.tipo))}${t.descripcion ? `<div class="small text-secondary">${esc(t.descripcion)}</div>` : ''}</td>
          <td>${esc(t.asignado)}</td>
          <td>${E.estado('estadoTarea', t.estado)}</td>
          <td class="acciones">${Zoo.crud.botones(t, { editar: puedeEditar && t.estado === 'pendiente', extra })}</td>
        </tr>`;
    },
  });

  crud.recargar();
});
