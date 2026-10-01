/**
 * Modelo de los catálogos compartidos: hábitats, áreas, especies y animales.
 * Solo consultas SQL.
 */
const db = require('../../config/db');

// ============================================================== Utilidades
function filtroActivo(campo, valor, condiciones, parametros) {
  if (valor === undefined || valor === null || valor === '') return;
  condiciones.push(`${campo} = ?`);
  parametros.push(Number(valor));
}

const where = (condiciones) => (condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '');

// ================================================================ Hábitats
const habitats = {
  listar({ buscar, tipo, activo } = {}) {
    const condiciones = [];
    const parametros = [];
    if (buscar) {
      condiciones.push('(h.nombre LIKE ? OR h.ubicacion LIKE ?)');
      parametros.push(`%${buscar}%`, `%${buscar}%`);
    }
    if (tipo) { condiciones.push('h.tipo = ?'); parametros.push(tipo); }
    filtroActivo('h.activo', activo, condiciones, parametros);
    return db.query(
      `SELECT h.*,
              (SELECT COUNT(*) FROM area a WHERE a.habitat_id = h.id AND a.activo = 1) AS jaulas,
              (SELECT COUNT(*) FROM animal an JOIN area a ON a.id = an.area_id
                WHERE a.habitat_id = h.id AND an.estado = 'activo') AS animales
         FROM habitat h ${where(condiciones)}
        ORDER BY h.activo DESC, h.nombre`,
      parametros
    );
  },
  obtener: (id) => db.queryUno('SELECT * FROM habitat WHERE id = ?', [id]),
  async crear(d) {
    const r = await db.query(
      'INSERT INTO habitat (nombre, tipo, descripcion, ubicacion, capacidad_max) VALUES (?, ?, ?, ?, ?)',
      [d.nombre, d.tipo, d.descripcion, d.ubicacion, d.capacidad_max]
    );
    return r.insertId;
  },
  actualizar: (id, d) =>
    db.query(
      'UPDATE habitat SET nombre = ?, tipo = ?, descripcion = ?, ubicacion = ?, capacidad_max = ? WHERE id = ?',
      [d.nombre, d.tipo, d.descripcion, d.ubicacion, d.capacidad_max, id]
    ),
  cambiarEstado: (id, activo) => db.query('UPDATE habitat SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]),
  contarJaulasActivas: async (id) =>
    (await db.queryUno('SELECT COUNT(*) AS total FROM area WHERE habitat_id = ? AND activo = 1', [id])).total,
};

// =================================================================== Áreas
const areas = {
  listar({ buscar, tipo, habitat_id, activo } = {}) {
    const condiciones = [];
    const parametros = [];
    if (buscar) {
      condiciones.push('(a.nombre LIKE ? OR a.ubicacion LIKE ?)');
      parametros.push(`%${buscar}%`, `%${buscar}%`);
    }
    if (tipo) { condiciones.push('a.tipo = ?'); parametros.push(tipo); }
    if (habitat_id) { condiciones.push('a.habitat_id = ?'); parametros.push(habitat_id); }
    filtroActivo('a.activo', activo, condiciones, parametros);
    return db.query(
      `SELECT a.*, h.nombre AS habitat,
              (SELECT COUNT(*) FROM animal an WHERE an.area_id = a.id AND an.estado = 'activo') AS animales
         FROM area a LEFT JOIN habitat h ON h.id = a.habitat_id
         ${where(condiciones)}
        ORDER BY a.activo DESC, FIELD(a.tipo, 'jaula') DESC, a.nombre`,
      parametros
    );
  },
  obtener: (id) => db.queryUno('SELECT * FROM area WHERE id = ?', [id]),
  async crear(d) {
    const r = await db.query(
      'INSERT INTO area (habitat_id, nombre, tipo, ubicacion, descripcion) VALUES (?, ?, ?, ?, ?)',
      [d.habitat_id, d.nombre, d.tipo, d.ubicacion, d.descripcion]
    );
    return r.insertId;
  },
  actualizar: (id, d) =>
    db.query(
      'UPDATE area SET habitat_id = ?, nombre = ?, tipo = ?, ubicacion = ?, descripcion = ? WHERE id = ?',
      [d.habitat_id, d.nombre, d.tipo, d.ubicacion, d.descripcion, id]
    ),
  cambiarEstado: (id, activo) => db.query('UPDATE area SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]),
  contarAnimalesActivos: async (id) =>
    (await db.queryUno("SELECT COUNT(*) AS total FROM animal WHERE area_id = ? AND estado = 'activo'", [id])).total,
};

// ================================================================ Especies
const especies = {
  listar({ buscar, clasificacion, tipo_dieta, activo } = {}) {
    const condiciones = [];
    const parametros = [];
    if (buscar) {
      condiciones.push('(e.nombre_comun LIKE ? OR e.nombre_cientifico LIKE ?)');
      parametros.push(`%${buscar}%`, `%${buscar}%`);
    }
    if (clasificacion) { condiciones.push('e.clasificacion = ?'); parametros.push(clasificacion); }
    if (tipo_dieta) { condiciones.push('e.tipo_dieta = ?'); parametros.push(tipo_dieta); }
    filtroActivo('e.activo', activo, condiciones, parametros);
    return db.query(
      `SELECT e.*,
              (SELECT COUNT(*) FROM animal an WHERE an.especie_id = e.id AND an.estado = 'activo') AS animales
         FROM especie e ${where(condiciones)}
        ORDER BY e.activo DESC, e.nombre_comun`,
      parametros
    );
  },
  obtener: (id) => db.queryUno('SELECT * FROM especie WHERE id = ?', [id]),
  async crear(d) {
    const r = await db.query(
      `INSERT INTO especie (nombre_comun, nombre_cientifico, clasificacion, tipo_dieta, estado_conservacion, descripcion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [d.nombre_comun, d.nombre_cientifico, d.clasificacion, d.tipo_dieta, d.estado_conservacion, d.descripcion]
    );
    return r.insertId;
  },
  actualizar: (id, d) =>
    db.query(
      `UPDATE especie SET nombre_comun = ?, nombre_cientifico = ?, clasificacion = ?, tipo_dieta = ?,
              estado_conservacion = ?, descripcion = ? WHERE id = ?`,
      [d.nombre_comun, d.nombre_cientifico, d.clasificacion, d.tipo_dieta, d.estado_conservacion, d.descripcion, id]
    ),
  cambiarEstado: (id, activo) => db.query('UPDATE especie SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]),
  contarAnimalesActivos: async (id) =>
    (await db.queryUno("SELECT COUNT(*) AS total FROM animal WHERE especie_id = ? AND estado = 'activo'", [id])).total,
};

// ================================================================ Animales
const CAMPOS_ANIMAL = `
  an.*, e.nombre_comun AS especie, e.nombre_cientifico, a.nombre AS area, h.nombre AS habitat,
  TIMESTAMPDIFF(YEAR, an.fecha_nacimiento, CURDATE()) AS edad_anios`;

const JOIN_ANIMAL = `
  FROM animal an
  JOIN especie e ON e.id = an.especie_id
  JOIN area a ON a.id = an.area_id
  LEFT JOIN habitat h ON h.id = a.habitat_id`;

const animales = {
  listar({ buscar, especie_id, area_id, estado, estado_salud } = {}) {
    const condiciones = [];
    const parametros = [];
    if (buscar) {
      condiciones.push('(an.nombre LIKE ? OR an.codigo LIKE ? OR e.nombre_comun LIKE ?)');
      parametros.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }
    if (especie_id) { condiciones.push('an.especie_id = ?'); parametros.push(especie_id); }
    if (area_id) { condiciones.push('an.area_id = ?'); parametros.push(area_id); }
    if (estado) { condiciones.push('an.estado = ?'); parametros.push(estado); }
    if (estado_salud) { condiciones.push('an.estado_salud = ?'); parametros.push(estado_salud); }
    return db.query(
      `SELECT ${CAMPOS_ANIMAL} ${JOIN_ANIMAL} ${where(condiciones)}
        ORDER BY FIELD(an.estado, 'activo') DESC, an.codigo`,
      parametros
    );
  },
  obtener: (id) => db.queryUno(`SELECT ${CAMPOS_ANIMAL} ${JOIN_ANIMAL} WHERE an.id = ?`, [id]),

  /** Siguiente código disponible: ANI-0001, ANI-0002, ... */
  async siguienteCodigo(conn = db) {
    const fila = await conn.queryUno(
      "SELECT MAX(CAST(SUBSTRING(codigo, 5) AS UNSIGNED)) AS ultimo FROM animal WHERE codigo LIKE 'ANI-%' FOR UPDATE"
    );
    return `ANI-${String((fila?.ultimo || 0) + 1).padStart(4, '0')}`;
  },

  async crear(d) {
    return db.transaccion(async (conn) => {
      const codigo = await animales.siguienteCodigo(conn);
      const r = await conn.query(
        `INSERT INTO animal (codigo, nombre, especie_id, area_id, sexo, fecha_nacimiento, fecha_ingreso,
                             procedencia, peso_kg, estado_salud, estado, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [codigo, d.nombre, d.especie_id, d.area_id, d.sexo, d.fecha_nacimiento, d.fecha_ingreso,
          d.procedencia, d.peso_kg, d.estado_salud, d.estado, d.observaciones]
      );
      return { id: r.insertId, codigo };
    });
  },

  actualizar: (id, d) =>
    db.query(
      `UPDATE animal SET nombre = ?, especie_id = ?, area_id = ?, sexo = ?, fecha_nacimiento = ?, fecha_ingreso = ?,
              procedencia = ?, peso_kg = ?, estado_salud = ?, estado = ?, observaciones = ?
        WHERE id = ?`,
      [d.nombre, d.especie_id, d.area_id, d.sexo, d.fecha_nacimiento, d.fecha_ingreso,
        d.procedencia, d.peso_kg, d.estado_salud, d.estado, d.observaciones, id]
    ),

};

module.exports = { habitats, areas, especies, animales };
