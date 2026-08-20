const router = require('express').Router();
const ctrl = require('../controllers/expense.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { authorize } = require('../middleware/permission');

router.get('/', authenticate, tenantContext, ctrl.getAll);
router.post('/', authenticate, tenantContext, authorize('super_admin', 'admin', 'accountant', 'manager'), ctrl.create);
router.put('/:id', authenticate, tenantContext, authorize('super_admin', 'admin', 'accountant', 'manager'), ctrl.update);
router.post('/:id/approve', authenticate, tenantContext, authorize('super_admin', 'admin', 'accountant'), ctrl.approve);

module.exports = router;
