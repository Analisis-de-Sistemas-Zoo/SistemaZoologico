/** Valores permitidos del módulo (iguales a los ENUM de database/20_alimentacion.sql). */
module.exports = {
  CATEGORIAS_ALIMENTO: ['carne', 'pescado', 'fruta', 'verdura', 'forraje', 'grano', 'insecto', 'presa', 'concentrado', 'suplemento', 'otro'],
  UNIDADES_ALIMENTO: ['kg', 'g', 'l', 'unidad'],
  ESTADOS_LOTE: ['disponible', 'por_vencer', 'vencido', 'agotado'],
  ALERTAS_ALIMENTO: ['bajo_minimo', 'por_vencer', 'vencido'],
};
