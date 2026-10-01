/**
 * Administración de usuarios: listar, filtrar, crear, editar, activar o
 * desactivar y restablecer contraseñas.
 *
 * Este archivo sirve también como EJEMPLO del patrón de una página CRUD:
 *   1. cargar catálogos  2. listar con filtros  3. modal de formulario  4. acciones por fila
 */
Zoo.listo(async ({ usuario: yo }) => {
  const { esc } = Zoo.ui;

  const tbody = document.getElementById('tablaUsuarios');
  const formFiltros = document.getElementById('formFiltros');
  const formUsuario = document.getElementById('formUsuario');
  const formPassword = document.getElementById('formPassword');
  const modalUsuario = new bootstrap.Modal('#modalUsuario');
  const modalPassword = new bootstrap.Modal('#modalPassword');

  let roles = [];
  let usuarios = [];
  let editandoId = null;
  let passwordId = null;

  // ---------------------------------------------------------------- Catálogos
  roles = await Zoo.api.get('/api/usuarios/roles');
  Zoo.ui.opciones(document.getElementById('fRol'), roles, { vacio: 'Todos los roles' });
  Zoo.ui.opciones(document.getElementById('uRol'), roles, { vacio: 'Selecciona un rol' });

  const rolSelect = document.getElementById('uRol');
  rolSelect.addEventListener('change', () => {
    const rol = roles.find((r) => String(r.id) === rolSelect.value);
    document.getElementById('uRolDescripcion').textContent = rol?.descripcion || '';
    // Los datos profesionales solo aplican al rol veterinario.
    const esVeterinario = rol?.codigo === 'veterinario';
    document.getElementById('grupoVeterinario').classList.toggle('d-none', !esVeterinario);
    document.getElementById('uColegiado').disabled = !esVeterinario;
    document.getElementById('uEspecialidad').disabled = !esVeterinario;
  });

  // ------------------------------------------------------------------ Listado
  async function cargar() {
    const filtros = Zoo.ui.leerFormulario(formFiltros);
    try {
      usuarios = await Zoo.api.get('/api/usuarios', filtros);
      pintar();
    } catch (err) {
      Zoo.ui.error(err);
    }
  }

  function estadoHtml(u) {
    if (!u.activo) return '<span class="estado estado-neutro">Inactivo</span>';
    if (u.bloqueado) return '<span class="estado estado-alerta">Bloqueado</span>';
    return '<span class="estado estado-ok">Activo</span>';
  }

  function pintar() {
    Zoo.ui.tabla(
      tbody,
      usuarios,
      (u) => `
      <tr>
        <td><div class="fw-semibold">${esc(u.nombres)} ${esc(u.apellidos)}</div><div class="small text-secondary">${esc(u.correo)}</div></td>
        <td>${esc(u.usuario)}</td>
        <td>${esc(u.rol_nombre)}${u.rol === 'veterinario' && u.num_colegiado ? `<div class="small text-secondary">Col. ${esc(u.num_colegiado)}</div>` : ''}</td>
        <td>${estadoHtml(u)}</td>
        <td>${u.ultimo_acceso ? esc(Zoo.ui.fechaHora(u.ultimo_acceso)) : '<span class="text-secondary">Nunca</span>'}</td>
        <td class="acciones">
          <button class="btn btn-sm btn-light" data-accion="editar" data-id="${u.id}" title="Editar"><i class="bi bi-pencil"></i><span class="visually-hidden">Editar</span></button>
          <button class="btn btn-sm btn-light" data-accion="password" data-id="${u.id}" title="Restablecer contraseña"><i class="bi bi-key"></i><span class="visually-hidden">Restablecer contraseña</span></button>
          ${
            u.id === yo.id
              ? ''
              : `<button class="btn btn-sm btn-light" data-accion="estado" data-id="${u.id}" title="${u.activo ? 'Desactivar' : 'Activar'}">
                   <i class="bi ${u.activo ? 'bi-person-dash' : 'bi-person-check'}"></i><span class="visually-hidden">${u.activo ? 'Desactivar' : 'Activar'}</span>
                 </button>`
          }
        </td>
      </tr>`,
      { vacio: 'No hay usuarios con esos filtros.', icono: 'bi-people' }
    );
  }

  let espera;
  formFiltros.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(cargar, 300);
  });
  formFiltros.addEventListener('submit', (e) => e.preventDefault());

  // ------------------------------------------------------- Crear / editar
  function abrirFormulario(usuario = null) {
    editandoId = usuario?.id || null;
    formUsuario.reset();
    Zoo.ui.limpiarErrores(formUsuario);
    document.getElementById('tituloModalUsuario').textContent = usuario ? 'Editar usuario' : 'Nuevo usuario';

    const grupoPassword = document.getElementById('grupoPassword');
    grupoPassword.classList.toggle('d-none', Boolean(usuario));
    document.getElementById('uPassword').disabled = Boolean(usuario);

    if (usuario) Zoo.ui.llenarFormulario(formUsuario, usuario);
    rolSelect.disabled = usuario?.id === yo.id; // no puede cambiar su propio rol
    rolSelect.dispatchEvent(new Event('change'));
    modalUsuario.show();
  }

  document.getElementById('btnNuevo').addEventListener('click', () => abrirFormulario());

  formUsuario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const boton = formUsuario.querySelector('[type="submit"]');
    const datos = Zoo.ui.leerFormulario(formUsuario);
    if (rolSelect.disabled) datos.rol_id = rolSelect.value;

    Zoo.ui.cargando(boton, true);
    try {
      if (editandoId) {
        await Zoo.api.put(`/api/usuarios/${editandoId}`, datos);
        Zoo.ui.toast('Usuario actualizado.', 'exito');
      } else {
        await Zoo.api.post('/api/usuarios', datos);
        Zoo.ui.toast('Usuario creado.', 'exito');
      }
      modalUsuario.hide();
      cargar();
    } catch (err) {
      Zoo.ui.error(err, formUsuario);
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  });

  // --------------------------------------------------- Restablecer contraseña
  formPassword.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const boton = formPassword.querySelector('[type="submit"]');
    Zoo.ui.cargando(boton, true);
    try {
      await Zoo.api.patch(`/api/usuarios/${passwordId}/password`, { password: formPassword.password.value });
      modalPassword.hide();
      Zoo.ui.toast('Contraseña restablecida.', 'exito');
    } catch (err) {
      Zoo.ui.error(err, formPassword);
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  });

  // --------------------------------------------------------- Acciones de fila
  tbody.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-accion]');
    if (!boton) return;
    const usuario = usuarios.find((u) => u.id === Number(boton.dataset.id));
    if (!usuario) return;

    if (boton.dataset.accion === 'editar') abrirFormulario(usuario);

    if (boton.dataset.accion === 'password') {
      passwordId = usuario.id;
      formPassword.reset();
      Zoo.ui.limpiarErrores(formPassword);
      document.getElementById('passwordPara').textContent = `${usuario.nombres} ${usuario.apellidos}`;
      modalPassword.show();
    }

    if (boton.dataset.accion === 'estado') {
      const activar = !usuario.activo;
      const confirmado = await Zoo.ui.confirmar(
        activar
          ? `¿Activar a ${usuario.nombres} ${usuario.apellidos}? Podrá volver a iniciar sesión.`
          : `¿Desactivar a ${usuario.nombres} ${usuario.apellidos}? Se cerrarán sus sesiones y no podrá ingresar.`,
        { titulo: activar ? 'Activar usuario' : 'Desactivar usuario', aceptar: activar ? 'Activar' : 'Desactivar', peligro: !activar }
      );
      if (!confirmado) return;
      try {
        await Zoo.api.patch(`/api/usuarios/${usuario.id}/estado`, { activo: activar });
        Zoo.ui.toast(activar ? 'Usuario activado.' : 'Usuario desactivado.', 'exito');
        cargar();
      } catch (err) {
        Zoo.ui.error(err);
      }
    }
  });

  cargar();
});
