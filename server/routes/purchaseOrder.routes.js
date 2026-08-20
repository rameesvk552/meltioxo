const router = require('express').Router();
const ctrl = require('../controllers/purchaseOrder.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.get('/', authenticate, tenantContext, ctrl.getAll);
router.get('/:id', authenticate, tenantContext, ctrl.getById);
router.post('/', authenticate, tenantContext, ctrl.create);
router.put('/:id', authenticate, tenantContext, ctrl.update);
router.post('/:id/approve', authenticate, tenantContext, ctrl.approve);
router.post('/:id/cancel', authenticate, tenantContext, ctrl.cancel);
router.post('/:id/receive', authenticate, tenantContext, ctrl.receive);

module.exports = router;
