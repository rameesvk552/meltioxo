const router = require('express').Router();
const ctrl = require('../controllers/formula.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.get('/', authenticate, tenantContext, ctrl.getAll);
router.get('/:id', authenticate, tenantContext, ctrl.getById);
router.post('/', authenticate, tenantContext, ctrl.create);
router.put('/:id', authenticate, tenantContext, ctrl.update);
router.delete('/:id', authenticate, tenantContext, ctrl.delete);
router.post('/:id/clone', authenticate, tenantContext, ctrl.clone);
router.get('/:id/cost', authenticate, tenantContext, ctrl.calculateCost);

module.exports = router;
