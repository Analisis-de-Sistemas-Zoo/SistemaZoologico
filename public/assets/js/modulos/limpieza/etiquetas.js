/**
 * Etiquetas del módulo de Limpieza (texto y color de cada valor de la BD).
 */
Zoo.etiquetas.agregar(
  'estadoTarea',
  { pendiente: 'Pendiente', en_proceso: 'En proceso', completada: 'Por verificar', verificada: 'Verificada', rechazada: 'Rechazada', cancelada: 'Cancelada' },
  { pendiente: 'neutro', en_proceso: 'alerta', completada: 'info', verificada: 'ok', rechazada: 'peligro', cancelada: 'neutro' }
);

Zoo.etiquetas.agregar('tipoLimpieza', {
  rutinaria: 'Rutinaria', profunda: 'Profunda', desinfeccion: 'Desinfección', emergencia: 'Emergencia',
});

Zoo.etiquetas.agregar('unidadInsumo', {
  l: 'Litros', ml: 'Mililitros', kg: 'Kilogramos', g: 'Gramos', galon: 'Galones', unidad: 'Unidades',
});

Zoo.etiquetas.agregar('unidadCorta', { l: 'l', ml: 'ml', kg: 'kg', g: 'g', galon: 'gal', unidad: 'u.' });

Zoo.etiquetas.agregar(
  'movimientoInsumo',
  { entrada: 'Entrada', salida: 'Salida por tarea', merma: 'Merma' },
  { entrada: 'ok', salida: 'neutro', merma: 'peligro' }
);
