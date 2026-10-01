/**
 * Controlador de los catálogos compartidos.
 * Aplica las reglas de negocio y registra cada cambio en la bitácora.
 */
const { habitats, areas, especies, animales } = require('./catalogos.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../bitacora/bitacora.service');

const MODULO = 'catalogos';

function registrar(req, accion, tabla, registroId, detalle) {
  return bitacora.registrar(req, { modulo: MODULO, accion, tabla, registroId, detalle });
}

async function exigir(promesa, mensaje) {
  const registro = await promesa;
  if (!registro) throw AppError.noEncontrado(mensaje);
  return registro;
}

// ================================================================ Hábitats
const habitat = {
  listar: async (req, res) => ok(res, await habitats.listar(req.query)),

  obtener: async (req, res) => ok(res, await exigir(habitats.obtener(req.params.id), 'El hábitat no existe.')),

  async crear(req, res) {
    const datos = datosValidos(req);
    const id = await habitats.crear(datos);
    await registrar(req, bitacora.ACCIONES.CREAR, 'habitat', id, { nombre: datos.nombre });
    return creado(res, { id }, 'Hábitat registrado.');
  },

  async actualizar(req, res) {
    const id = Number(req.params.id);
    const antes = await exigir(habitats.obtener(id), 'El hábitat no existe.');
    const datos = datosValidos(req);
    await habitats.actualizar(id, datos);
    await registrar(req, bitacora.ACCIONES.ACTUALIZAR, 'habitat', id, { antes: { nombre: antes.nombre, tipo: antes.tipo }, despues: datos });
    return ok(res, null, 'Hábitat actualizado.');
  },

  async cambiarEstado(req, res) {
    const id = Number(req.params.id);
    const { activo } = datosValidos(req);
    await exigir(habitats.obtener(id), 'El hábitat no existe.');
    if (!activo && (await habitats.contarJaulasActivas(id)) > 0) {
      throw AppError.conflicto('No se puede desactivar: el hábitat tiene jaulas activas. Desactívalas o muévelas primero.');
    }
    await habitats.cambiarEstado(id, activo);
    await registrar(req, activo ? bitacora.ACCIONES.ACTIVAR : bitacora.ACCIONES.DESACTIVAR, 'habitat', id);
    return ok(res, null, activo ? 'Hábitat activado.' : 'Hábitat desactivado.');
  },
};

// =================================================================== Áreas
async function validarArea(datos, id = null) {
  if (datos.tipo === 'jaula' && !datos.habitat_id) {
    throw AppError.validacion([{ campo: 'habitat_id', mensaje: 'Las jaulas deben pertenecer a un hábitat.' }]);
  }
  if (datos.habitat_id) {
    const h = await habitats.obtener(datos.habitat_id);
    if (!h || !h.activo) throw AppError.validacion([{ campo: 'habitat_id', mensaje: 'El hábitat no existe o está inactivo.' }]);
  }
  if (id && datos.tipo !== 'jaula' && (await areas.contarAnimalesActivos(id)) > 0) {
    throw AppError.validacion([{ campo: 'tipo', mensaje: 'Esta jaula tiene animales; no puede cambiar a otro tipo de área.' }]);
  }
}

const area = {
  listar: async (req, res) => ok(res, await areas.listar(req.query)),

  obtener: async (req, res) => ok(res, await exigir(areas.obtener(req.params.id), 'El área no existe.')),

  async crear(req, res) {
    const datos = datosValidos(req);
    await validarArea(datos);
    const id = await areas.crear(datos);
    await registrar(req, bitacora.ACCIONES.CREAR, 'area', id, { nombre: datos.nombre, tipo: datos.tipo });
    return creado(res, { id }, 'Área registrada.');
  },

  async actualizar(req, res) {
    const id = Number(req.params.id);
    const antes = await exigir(areas.obtener(id), 'El área no existe.');
    const datos = datosValidos(req);
    await validarArea(datos, id);
    await areas.actualizar(id, datos);
    await registrar(req, bitacora.ACCIONES.ACTUALIZAR, 'area', id, { antes: { nombre: antes.nombre, tipo: antes.tipo }, despues: datos });
    return ok(res, null, 'Área actualizada.');
  },

  async cambiarEstado(req, res) {
    const id = Number(req.params.id);
    const { activo } = datosValidos(req);
    const actual = await exigir(areas.obtener(id), 'El área no existe.');
    if (!activo && (await areas.contarAnimalesActivos(id)) > 0) {
      throw AppError.conflicto('No se puede desactivar: la jaula tiene animales. Muévelos a otra jaula primero.');
    }
    if (activo && actual.habitat_id) {
      const h = await habitats.obtener(actual.habitat_id);
      if (!h.activo) throw AppError.conflicto('Activa primero el hábitat al que pertenece esta área.');
    }
    await areas.cambiarEstado(id, activo);
    await registrar(req, activo ? bitacora.ACCIONES.ACTIVAR : bitacora.ACCIONES.DESACTIVAR, 'area', id);
    return ok(res, null, activo ? 'Área activada.' : 'Área desactivada.');
  },
};

// ================================================================ Especies
const especie = {
  listar: async (req, res) => ok(res, await especies.listar(req.query)),

  obtener: async (req, res) => ok(res, await exigir(especies.obtener(req.params.id), 'La especie no existe.')),

  async crear(req, res) {
    const datos = datosValidos(req);
    const id = await especies.crear(datos);
    await registrar(req, bitacora.ACCIONES.CREAR, 'especie', id, { nombre: datos.nombre_comun });
    return creado(res, { id }, 'Especie registrada.');
  },

  async actualizar(req, res) {
    const id = Number(req.params.id);
    const antes = await exigir(especies.obtener(id), 'La especie no existe.');
    const datos = datosValidos(req);
    await especies.actualizar(id, datos);
    await registrar(req, bitacora.ACCIONES.ACTUALIZAR, 'especie', id, { antes: { nombre: antes.nombre_comun }, despues: datos });
    return ok(res, null, 'Especie actualizada.');
  },

  async cambiarEstado(req, res) {
    const id = Number(req.params.id);
    const { activo } = datosValidos(req);
    await exigir(especies.obtener(id), 'La especie no existe.');
    if (!activo && (await especies.contarAnimalesActivos(id)) > 0) {
      throw AppError.conflicto('No se puede desactivar: hay animales activos de esta especie.');
    }
    await especies.cambiarEstado(id, activo);
    await registrar(req, activo ? bitacora.ACCIONES.ACTIVAR : bitacora.ACCIONES.DESACTIVAR, 'especie', id);
    return ok(res, null, activo ? 'Especie activada.' : 'Especie desactivada.');
  },
};

// ================================================================ Animales
async function validarAnimal(datos, actual = null) {
  const errores = [];
  const e = await especies.obtener(datos.especie_id);
  if (!e || (!e.activo && e.id !== actual?.especie_id)) errores.push({ campo: 'especie_id', mensaje: 'La especie no existe o está inactiva.' });

  const a = await areas.obtener(datos.area_id);
  if (!a || a.tipo !== 'jaula') errores.push({ campo: 'area_id', mensaje: 'Selecciona una jaula o recinto válido.' });
  else if (!a.activo && a.id !== actual?.area_id) errores.push({ campo: 'area_id', mensaje: 'La jaula está inactiva.' });

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  if (datos.fecha_nacimiento && datos.fecha_nacimiento > hoy) errores.push({ campo: 'fecha_nacimiento', mensaje: 'No puede ser una fecha futura.' });
  if (datos.fecha_ingreso > hoy) errores.push({ campo: 'fecha_ingreso', mensaje: 'No puede ser una fecha futura.' });
  if (datos.fecha_nacimiento && datos.fecha_nacimiento > datos.fecha_ingreso) {
    errores.push({ campo: 'fecha_ingreso', mensaje: 'Debe ser igual o posterior a la fecha de nacimiento.' });
  }
  if (errores.length) throw AppError.validacion(errores);
}

const animal = {
  listar: async (req, res) => ok(res, await animales.listar(req.query)),

  obtener: async (req, res) => ok(res, await exigir(animales.obtener(req.params.id), 'El animal no existe.')),

  async crear(req, res) {
    const datos = datosValidos(req);
    await validarAnimal(datos);
    const { id, codigo } = await animales.crear(datos);
    await registrar(req, bitacora.ACCIONES.CREAR, 'animal', id, { codigo, nombre: datos.nombre });
    return creado(res, { id, codigo }, `Animal registrado con el código ${codigo}.`);
  },

  async actualizar(req, res) {
    const id = Number(req.params.id);
    const antes = await exigir(animales.obtener(id), 'El animal no existe.');
    const datos = datosValidos(req);
    await validarAnimal(datos, antes);
    await animales.actualizar(id, datos);

    const cambios = {};
    for (const [campo, valor] of Object.entries(datos)) {
      if (String(antes[campo] ?? '') !== String(valor ?? '')) cambios[campo] = { antes: antes[campo], despues: valor };
    }
    await registrar(req, bitacora.ACCIONES.ACTUALIZAR, 'animal', id, { codigo: antes.codigo, cambios });
    return ok(res, null, 'Animal actualizado.');
  },
};

module.exports = { habitat, area, especie, animal };
