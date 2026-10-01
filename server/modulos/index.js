/**
 * Cargador automático de módulos.
 *
 * Cada carpeta dentro de server/modulos/ es un módulo. El núcleo lo registra
 * solo con que exista su index.js; nadie tiene que editar app.js.
 * Las carpetas que empiezan con "_" se ignoran (ej. _plantilla).
 *
 * Contrato de server/modulos/<clave>/index.js:
 *   module.exports = {
 *     clave: 'alimentacion',                 // igual al nombre de la carpeta
 *     nombre: 'Gestión de Alimentación',
 *     icono: 'bi-basket',                    // Bootstrap Icons
 *     permisos: { 'alimentacion.ver': [...roles], ... },
 *     menu: { titulo, icono, orden, items: [{ texto, url, icono, permiso }] },
 *     paginas: { '/app/alimentacion/detalle.html': 'alimentacion.ver' },   // opcional
 *     router,            // se monta en /api/<clave> (exige sesión y <clave>.ver)
 *     routerPublico,     // opcional, se monta en /api/publico/<clave> (sin sesión)
 *     resumenDashboard,  // opcional: async (usuario, puede) => [{ titulo, valor, icono, color, url }]
 *   };
 */
const fs = require('fs');
const path = require('path');
const { registrarAcceso } = require('../core/acceso');

const modulos = [];

function cargarModulos() {
  const carpetas = fs
    .readdirSync(__dirname, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'));

  for (const carpeta of carpetas) {
    const archivo = path.join(__dirname, carpeta.name, 'index.js');
    if (!fs.existsSync(archivo)) {
      console.warn(`[modulos] La carpeta "${carpeta.name}" no tiene index.js, se omite.`);
      continue;
    }
    const modulo = require(archivo);
    if (modulo.clave !== carpeta.name) {
      throw new Error(`[modulos] La clave "${modulo.clave}" debe ser igual a la carpeta "${carpeta.name}".`);
    }
    registrarAcceso(modulo);
    modulos.push(modulo);
  }
  return modulos;
}

module.exports = { cargarModulos, modulos };
