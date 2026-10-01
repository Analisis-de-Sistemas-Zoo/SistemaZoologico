/**
 * Consultas base del módulo clínico.
 * TODO (Daniela): usar estas consultas en los controladores. Ya devuelven los
 * campos que espera la interfaz (ver docs/api/clinico.md → "Objetos").
 */

/** Campos de un animal en la lista de expedientes. */
const SELECT_EXPEDIENTE = `
  SELECT an.id, an.codigo, an.nombre, an.especie_id, e.nombre_comun AS especie, an.area_id, a.nombre AS area,
         an.sexo, an.fecha_nacimiento, an.peso_kg, an.estado_salud,
         (SELECT MAX(c.fecha) FROM consulta_clinica c WHERE c.animal_id = an.id) AS ultima_consulta,
         (SELECT MIN(c.proxima_revision) FROM consulta_clinica c
           WHERE c.animal_id = an.id AND c.proxima_revision >= CURDATE()) AS proxima_revision
    FROM animal an
    JOIN especie e ON e.id = an.especie_id
    JOIN area a ON a.id = an.area_id`;

/** Objeto consulta. */
const SELECT_CONSULTA = `
  SELECT c.id, c.animal_id, an.codigo AS animal_codigo, an.nombre AS animal, e.nombre_comun AS especie,
         c.veterinario_id, CONCAT(u.nombres, ' ', u.apellidos) AS veterinario,
         c.fecha, c.tipo, c.motivo, c.sintomas, c.diagnostico, c.tratamiento, c.peso_kg, c.temperatura_c,
         c.estado_salud_resultante, c.proxima_revision, c.observaciones
    FROM consulta_clinica c
    JOIN animal an ON an.id = c.animal_id
    JOIN especie e ON e.id = an.especie_id
    JOIN usuario u ON u.id = c.veterinario_id`;

/** Objeto aplicación. */
const SELECT_APLICACION = `
  SELECT ap.id, ap.animal_id, an.codigo AS animal_codigo, an.nombre AS animal, e.nombre_comun AS especie,
         ap.insumo_clinico_id, i.nombre AS insumo, i.tipo AS tipo_insumo, i.unidad_medida,
         ap.veterinario_id, CONCAT(u.nombres, ' ', u.apellidos) AS veterinario,
         ap.consulta_id, ap.dosis, ap.via, ap.fecha_aplicacion, ap.proxima_dosis, ap.observaciones
    FROM aplicacion_clinica ap
    JOIN animal an ON an.id = ap.animal_id
    JOIN especie e ON e.id = an.especie_id
    JOIN insumo_clinico i ON i.id = ap.insumo_clinico_id
    JOIN usuario u ON u.id = ap.veterinario_id`;

/**
 * Dosis pendientes: aplicaciones con próxima dosis que todavía no tienen una
 * aplicación posterior del mismo insumo al mismo animal.
 * Agregar: AND ap.proxima_dosis <= CURDATE() + INTERVAL ? DAY
 */
const CONDICION_DOSIS_PENDIENTE = `
  ap.proxima_dosis IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM aplicacion_clinica posterior
     WHERE posterior.animal_id = ap.animal_id
       AND posterior.insumo_clinico_id = ap.insumo_clinico_id
       AND posterior.fecha_aplicacion > ap.fecha_aplicacion)`;

module.exports = { SELECT_EXPEDIENTE, SELECT_CONSULTA, SELECT_APLICACION, CONDICION_DOSIS_PENDIENTE };
