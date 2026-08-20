const router = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth');

router.get('/tenants', authenticate, ctrl.getTenants);
router.get('/tenants/:id', authenticate, ctrl.getTenantById);
router.put('/tenants/:id/status', authenticate, ctrl.updateTenantStatus);
router.get('/stats', authenticate, ctrl.getStats);

module.exports = router;
