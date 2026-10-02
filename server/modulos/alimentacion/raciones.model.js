/**
 * Modelo de raciones: arma los turnos de un día y registra lo que se sirvió.
 *
 * Cómo se arma el día:
 *   1. Horarios activos de cada jaula que tocan ese día de la semana y ya existían ese día,
 *      ordenados por hora (1.°, 2.°, 3.° del día).
 *   2. Dietas vigentes de cada animal en esa fecha (las propias reemplazan a las de la especie).
 *   3. Una dieta con frecuencia_diaria = N se sirve en los primeros N horarios del día de la jaula.
 *
 * El consumo se descuenta de los lotes no vencidos del alimento, primero el que vence antes (FEFO).
 */
const db = require('../../config/db');
const dietas = require('./dietas.model');
const { diaSemana } = require('./constantes');

const MINUTOS_TOLERANCIA = 60; // después de esto, un turno pendiente de hoy se marca atrasado

function horarios(fecha) {
  return db.query(
    `SELECT h.id AS horario_id, h.area_id, ar.nombre AS area, hb.nombre AS habitat, TIME_FORMAT(h.hora, '%H:%i') AS hora,
            h.cuidador_id, CONCAT(u.nombres, ' ', u.apellidos) AS cuidador, h.observaciones
       FROM horario_alimentacion h
       JOIN area ar ON ar.id = h.area_id
       LEFT JOIN habitat hb ON hb.id = ar.habitat_id
       JOIN usuario u ON u.id = h.cuidador_id
      WHERE h.activo = 1 AND FIND_IN_SET(?, h.dias) > 0 AND DATE(h.creado_en) <= ?
      ORDER BY h.area_id, h.hora`,
    [diaSemana(fecha), fecha]
  );
}

function registrosDelDia(fecha) {
  return db.query(
    `SELECT r.id, r.dieta_id, r.animal_id, r.horario_id, r.usuario_id, CONCAT(u.nombres, ' ', u.apellidos) AS usuario,
            TIME_FORMAT(r.hora, '%H:%i') AS hora, r.cantidad_suministrada, r.consumo, r.observaciones
       FROM registro_alimentacion r JOIN usuario u ON u.id = r.usuario_id
      WHERE r.fecha = ?`,
    [fecha]
  );
}

function existencias() {
  return db.query(
    `SELECT l.alimento_id, ROUND(SUM(l.cantidad_disponible), 3) AS existencia
       FROM lote_alimento l
      WHERE l.cantidad_disponible > 0 AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURDATE())
      GROUP BY l.alimento_id`
  );
}

/** Minutos desde medianoche de 'HH:MM'. */
const minutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/**
 * Turnos de una fecha con sus animales, raciones y lo que ya se registró.
 * @param {string} fecha  AAAA-MM-DD
 * @param {object} opciones  { hoy, ahora: minutos desde medianoche, area_id, cuidador_id }
 */
async function turnos(fecha, { hoy, ahora, area_id, cuidador_id } = {}) {
  const [listaHorarios, animales, comidas, registros, stock] = await Promise.all([
    horarios(fecha),
    dietas.animales({}),
    dietas.efectivas({ fecha }),
    registrosDelDia(fecha),
    existencias(),
  ]);
  const existencia = Object.fromEntries(stock.map((s) => [s.alimento_id, s.existencia]));
  const registroDe = (horarioId, animalId, dietaId) =>
    registros.find((r) => r.horario_id === horarioId && r.animal_id === animalId && r.dieta_id === dietaId) || null;

  // Posición de cada horario dentro del día de su jaula (1 = el primero)
  const posicion = {};
  listaHorarios.forEach((h) => {
    posicion[h.area_id] = (posicion[h.area_id] || 0) + 1;
    h.numero = posicion[h.area_id];
  });

  const resultado = [];
  for (const h of listaHorarios) {
    if (area_id && h.area_id !== Number(area_id)) continue;
    if (cuidador_id && h.cuidador_id !== Number(cuidador_id)) continue;
    const animalesTurno = animales
      .filter((a) => a.area_id === h.area_id)
      .map((a) => ({
        animal_id: a.id, nombre: a.nombre, codigo: a.codigo, especie: a.especie, estado_salud: a.estado_salud,
        raciones: comidas
          .filter((c) => c.animal_id === a.id && c.frecuencia_diaria >= h.numero)
          .map((c) => ({
            dieta_id: c.dieta_id, alimento_id: c.alimento_id, alimento: c.alimento, unidad_medida: c.unidad_medida,
            cantidad_racion: c.cantidad_racion, frecuencia_diaria: c.frecuencia_diaria, indicaciones: c.indicaciones,
            origen: c.origen, existencia: existencia[c.alimento_id] || 0,
            registro: registroDe(h.horario_id, a.id, c.dieta_id),
          })),
      }))
      .filter((a) => a.raciones.length);
    if (!animalesTurno.length) continue;

    const total = animalesTurno.reduce((s, a) => s + a.raciones.length, 0);
    const hechas = animalesTurno.reduce((s, a) => s + a.raciones.filter((r) => r.registro).length, 0);
    let estado = hechas === total ? 'completo' : hechas ? 'parcial' : 'pendiente';
    if (estado !== 'completo') {
      if (fecha < hoy) estado = 'no_registrado';
      else if (fecha === hoy && ahora > minutos(h.hora) + MINUTOS_TOLERANCIA) estado = 'atrasado';
    }
    resultado.push({ ...h, total, registradas: hechas, estado, animales: animalesTurno });
  }
  resultado.sort((a, b) => a.hora.localeCompare(b.hora) || a.area.localeCompare(b.area));
  return resultado;
}

/** Lotes utilizables de un alimento, bloqueados, en orden FEFO. */
function lotesFefo(conn, alimentoId) {
  return conn.query(
    `SELECT id, numero_lote, cantidad_disponible FROM lote_alimento
      WHERE alimento_id = ? AND cantidad_disponible > 0 AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURDATE())
      ORDER BY fecha_vencimiento IS NULL, fecha_vencimiento, id
      FOR UPDATE`,
    [alimentoId]
  );
}

/** Inserta la ración y descuenta de los lotes. Devuelve el detalle de lotes usados. */
async function registrar(conn, r, usuarioId) {
  const res = await conn.query(
    `INSERT INTO registro_alimentacion (dieta_id, animal_id, horario_id, usuario_id, fecha, hora, cantidad_suministrada, consumo, observaciones)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [r.dieta_id, r.animal_id, r.horario_id, usuarioId, r.fecha, r.hora, r.cantidad_suministrada, r.consumo, r.observaciones]
  );
  let restante = r.cantidad_suministrada;
  const usados = [];
  for (const lote of r.lotes) {
    if (restante <= 0) break;
    const toma = Math.min(restante, Number(lote.cantidad_disponible));
    const cantidad = Math.round(toma * 1000) / 1000;
    await conn.query('UPDATE lote_alimento SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?', [cantidad, lote.id]);
    await conn.query(
      `INSERT INTO movimiento_alimento (lote_id, tipo, cantidad, registro_id, usuario_id, fecha)
       VALUES (?, 'consumo', ?, ?, ?, NOW())`,
      [lote.id, cantidad, res.insertId, usuarioId]
    );
    lote.cantidad_disponible = Number(lote.cantidad_disponible) - cantidad;
    restante = Math.round((restante - cantidad) * 1000) / 1000;
    usados.push({ lote_id: lote.id, numero_lote: lote.numero_lote, cantidad });
  }
  return { id: res.insertId, lotes: usados };
}

const obtener = (id) =>
  db.queryUno(
    `SELECT r.*, a.nombre AS animal, al.nombre AS alimento FROM registro_alimentacion r
       JOIN animal a ON a.id = r.animal_id JOIN dieta d ON d.id = r.dieta_id JOIN alimento al ON al.id = d.alimento_id
      WHERE r.id = ?`,
    [id]
  );

/** Deshace una ración: devuelve lo descontado a cada lote y borra sus movimientos. */
async function deshacer(conn, registroId) {
  const movimientos = await conn.query(
    "SELECT id, lote_id, cantidad FROM movimiento_alimento WHERE registro_id = ? AND tipo = 'consumo' FOR UPDATE",
    [registroId]
  );
  for (const m of movimientos) {
    await conn.query('UPDATE lote_alimento SET cantidad_disponible = cantidad_disponible + ? WHERE id = ?', [m.cantidad, m.lote_id]);
  }
  await conn.query('DELETE FROM movimiento_alimento WHERE registro_id = ?', [registroId]);
  await conn.query('DELETE FROM registro_alimentacion WHERE id = ?', [registroId]);
  return movimientos.length;
}

module.exports = { turnos, lotesFefo, registrar, obtener, deshacer, MINUTOS_TOLERANCIA };
