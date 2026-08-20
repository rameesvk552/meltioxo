const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/auth.validator');

router.post('/register', validate(registerSchema), ctrl.register);
router.post('/login', validate(loginSchema), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', authenticate, tenantContext, ctrl.logout);
router.get('/me', authenticate, tenantContext, ctrl.getMe);

module.exports = router;
