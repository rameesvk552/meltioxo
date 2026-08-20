const router = require('express').Router();
const ctrl = require('../controllers/supplier.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.get('/', authenticate, tenantContext, ctrl.getAll);
router.get('/:id', authenticate, tenantContext, ctrl.getById);
router.post('/', authenticate, tenantContext, ctrl.create);
router.put('/:id', authenticate, tenantContext, ctrl.update);
router.delete('/:id', authenticate, tenantContext, ctrl.delete);
// Assuming /:id/statement is handled in controller or can be added later
// router.get('/:id/statement', authenticate, tenantContext, ctrl.getStatement);

module.exports = router;
