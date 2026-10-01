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

Zoo.etiquetas.agregar(
  'estadoDieta',
  { vigente: 'Vigente', programada: 'Programada', finalizada: 'Finalizada' },
  { vigente: 'ok', programada: 'info', finalizada: 'neutro' }
);

Zoo.etiquetas.agregar(
  'origenDieta',
  { especie: 'Dieta de su especie', animal: 'Dieta propia' },
  { especie: 'neutro', animal: 'info' }
);

Zoo.etiquetas.agregar('diaSemana', { lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves', vie: 'Viernes', sab: 'Sábado', dom: 'Domingo' });
Zoo.etiquetas.agregar('diaCorto', { lun: 'L', mar: 'M', mie: 'X', jue: 'J', vie: 'V', sab: 'S', dom: 'D' });

Zoo.etiquetas.agregar(
  'estadoTurno',
  { completo: 'Completo', parcial: 'En proceso', pendiente: 'Pendiente', atrasado: 'Atrasado', no_registrado: 'Sin registrar' },
  { completo: 'ok', parcial: 'info', pendiente: 'neutro', atrasado: 'peligro', no_registrado: 'peligro' }
);

Zoo.etiquetas.agregar(
  'consumo',
  { completo: 'Comió todo', parcial: 'Comió una parte', nulo: 'No comió' },
  { completo: 'ok', parcial: 'alerta', nulo: 'peligro' }
);
