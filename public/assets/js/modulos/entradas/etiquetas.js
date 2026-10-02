/**
 * Etiquetas del módulo de Entradas y Promociones.
 * Se carga tanto en el portal público como en el sistema interno.
 */
Zoo.etiquetas.agregar('canal', { web: 'En línea', taquilla: 'Taquilla' }, { web: 'info', taquilla: 'neutro' });
Zoo.etiquetas.agregar('estadoVenta', { pagada: 'Pagada', anulada: 'Anulada' }, { pagada: 'ok', anulada: 'peligro' });
Zoo.etiquetas.agregar(
  'estadoEntrada',
  { vigente: 'Vigente', usada: 'Ya ingresó', anulada: 'Anulada', vencida: 'Vencida' },
  { vigente: 'ok', usada: 'neutro', anulada: 'peligro', vencida: 'neutro' }
);
Zoo.etiquetas.agregar('metodoPago', { tarjeta: 'Tarjeta', efectivo: 'Efectivo', transferencia: 'Transferencia' });
Zoo.etiquetas.agregar(
  'vigenciaPromo',
  { vigente: 'Vigente', programada: 'Programada', vencida: 'Vencida', inactiva: 'Inactiva' },
  { vigente: 'ok', programada: 'info', vencida: 'neutro', inactiva: 'neutro' }
);
