const router = require('express').Router();
const ctrl = require('../controllers/finishedGoods.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.get('/', authenticate, tenantContext, ctrl.getAll);
router.post('/ready-made', authenticate, tenantContext, ctrl.createReadyMade);
router.get('/:id', authenticate, tenantContext, ctrl.getById);
router.post('/', authenticate, tenantContext, ctrl.create);
router.put('/:id', authenticate, tenantContext, ctrl.update);

module.exports = router;
