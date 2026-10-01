const { Router } = require('express');
const { query } = require('express-validator');
const controlador = require('./bitacora.controller');
const validar = require('../../middlewares/validar');

const router = Router();

router.get(
  '/',
  validar([
    query('desde').optional({ values: 'falsy' }).isISO8601().withMessage('Fecha inicial inválida.'),
    query('hasta').optional({ values: 'falsy' }).isISO8601().withMessage('Fecha final inválida.'),
    query('usuario_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Usuario inválido.'),
    query('modulo').optional({ values: 'falsy' }).isString().isLength({ max: 30 }),
    query('accion').optional({ values: 'falsy' }).isString().isLength({ max: 30 }),
    query('pagina').optional({ values: 'falsy' }).isInt({ min: 1 }),
    query('limite').optional({ values: 'falsy' }).isInt({ min: 1, max: 100 }),
  ]),
  controlador.listar
);

router.get('/filtros', controlador.filtros);

module.exports = router;
