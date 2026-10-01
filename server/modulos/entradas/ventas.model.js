/**
 * Consultas base del módulo de entradas.
 * TODO (Mario): usarlas en ventas.controller.js. Devuelven los campos que espera
 * la interfaz (ver docs/api/entradas.md → "Objeto venta").
 */

/** Encabezado de una venta (compra). */
const SELECT_VENTA = `
  SELECT c.id, c.codigo, c.canal, c.fecha, c.fecha_visita, c.subtotal, c.descuento, c.total,
         c.metodo_pago, c.referencia_pago, c.estado, c.motivo_anulacion, c.fecha_anulacion,
         c.cliente_id, cl.nombre AS cliente, cl.correo AS cliente_correo, cl.nit AS cliente_nit,
         c.vendedor_id, CONCAT(uv.nombres, ' ', uv.apellidos) AS vendedor,
         CONCAT(ua.nombres, ' ', ua.apellidos) AS anulado_por,
         (SELECT COALESCE(SUM(d.cantidad), 0) FROM detalle_compra d WHERE d.compra_id = c.id) AS cantidad_entradas
    FROM compra c
    LEFT JOIN cliente cl ON cl.id = c.cliente_id
    LEFT JOIN usuario uv ON uv.id = c.vendedor_id
    LEFT JOIN usuario ua ON ua.id = c.anulado_por_id`;

/** Líneas de una venta. */
const SELECT_DETALLE = `
  SELECT d.id, d.tipo_entrada_id, t.nombre AS tipo_entrada, d.cantidad, d.precio_unitario,
         d.promocion_id, p.nombre AS promocion, d.descuento, d.subtotal
    FROM detalle_compra d
    JOIN tipo_entrada t ON t.id = d.tipo_entrada_id
    LEFT JOIN promocion p ON p.id = d.promocion_id
   WHERE d.compra_id = ?`;

/** Entradas (boletos) de una venta. */
const SELECT_ENTRADAS = `
  SELECT e.id, e.codigo_qr, t.nombre AS tipo_entrada, e.estado, e.fecha_uso
    FROM entrada e
    JOIN detalle_compra d ON d.id = e.detalle_id
    JOIN tipo_entrada t ON t.id = d.tipo_entrada_id
   WHERE d.compra_id = ?
   ORDER BY e.id`;

module.exports = { SELECT_VENTA, SELECT_DETALLE, SELECT_ENTRADAS };
