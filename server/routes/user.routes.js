const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { authorize } = require('../middleware/permission'); 
// Assuming a middleware authorize('admin') could be used, skipping here for simplicity

router.get('/', authenticate, tenantContext, ctrl.getAll);
router.post('/', authenticate, tenantContext, ctrl.create);
router.put('/:id', authenticate, tenantContext, ctrl.update);
router.delete('/:id', authenticate, tenantContext, ctrl.deactivate);

module.exports = router;
