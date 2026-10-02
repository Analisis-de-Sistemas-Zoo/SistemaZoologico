/**
 * Modelo del módulo de Control Clínico.
 *
 * Las consultas de arriba (SELECT_EXPEDIENTE, SELECT_CONSULTA, SELECT_APLICACION
 * y CONDICION_DOSIS_PENDIENTE) ya devuelven los campos que espera la interfaz
 * (ver docs/api/clinico.md → "Objetos"). Aquí se usan para armar los listados,
 * los reportes y los INSERT que se ejecutan dentro de una transacción.
 */
const db = require('../../config/db');

/**
 * Dosis que todavía no se han reaplicado: tienen próxima fecha y no existe una
 * aplicación posterior del mismo producto al mismo animal.
 * Agregar: AND ap.proxima_dosis <= CURDATE() + INTERVAL ? DAY
 */
const CONDICION_DOSIS_PENDIENTE = `
  ap.proxima_dosis IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM aplicacion_clinica posterior
     WHERE posterior.animal_id = ap.animal_id
       AND posterior.insumo_clinico_id = ap.insumo_clinico_id
       AND posterior.fecha_aplicacion > ap.fecha_aplicacion)`;

/** Ventana de la lista de expedientes: dosis que vencen en los próximos 15 días. */
const DIAS_ALERTA_DOSIS = 15;

/** Conteo de dosis de un animal con una condición extra de periodo. */
const conteoDosisDeAnimal = (extra) => `
       (SELECT COUNT(*)
          FROM aplicacion_clinica ap
          JOIN animal ax ON ax.id = ap.animal_id AND ax.estado = 'activo'
         WHERE ap.animal_id = an.id
           AND ${CONDICION_DOSIS_PENDIENTE}
           AND ${extra})`;

/** Campos de un animal en la lista de expedientes. */
const SELECT_EXPEDIENTE = `
  SELECT an.id, an.codigo, an.nombre, an.especie_id, e.nombre_comun AS especie, an.area_id, a.nombre AS area,
         an.sexo, an.fecha_nacimiento, an.peso_kg, an.estado_salud,
         (SELECT MAX(c.fecha) FROM consulta_clinica c WHERE c.animal_id = an.id) AS ultima_consulta,
         (SELECT MIN(c.proxima_revision) FROM consulta_clinica c
           WHERE c.animal_id = an.id AND c.proxima_revision >= CURDATE()) AS proxima_revision,
         ${conteoDosisDeAnimal(`ap.proxima_dosis <= CURDATE() + INTERVAL ${DIAS_ALERTA_DOSIS} DAY`)} AS dosis_pendientes,
         ${conteoDosisDeAnimal('ap.proxima_dosis < CURDATE()')} AS dosis_vencidas
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

const clinico = {
  // --------------------------------------------------------- Expedientes

  /** Filtros opcionales: buscar (nombre o código), especie_id, estado_salud. */
  listarExpedientes({ buscar, especie_id, estado_salud } = {}) {
    const condiciones = ["an.estado = 'activo'"];
    const parametros = [];
    if (buscar) {
      condiciones.push('(an.nombre LIKE ? OR an.codigo LIKE ?)');
      parametros.push(`%${buscar}%`, `%${buscar}%`);
    }
    if (especie_id) { condiciones.push('an.especie_id = ?'); parametros.push(especie_id); }
    if (estado_salud) { condiciones.push('an.estado_salud = ?'); parametros.push(estado_salud); }
    return db.query(`${SELECT_EXPEDIENTE} WHERE ${condiciones.join(' AND ')} ORDER BY an.nombre`, parametros);
  },

  /**
   * Ficha del animal para su expediente. `edad_anios` sale de TIMESTAMPDIFF y
   * queda NULL cuando el animal no tiene fecha de nacimiento registrada.
   */
  animal: (id) =>
    db.queryUno(
      `SELECT an.id, an.codigo, an.nombre, an.estado,
              e.nombre_comun AS especie, e.nombre_cientifico, a.nombre AS area,
              an.sexo, an.fecha_nacimiento, an.peso_kg, an.estado_salud,
              TIMESTAMPDIFF(YEAR, an.fecha_nacimiento, CURDATE()) AS edad_anios
         FROM animal an
         JOIN especie e ON e.id = an.especie_id
         JOIN area a ON a.id = an.area_id
        WHERE an.id = ?`,
      [id]
    ),

  // ------------------------------------------------------------ Consultas

  /** Filtros opcionales: desde, hasta (sobre la fecha), animal_id, veterinario_id, tipo. */
  listarConsultas({ desde, hasta, animal_id, veterinario_id, tipo } = {}) {
    const condiciones = [];
    const parametros = [];
    if (desde) { condiciones.push('DATE(c.fecha) >= ?'); parametros.push(desde); }
    if (hasta) { condiciones.push('DATE(c.fecha) <= ?'); parametros.push(hasta); }
    if (animal_id) { condiciones.push('c.animal_id = ?'); parametros.push(animal_id); }
    if (veterinario_id) { condiciones.push('c.veterinario_id = ?'); parametros.push(veterinario_id); }
    if (tipo) { condiciones.push('c.tipo = ?'); parametros.push(tipo); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    return db.query(`${SELECT_CONSULTA} ${where} ORDER BY c.fecha DESC, c.id DESC`, parametros);
  },

  obtenerConsulta: (id) => db.queryUno(`${SELECT_CONSULTA} WHERE c.id = ?`, [id]),

  async crearConsulta(d, veterinarioId, conn = db) {
    const r = await conn.query(
      `INSERT INTO consulta_clinica
         (animal_id, veterinario_id, fecha, tipo, motivo, sintomas, diagnostico, tratamiento,
          peso_kg, temperatura_c, estado_salud_resultante, proxima_revision, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.animal_id, veterinarioId, d.fecha, d.tipo, d.motivo, d.sintomas, d.diagnostico, d.tratamiento,
        d.peso_kg, d.temperatura_c, d.estado_salud_resultante, d.proxima_revision, d.observaciones]
    );
    return r.insertId;
  },

  /** La consulta es quien deja el animal en el estado de salud resultante (RN del módulo). */
  actualizarAnimal: (animalId, estadoSalud, peso, conn = db) =>
    conn.query('UPDATE animal SET estado_salud = ?, peso_kg = COALESCE(?, peso_kg) WHERE id = ?', [
      estadoSalud, peso ?? null, animalId,
    ]),

  // -------------------------------------------------------- Aplicaciones

  /** Filtros opcionales: desde, hasta (sobre la aplicación), animal_id, tipo_insumo. */
  listarAplicaciones({ desde, hasta, animal_id, tipo_insumo } = {}) {
    const condiciones = [];
    const parametros = [];
    if (desde) { condiciones.push('DATE(ap.fecha_aplicacion) >= ?'); parametros.push(desde); }
    if (hasta) { condiciones.push('DATE(ap.fecha_aplicacion) <= ?'); parametros.push(hasta); }
    if (animal_id) { condiciones.push('ap.animal_id = ?'); parametros.push(animal_id); }
    if (tipo_insumo) { condiciones.push('i.tipo = ?'); parametros.push(tipo_insumo); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    return db.query(`${SELECT_APLICACION} ${where} ORDER BY ap.fecha_aplicacion DESC, ap.id DESC`, parametros);
  },

  listarAplicacionesDeConsulta: (consultaId) =>
    db.query(`${SELECT_APLICACION} WHERE ap.consulta_id = ? ORDER BY ap.fecha_aplicacion, ap.id`, [consultaId]),

  listarAplicacionesDeAnimal: (animalId) =>
    db.query(`${SELECT_APLICACION} WHERE ap.animal_id = ? ORDER BY ap.fecha_aplicacion DESC, ap.id DESC`, [animalId]),

  /**
   * Dosis que vencen dentro de `dias` días y siguen sin reaplicarse.
   * `dias` es negativo cuando la fecha ya pasó; `estado` las separa en vencidas
   * y próximas. Solo animales que siguen en el zoológico.
   */
  listarDosisPendientes(dias) {
    return db.query(
      `SELECT ap.id AS aplicacion_id, an.id AS animal_id, an.nombre AS animal, an.codigo AS animal_codigo,
              e.nombre_comun AS especie, i.id AS insumo_clinico_id, i.nombre AS insumo, i.tipo AS tipo_insumo,
              i.unidad_medida, ap.dosis AS ultima_dosis, ap.via, ap.fecha_aplicacion AS ultima_aplicacion,
              ap.proxima_dosis, DATEDIFF(ap.proxima_dosis, CURDATE()) AS dias,
              CASE WHEN ap.proxima_dosis < CURDATE() THEN 'vencida' ELSE 'proxima' END AS estado
         FROM aplicacion_clinica ap
         JOIN animal an ON an.id = ap.animal_id
         JOIN especie e ON e.id = an.especie_id
         JOIN insumo_clinico i ON i.id = ap.insumo_clinico_id
        WHERE an.estado = 'activo'
          AND ap.proxima_dosis <= CURDATE() + INTERVAL ? DAY
          AND ${CONDICION_DOSIS_PENDIENTE}
        ORDER BY ap.proxima_dosis, an.nombre, ap.id`,
      [dias]
    );
  },

  async crearAplicacion(d, veterinarioId, conn = db) {
    const r = await conn.query(
      `INSERT INTO aplicacion_clinica
         (animal_id, insumo_clinico_id, veterinario_id, consulta_id, dosis, via, fecha_aplicacion, proxima_dosis, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.animal_id, d.insumo_clinico_id, veterinarioId, d.consulta_id ?? null, d.dosis, d.via,
        d.fecha_aplicacion, d.proxima_dosis ?? null, d.observaciones]
    );
    return r.insertId;
  },

  /**
   * Movimiento de existencia. Las entradas y mermas las registra el inventario;
   * aquí solo se usa el tipo 'salida' que deja la aplicación.
   */
  crearMovimiento(d, conn = db) {
    return conn.query(
      `INSERT INTO movimiento_clinico
         (insumo_clinico_id, tipo, cantidad, aplicacion_id, numero_lote, fecha_vencimiento, motivo, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.insumo_clinico_id, d.tipo, d.cantidad, d.aplicacion_id ?? null, d.numero_lote ?? null,
        d.fecha_vencimiento ?? null, d.motivo ?? null, d.usuario_id]
    );
  },

  /**
   * Resta existencia de forma segura: el `AND stock_actual >= ?` evita que dos
   * aplicaciones simultáneas dejen el stock negativo. Quien pierda la carrera
   * recibe affectedRows = 0 y el controlador responde 409.
   */
  restarStock: (id, cantidad, conn = db) =>
    conn.query('UPDATE insumo_clinico SET stock_actual = stock_actual - ? WHERE id = ? AND stock_actual >= ?', [
      cantidad, id, cantidad,
    ]),

  // ------------------------------------------------------------ Conteos

  /** Dosis que ya pasaron de fecha y siguen sin reaplicarse. */
  conteoDosisVencidas() {
    return db
      .queryUno(
        `SELECT COUNT(*) AS total
           FROM aplicacion_clinica ap
           JOIN animal an ON an.id = ap.animal_id AND an.estado = 'activo'
          WHERE ap.proxima_dosis < CURDATE()
            AND ${CONDICION_DOSIS_PENDIENTE}`
      )
      .then((f) => Number(f.total));
  },

  /** Dosis que vencen de hoy hasta dentro de `dias` días. */
  conteoDosisProximas(dias) {
    return db
      .queryUno(
        `SELECT COUNT(*) AS total
           FROM aplicacion_clinica ap
           JOIN animal an ON an.id = ap.animal_id AND an.estado = 'activo'
          WHERE ap.proxima_dosis >= CURDATE()
            AND ap.proxima_dosis <= CURDATE() + INTERVAL ? DAY
            AND ${CONDICION_DOSIS_PENDIENTE}`,
        [dias]
      )
      .then((f) => Number(f.total));
  },

  // ----------------------------------------------------------- Reportes

  /**
   * Atenciones del periodo por veterinario. Cuenta las consultas por tipo y, en
   * la misma fila, las aplicaciones sueltas (vacunas de rutina, por ejemplo).
   * Solo aparecen los veterinarios con al menos un movimiento en el periodo.
   */
  reporteAtenciones({ desde, hasta }) {
    return db.query(
      `SELECT u.id AS veterinario_id, CONCAT(u.nombres, ' ', u.apellidos) AS veterinario,
              COALESCE(c.rutina, 0)      AS rutina,
              COALESCE(c.emergencia, 0)  AS emergencia,
              COALESCE(c.seguimiento, 0) AS seguimiento,
              COALESCE(c.ingreso, 0)     AS ingreso,
              COALESCE(c.total, 0)       AS total,
              COALESCE(a.aplicaciones, 0) AS aplicaciones
         FROM veterinario v
         JOIN usuario u ON u.id = v.usuario_id
         LEFT JOIN (
           SELECT veterinario_id,
                  COUNT(CASE WHEN tipo = 'rutina'     THEN 1 END) AS rutina,
                  COUNT(CASE WHEN tipo = 'emergencia' THEN 1 END) AS emergencia,
                  COUNT(CASE WHEN tipo = 'seguimiento' THEN 1 END) AS seguimiento,
                  COUNT(CASE WHEN tipo = 'ingreso'    THEN 1 END) AS ingreso,
                  COUNT(*) AS total
             FROM consulta_clinica
            WHERE DATE(fecha) BETWEEN ? AND ?
            GROUP BY veterinario_id
         ) c ON c.veterinario_id = v.usuario_id
         LEFT JOIN (
           SELECT veterinario_id, COUNT(*) AS aplicaciones
             FROM aplicacion_clinica
            WHERE DATE(fecha_aplicacion) BETWEEN ? AND ?
            GROUP BY veterinario_id
         ) a ON a.veterinario_id = v.usuario_id
        WHERE c.veterinario_id IS NOT NULL OR a.veterinario_id IS NOT NULL
        ORDER BY u.nombres, u.apellidos`,
      [desde, hasta, desde, hasta]
    );
  },

  /**
   * Consumo del periodo por producto activo. Las tres sumas salen de
   * movimiento_clinico (la bitácora de la existencia) para que cuadren con
   * stock_actual. Los productos sin movimientos en el periodo salen con cero.
   */
  reporteConsumo({ desde, hasta }) {
    return db.query(
      `SELECT i.id AS insumo_clinico_id, i.nombre, i.tipo, i.unidad_medida,
              COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad END), 0) AS entradas,
              COALESCE(SUM(CASE WHEN m.tipo = 'salida'  THEN m.cantidad END), 0) AS salidas,
              COALESCE(SUM(CASE WHEN m.tipo = 'merma'   THEN m.cantidad END), 0) AS mermas,
              i.stock_actual, i.stock_minimo
         FROM insumo_clinico i
         LEFT JOIN movimiento_clinico m
           ON m.insumo_clinico_id = i.id AND DATE(m.fecha) BETWEEN ? AND ?
        WHERE i.activo = 1
        GROUP BY i.id, i.nombre, i.tipo, i.unidad_medida, i.stock_actual, i.stock_minimo
        ORDER BY i.nombre`,
      [desde, hasta]
    );
  },

  /** Vacunas aplicadas en el periodo, de la más reciente a la más antigua. */
  reporteVacunacion({ desde, hasta }) {
    return db.query(
      `SELECT ap.fecha_aplicacion, an.nombre AS animal, an.codigo AS animal_codigo,
              e.nombre_comun AS especie, i.nombre AS vacuna, i.enfermedad_previene,
              CONCAT(u.nombres, ' ', u.apellidos) AS veterinario, ap.proxima_dosis
         FROM aplicacion_clinica ap
         JOIN animal an ON an.id = ap.animal_id
         JOIN especie e ON e.id = an.especie_id
         JOIN insumo_clinico i ON i.id = ap.insumo_clinico_id AND i.tipo = 'vacuna'
         JOIN usuario u ON u.id = ap.veterinario_id
        WHERE DATE(ap.fecha_aplicacion) BETWEEN ? AND ?
        ORDER BY ap.fecha_aplicacion DESC, ap.id DESC`,
      [desde, hasta]
    );
  },
};

module.exports = { clinico, SELECT_EXPEDIENTE, SELECT_CONSULTA, SELECT_APLICACION, CONDICION_DOSIS_PENDIENTE };
