/** Valores permitidos del módulo (iguales a los ENUM y SET de database/20_alimentacion.sql). */
const DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

/** Fecha de hoy en Guatemala (UTC-6) como AAAA-MM-DD. */
function hoy(desplazamientoDias = 0) {
  const d = new Date(Date.now() - 6 * 3600 * 1000 + desplazamientoDias * 86400000);
  return d.toISOString().slice(0, 10);
}

/** Clave del día de la semana ('lun'...'dom') de una fecha AAAA-MM-DD. */
function diaSemana(fecha) {
  const indice = new Date(`${fecha}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return DIAS[(indice + 6) % 7];
}

/** 'AAAA-MM-DD' -> 'DD/MM/AAAA' */
const fechaCorta = (f) => (f ? String(f).slice(0, 10).split('-').reverse().join('/') : '');

module.exports = {
  CATEGORIAS_ALIMENTO: ['carne', 'pescado', 'fruta', 'verdura', 'forraje', 'grano', 'insecto', 'presa', 'concentrado', 'suplemento', 'otro'],
  UNIDADES_ALIMENTO: ['kg', 'g', 'l', 'unidad'],
  ESTADOS_LOTE: ['disponible', 'por_vencer', 'vencido', 'agotado'],
  ALERTAS_ALIMENTO: ['bajo_minimo', 'por_vencer', 'vencido'],
  ESTADOS_DIETA: ['vigente', 'programada', 'finalizada', 'actual'],
  DIAS,
  hoy,
  diaSemana,
  fechaCorta,
};
