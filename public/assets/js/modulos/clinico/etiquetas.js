/**
 * Etiquetas del módulo de Control Clínico.
 */
Zoo.etiquetas.agregar(
  'tipoInsumoClinico',
  { medicamento: 'Medicamento', vacuna: 'Vacuna', vitamina: 'Vitamina' },
  { medicamento: 'info', vacuna: 'ok', vitamina: 'alerta' }
);

Zoo.etiquetas.agregar('unidadClinica', {
  ml: 'ml', mg: 'mg', g: 'g', tableta: 'tabletas', dosis: 'dosis', unidad: 'unidades',
});

Zoo.etiquetas.agregar('via', {
  oral: 'Oral', intramuscular: 'Intramuscular', subcutanea: 'Subcutánea', intravenosa: 'Intravenosa',
  topica: 'Tópica', inhalada: 'Inhalada', otra: 'Otra',
});

Zoo.etiquetas.agregar(
  'tipoConsulta',
  { rutina: 'Rutina', emergencia: 'Emergencia', seguimiento: 'Seguimiento', ingreso: 'Ingreso' },
  { rutina: 'neutro', emergencia: 'peligro', seguimiento: 'info', ingreso: 'ok' }
);

Zoo.etiquetas.agregar(
  'estadoDosis',
  { vencida: 'Vencida', proxima: 'Próxima' },
  { vencida: 'peligro', proxima: 'alerta' }
);

Zoo.etiquetas.agregar(
  'movimientoClinico',
  { entrada: 'Entrada', salida: 'Aplicación', merma: 'Merma' },
  { entrada: 'ok', salida: 'neutro', merma: 'peligro' }
);
