/**
 * Zoo.etiquetas — Textos que ve el usuario para los valores guardados en la BD.
 * Así "en_tratamiento" se muestra igual en todos los módulos: "En tratamiento".
 *
 *   Zoo.etiquetas.texto('estadoSalud', 'en_tratamiento')   -> 'En tratamiento'
 *   Zoo.etiquetas.estado('estadoSalud', 'critico')          -> <span class="estado estado-peligro">Crítico</span>
 *   Zoo.etiquetas.opciones('tipoArea')                      -> [{ id: 'jaula', nombre: 'Jaula o recinto' }, ...]
 *   Zoo.ui.opciones(select, Zoo.etiquetas.opciones('sexo'), { vacio: 'Todos' });
 *
 * Cada módulo puede agregar las suyas:
 *   Zoo.etiquetas.agregar('estadoTarea', { pendiente: 'Pendiente', ... }, { pendiente: 'neutro', ... });
 */
(function () {
  const Zoo = (window.Zoo = window.Zoo || {});

  const catalogo = {
    tipoHabitat: {
      selva: 'Selva', sabana: 'Sabana', bosque: 'Bosque', desierto: 'Desierto', acuatico: 'Acuático',
      aviario: 'Aviario', montana: 'Montaña', herpetario: 'Herpetario', granja: 'Granja',
    },
    tipoArea: {
      jaula: 'Jaula o recinto', sanitario: 'Sanitario', jardin: 'Jardín', area_juegos: 'Área de juegos',
      oficina: 'Oficina', bodega: 'Bodega', clinica: 'Clínica', otra: 'Otra',
    },
    clasificacion: {
      mamifero: 'Mamífero', ave: 'Ave', reptil: 'Reptil', anfibio: 'Anfibio', pez: 'Pez', invertebrado: 'Invertebrado',
    },
    tipoDieta: {
      carnivoro: 'Carnívoro', herbivoro: 'Herbívoro', omnivoro: 'Omnívoro', insectivoro: 'Insectívoro',
      piscivoro: 'Piscívoro', frugivoro: 'Frugívoro', granivoro: 'Granívoro', nectarivoro: 'Nectarívoro',
    },
    conservacion: {
      LC: 'Preocupación menor (LC)', NT: 'Casi amenazada (NT)', VU: 'Vulnerable (VU)', EN: 'En peligro (EN)',
      CR: 'En peligro crítico (CR)', EW: 'Extinta en estado silvestre (EW)', DD: 'Datos insuficientes (DD)',
    },
    sexo: { macho: 'Macho', hembra: 'Hembra', desconocido: 'Sin determinar' },
    estadoSalud: { sano: 'Sano', en_observacion: 'En observación', en_tratamiento: 'En tratamiento', critico: 'Crítico' },
    estadoAnimal: { activo: 'En el zoológico', trasladado: 'Trasladado', fallecido: 'Fallecido' },
    activo: { 1: 'Activo', 0: 'Inactivo' },
  };

  /** Color del indicador: ok (verde), alerta (ámbar), peligro (rojo), neutro (gris) */
  const colores = {
    estadoSalud: { sano: 'ok', en_observacion: 'alerta', en_tratamiento: 'alerta', critico: 'peligro' },
    estadoAnimal: { activo: 'ok', trasladado: 'neutro', fallecido: 'neutro' },
    conservacion: { LC: 'ok', NT: 'neutro', VU: 'alerta', EN: 'peligro', CR: 'peligro', EW: 'peligro', DD: 'neutro' },
    activo: { 1: 'ok', 0: 'neutro' },
  };

  function texto(grupo, valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    return catalogo[grupo]?.[valor] ?? String(valor);
  }

  function estado(grupo, valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    const color = colores[grupo]?.[valor] || 'neutro';
    return `<span class="estado estado-${color}">${Zoo.ui.esc(texto(grupo, valor))}</span>`;
  }

  function opciones(grupo) {
    return Object.entries(catalogo[grupo] || {}).map(([id, nombre]) => ({ id, nombre }));
  }

  function agregar(grupo, textos, coloresGrupo) {
    catalogo[grupo] = { ...(catalogo[grupo] || {}), ...textos };
    if (coloresGrupo) colores[grupo] = { ...(colores[grupo] || {}), ...coloresGrupo };
  }

  Zoo.etiquetas = { texto, estado, opciones, agregar };
})();
