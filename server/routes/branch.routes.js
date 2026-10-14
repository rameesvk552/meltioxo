const router = require('express').Router();
const ctrl = require('../controllers/branch.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { authorize } = require('../middleware/permission');

router.use(authenticate, tenantContext);
router.get('/', ctrl.getAll);
router.post('/', authorize('super_admin', 'admin'), ctrl.create);
router.put('/:id', authorize('super_admin', 'admin'), ctrl.update);
router.delete('/:id', authorize('super_admin', 'admin'), ctrl.deactivate);
module.exports = router;
