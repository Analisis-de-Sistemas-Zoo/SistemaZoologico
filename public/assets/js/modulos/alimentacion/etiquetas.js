/**
 * Etiquetas del módulo de Alimentación (texto y color de cada valor de la BD).
 */
Zoo.etiquetas.agregar('categoriaAlimento', {
  carne: 'Carne', pescado: 'Pescado', fruta: 'Fruta', verdura: 'Verdura', forraje: 'Forraje', grano: 'Grano o semilla',
  insecto: 'Insectos', presa: 'Presa entera', concentrado: 'Concentrado', suplemento: 'Suplemento', otro: 'Otro',
});

Zoo.etiquetas.agregar('unidadAlimento', { kg: 'Kilogramos', g: 'Gramos', l: 'Litros', unidad: 'Unidades' });
Zoo.etiquetas.agregar('unidadAlimentoCorta', { kg: 'kg', g: 'g', l: 'l', unidad: 'u.' });

Zoo.etiquetas.agregar(
  'estadoLote',
  { disponible: 'Disponible', por_vencer: 'Por vencer', vencido: 'Vencido', agotado: 'Agotado' },
  { disponible: 'ok', por_vencer: 'alerta', vencido: 'peligro', agotado: 'neutro' }
);

Zoo.etiquetas.agregar(
  'movimientoAlimento',
  { entrada: 'Entrada', consumo: 'Consumo', merma: 'Merma' },
  { entrada: 'ok', consumo: 'neutro', merma: 'peligro' }
);

Zoo.etiquetas.agregar('alertaAlimento', { bajo_minimo: 'Bajo el mínimo', por_vencer: 'Lotes por vencer', vencido: 'Con lotes vencidos' });
