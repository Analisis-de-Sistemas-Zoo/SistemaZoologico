/**
 * Bitácora: consulta con filtros, paginación y exportación a PDF y Excel.
 * Sirve como EJEMPLO de una página de reporte.
 */
Zoo.listo(async () => {
  const { esc } = Zoo.ui;

  const form = document.getElementById('formFiltros');
  const tbody = document.getElementById('tablaBitacora');
  const LIMITE = 25;
  let pagina = 1;
  let total = 0;

  const ACCIONES = {
    CREAR: 'estado-ok', ACTIVAR: 'estado-ok', LOGIN: 'estado-ok',
    ACTUALIZAR: 'estado-neutro', LOGOUT: 'estado-neutro', EXPORTAR: 'estado-neutro', CAMBIO_PASSWORD: 'estado-neutro',
    LOGIN_FALLIDO: 'estado-alerta', DESACTIVAR: 'estado-alerta',
    ELIMINAR: 'estado-peligro', BLOQUEO: 'estado-peligro', ACCESO_DENEGADO: 'estado-peligro',
  };

  // Valores por defecto: últimos 7 días.
  form.desde.value = Zoo.ui.hoy(-7);
  form.hasta.value = Zoo.ui.hoy();

  const filtros = await Zoo.api.get('/api/bitacora/filtros');
  Zoo.ui.opciones(form.usuario_id, filtros.usuarios, { vacio: 'Todos', texto: (u) => `${u.nombre} (${u.usuario})` });
  Zoo.ui.opciones(form.modulo, filtros.modulos.map((m) => ({ id: m, nombre: m })), { vacio: 'Todos' });
  Zoo.ui.opciones(form.accion, filtros.acciones.map((a) => ({ id: a, nombre: a })), { vacio: 'Todas' });

  /** Convierte el detalle guardado en JSON a texto legible:  clave: valor, clave: valor */
  function textoDetalle(detalle) {
    if (!detalle) return '';
    const legible = (valor) => {
      if (valor === null || valor === undefined) return '';
      if (Array.isArray(valor)) return valor.map(legible).join(', ');
      if (typeof valor === 'object') {
        return Object.entries(valor)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? `(${legible(v)})` : v}`)
          .join(', ');
      }
      return String(valor);
    };
    try {
      return legible(JSON.parse(detalle));
    } catch {
      return detalle;
    }
  }

  async function cargar() {
    try {
      const datos = await Zoo.api.get('/api/bitacora', { ...Zoo.ui.leerFormulario(form), pagina, limite: LIMITE });
      total = datos.total;
      Zoo.ui.tabla(
        tbody,
        datos.filas,
        (f) => `
        <tr>
          <td class="text-nowrap">${esc(Zoo.ui.fechaHora(f.fecha))}</td>
          <td>${f.usuario ? esc(f.nombre_usuario) : '<span class="text-secondary">Sin sesión</span>'}</td>
          <td>${esc(f.modulo)}</td>
          <td><span class="estado ${ACCIONES[f.accion] || 'estado-neutro'}">${esc(f.accion)}</span></td>
          <td class="small text-nowrap">${f.tabla_afectada ? `${esc(f.tabla_afectada)} #${esc(f.registro_id)}` : ''}</td>
          <td class="small text-secondary text-break" style="max-width: 22rem">${esc(textoDetalle(f.detalle))}</td>
          <td class="small text-secondary">${esc(f.ip)}</td>
        </tr>`,
        { vacio: 'No hay acciones registradas con esos filtros.', icono: 'bi-journal' }
      );
      const desde = total === 0 ? 0 : (pagina - 1) * LIMITE + 1;
      const hasta = Math.min(pagina * LIMITE, total);
      document.getElementById('infoPaginacion').textContent = `Mostrando ${desde} a ${hasta} de ${Zoo.ui.numero(total)} registros`;
      document.getElementById('btnAnterior').disabled = pagina <= 1;
      document.getElementById('btnSiguiente').disabled = pagina * LIMITE >= total;
    } catch (err) {
      Zoo.ui.error(err);
    }
  }

  form.addEventListener('change', () => {
    pagina = 1;
    cargar();
  });
  document.getElementById('btnAnterior').addEventListener('click', () => { pagina -= 1; cargar(); });
  document.getElementById('btnSiguiente').addEventListener('click', () => { pagina += 1; cargar(); });

  // ------------------------------------------------------------- Exportar
  const columnas = [
    { titulo: 'Fecha y hora', campo: 'fecha', formato: Zoo.ui.fechaHora },
    { titulo: 'Usuario', campo: (f) => f.nombre_usuario || 'Sin sesión' },
    { titulo: 'Módulo', campo: 'modulo' },
    { titulo: 'Acción', campo: 'accion' },
    { titulo: 'Registro', campo: (f) => (f.tabla_afectada ? `${f.tabla_afectada} #${f.registro_id}` : '') },
    { titulo: 'Detalle', campo: (f) => textoDetalle(f.detalle), anchoPdf: 200 },
    { titulo: 'IP', campo: 'ip' },
  ];

  async function exportar(tipo, boton) {
    Zoo.ui.cargando(boton, true);
    try {
      const filtrosActuales = Zoo.ui.leerFormulario(form);
      const { filas } = await Zoo.api.get('/api/bitacora', { ...filtrosActuales, exportar: 1 });
      const subtitulo = `Del ${Zoo.ui.fecha(filtrosActuales.desde) || 'inicio'} al ${Zoo.ui.fecha(filtrosActuales.hasta) || 'hoy'}`;
      const opciones = { titulo: 'Bitácora de actividades', subtitulo, columnas, filas, orientacion: 'landscape' };
      if (tipo === 'pdf') Zoo.reportes.pdf(opciones);
      else await Zoo.reportes.excel(opciones);
    } catch (err) {
      Zoo.ui.error(err);
    } finally {
      Zoo.ui.cargando(boton, false);
    }
  }

  document.getElementById('btnPdf').addEventListener('click', (e) => exportar('pdf', e.currentTarget));
  document.getElementById('btnExcel').addEventListener('click', (e) => exportar('excel', e.currentTarget));

  cargar();
});
