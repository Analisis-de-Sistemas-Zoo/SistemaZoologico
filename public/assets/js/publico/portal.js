/**
 * Portal público: carga las promociones vigentes.
 *
 * Las promociones las publica el módulo de Entradas y Promociones en
 *   GET /api/publico/entradas/promociones
 * con el formato  [{ nombre, descripcion, descuento_porcentaje, vigente_hasta }]
 * Mientras ese módulo no exista, se muestra un mensaje neutro.
 */
(function () {
  const { esc } = Zoo.ui;
  Zoo.api.redirigirSiExpira = false;

  async function cargarPromociones() {
    const contenedor = document.getElementById('listaPromociones');
    let promociones = [];
    try {
      promociones = (await Zoo.api.get('/api/publico/entradas/promociones')) || [];
    } catch {
      promociones = [];
    }

    if (promociones.length === 0) {
      contenedor.innerHTML = '<div class="promos-vacio">Por ahora no hay promociones vigentes. Vuelve pronto.</div>';
      return;
    }

    contenedor.innerHTML = promociones
      .map(
        (p) => `
        <article class="promo">
          ${p.descuento_porcentaje ? `<div class="descuento">-${esc(Zoo.ui.numero(p.descuento_porcentaje))}%</div>` : ''}
          <h3>${esc(p.nombre)}</h3>
          <p>${esc(p.descripcion || '')}</p>
          ${p.vigente_hasta ? `<p class="small mt-2">Válida hasta el ${esc(Zoo.ui.fecha(p.vigente_hasta))}</p>` : ''}
        </article>`
      )
      .join('');
  }

  document.addEventListener('DOMContentLoaded', cargarPromociones);
})();
