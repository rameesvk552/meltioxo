const router = require('express').Router();
const ctrl = require('../controllers/journal.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { authorize } = require('../middleware/permission');
const { validate } = require('../middleware/validate');
const { createJournalSchema } = require('../validators/journal.validator');

router.get('/', authenticate, tenantContext, ctrl.getAll);
router.get('/:id', authenticate, tenantContext, ctrl.getById);
router.post('/', authenticate, tenantContext, authorize('super_admin', 'admin', 'accountant'), validate(createJournalSchema), ctrl.create);
router.post('/:id/post', authenticate, tenantContext, authorize('super_admin', 'admin', 'accountant'), ctrl.post);
router.post('/:id/reverse', authenticate, tenantContext, authorize('super_admin', 'admin', 'accountant'), ctrl.reverse);

module.exports = router;
