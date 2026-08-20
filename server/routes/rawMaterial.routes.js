const router = require('express').Router();
const ctrl = require('../controllers/rawMaterial.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.get('/', authenticate, tenantContext, ctrl.getAll);
router.get('/alerts/low-stock', authenticate, tenantContext, ctrl.getLowStock);
router.get('/:id', authenticate, tenantContext, ctrl.getById);
router.post('/', authenticate, tenantContext, ctrl.create);
router.put('/:id', authenticate, tenantContext, ctrl.update);
router.delete('/:id', authenticate, tenantContext, ctrl.delete);
router.get('/:id/ledger', authenticate, tenantContext, ctrl.getLedger);
router.post('/:id/adjust', authenticate, tenantContext, ctrl.adjustStock);

module.exports = router;
