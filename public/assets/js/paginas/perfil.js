/**
 * Mi perfil: datos de la cuenta y cambio de contraseña.
 */
Zoo.listo(({ usuario }) => {
  const { esc } = Zoo.ui;

  const datos = [
    ['Nombre', usuario.nombre],
    ['Usuario', usuario.usuario],
    ['Correo', usuario.correo],
    ['Rol', usuario.rolNombre],
    ['Último acceso', Zoo.ui.fechaHora(usuario.ultimoAcceso) || 'Primer acceso'],
  ];
  document.getElementById('datosCuenta').innerHTML = datos
    .map(([titulo, valor]) => `<dt class="col-5 fw-semibold text-secondary">${esc(titulo)}</dt><dd class="col-7">${esc(valor)}</dd>`)
    .join('');

  const form = document.getElementById('formPassword');
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const boton = form.querySelector('[type="submit"]');
    Zoo.ui.limpiarErrores(form);
    Zoo.ui.cargando(boton, true);
    try {
      await Zoo.api.put('/api/auth/password', {
        actual: form.actual.value,
        nueva: form.nueva.value,
        confirmacion: form.confirmacion.value,
      });
      form.reset();
      Zoo.ui.toast('Contraseña actualizada. Tus otras sesiones se cerraron.', 'exito');
    } catch (err) {
      Zoo.ui.error(err, form);
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  });
});
