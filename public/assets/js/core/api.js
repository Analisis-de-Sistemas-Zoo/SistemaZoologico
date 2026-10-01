/**
 * Zoo.api — Cliente para hablar con el servidor.
 *
 *   const filas = await Zoo.api.get('/api/alimentacion/dietas', { especie_id: 3 });
 *   await Zoo.api.post('/api/alimentacion/dietas', { ... });
 *   await Zoo.api.put(`/api/alimentacion/dietas/${id}`, { ... });
 *   await Zoo.api.patch(`/api/usuarios/${id}/estado`, { activo: false });
 *   await Zoo.api.del(`/api/alimentacion/proveedores/${id}`);
 *
 * Devuelve directamente `datos` de la respuesta. Si el servidor responde con
 * error, lanza Zoo.api.ApiError con `mensaje`, `estado` y `errores` por campo.
 * Si la sesión expiró, redirige al inicio de sesión automáticamente.
 */
(function () {
  const Zoo = (window.Zoo = window.Zoo || {});

  class ApiError extends Error {
    constructor(estado, mensaje, errores) {
      super(mensaje);
      this.estado = estado;
      this.errores = errores || [];
      // 501: la interfaz existe pero el backend de esa función aún no se programa.
      this.pendiente = estado === 501;
    }
  }

  function conParametros(url, parametros) {
    if (!parametros) return url;
    const q = new URLSearchParams();
    Object.entries(parametros).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') q.append(clave, valor);
    });
    const texto = q.toString();
    return texto ? `${url}${url.includes('?') ? '&' : '?'}${texto}` : url;
  }

  async function solicitar(metodo, url, cuerpo) {
    const opciones = {
      method: metodo,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    };
    if (cuerpo !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }

    let respuesta;
    try {
      respuesta = await fetch(url, opciones);
    } catch {
      throw new ApiError(0, 'No hay conexión con el servidor. Verifica que esté encendido.');
    }

    let json = null;
    if ((respuesta.headers.get('content-type') || '').includes('application/json')) {
      json = await respuesta.json().catch(() => null);
    }

    const esLogin = url.startsWith('/api/auth/login');
    if (respuesta.status === 401 && !esLogin && Zoo.api.redirigirSiExpira) {
      const destino = encodeURIComponent(location.pathname + location.search);
      location.href = `/login.html?expirada=1&next=${destino}`;
      throw new ApiError(401, json?.mensaje || 'Tu sesión expiró.');
    }

    if (!respuesta.ok || (json && json.ok === false)) {
      throw new ApiError(respuesta.status, json?.mensaje || 'Ocurrió un error inesperado.', json?.errores);
    }
    return json ? json.datos : null;
  }

  Zoo.api = {
    get: (url, parametros) => solicitar('GET', conParametros(url, parametros)),
    post: (url, cuerpo = {}) => solicitar('POST', url, cuerpo),
    put: (url, cuerpo = {}) => solicitar('PUT', url, cuerpo),
    patch: (url, cuerpo = {}) => solicitar('PATCH', url, cuerpo),
    del: (url) => solicitar('DELETE', url),
    conParametros,
    ApiError,
    // Las páginas públicas lo ponen en false para no redirigir al login.
    redirigirSiExpira: true,
  };
})();
