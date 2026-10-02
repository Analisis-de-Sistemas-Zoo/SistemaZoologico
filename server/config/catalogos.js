/**
 * Valores permitidos de los campos ENUM de los catálogos compartidos.
 * Deben coincidir con database/01_core.sql. Los textos que ve el usuario
 * están en public/assets/js/core/etiquetas.js.
 */
module.exports = Object.freeze({
  TIPOS_HABITAT: ['selva', 'sabana', 'bosque', 'desierto', 'acuatico', 'aviario', 'montana', 'herpetario', 'granja'],
  TIPOS_AREA: ['jaula', 'sanitario', 'jardin', 'area_juegos', 'oficina', 'bodega', 'clinica', 'otra'],
  CLASIFICACIONES: ['mamifero', 'ave', 'reptil', 'anfibio', 'pez', 'invertebrado'],
  TIPOS_DIETA: ['carnivoro', 'herbivoro', 'omnivoro', 'insectivoro', 'piscivoro', 'frugivoro', 'granivoro', 'nectarivoro'],
  ESTADOS_CONSERVACION: ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'DD'],
  SEXOS: ['macho', 'hembra', 'desconocido'],
  ESTADOS_SALUD: ['sano', 'en_observacion', 'en_tratamiento', 'critico'],
  ESTADOS_ANIMAL: ['activo', 'trasladado', 'fallecido'],
});
