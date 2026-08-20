const router = require('express').Router();
const ctrl = require('../controllers/tenant.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.get('/settings', authenticate, tenantContext, ctrl.getSettings);
router.put('/settings', authenticate, tenantContext, ctrl.updateSettings);

module.exports = router;
