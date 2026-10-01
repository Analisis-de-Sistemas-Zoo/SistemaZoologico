/**
 * Inicio: saludo, tarjetas de resumen (núcleo + módulos) y accesos según el rol.
 */
Zoo.listo(async ({ usuario, menu }) => {
  const { esc } = Zoo.ui;

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const fecha = new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('saludoTitulo').textContent = `${saludo}, ${usuario.nombres}`;
  document.getElementById('saludoTexto').textContent =
    `${fecha.charAt(0).toUpperCase()}${fecha.slice(1)}. Ingresaste como ${usuario.rolNombre.toLowerCase()}.`;

  // Accesos: una tarjeta por sección del menú (menos "General").
  const secciones = menu.filter((s) => s.clave !== 'general');
  document.getElementById('accesos').innerHTML = secciones.length
    ? secciones
        .map(
          (s) => `
        <div class="acceso">
          <h3>${esc(s.titulo)}</h3>
          <ul>${s.items.map((i) => `<li><a href="${esc(i.url)}"><i class="bi ${esc(i.icono)}"></i>${esc(i.texto)}</a></li>`).join('')}</ul>
        </div>`
        )
        .join('')
    : '<p class="text-secondary">Tu rol todavía no tiene módulos asignados.</p>';

  // Resumen
  const contenedor = document.getElementById('resumen');
  const COLORES = { alerta: 'alerta', peligro: 'peligro', secondary: 'neutro', neutro: 'neutro' };
  try {
    const { tarjetas } = await Zoo.api.get('/api/dashboard/resumen');
    if (tarjetas.length === 0) {
      contenedor.closest('section').remove();
      return;
    }
    contenedor.innerHTML = tarjetas
      .map((t) => {
        const etiqueta = t.url ? 'a' : 'div';
        return `
        <${etiqueta} class="resumen-item" ${t.url ? `href="${esc(t.url)}"` : ''}>
          <span class="icono ${COLORES[t.color] || ''}"><i class="bi ${esc(t.icono || 'bi-graph-up')}"></i></span>
          <span><span class="valor">${esc(typeof t.valor === 'number' ? Zoo.ui.numero(t.valor) : t.valor)}</span><span class="etiqueta">${esc(t.titulo)}</span></span>
        </${etiqueta}>`;
      })
      .join('');
  } catch (err) {
    contenedor.innerHTML = `<p class="text-secondary">No se pudo cargar el resumen. ${esc(err.message)}</p>`;
  }
});
