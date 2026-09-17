const router = require('express').Router();
const ctrl = require('../controllers/businessDay.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { authorize } = require('../middleware/permission');

router.use(authenticate, tenantContext);
router.get('/current', ctrl.current);
router.get('/', ctrl.history);
router.post('/open', authorize('super_admin', 'admin', 'manager', 'accountant', 'sales'), ctrl.open);
router.post('/close', authorize('super_admin', 'admin', 'manager', 'accountant', 'sales'), ctrl.close);

module.exports = router;
