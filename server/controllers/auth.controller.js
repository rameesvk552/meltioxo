const authService = require('../services/auth.service');
const { recordAudit } = require('../services/audit.service');
const { setAuditActor } = require('../middleware/auditContext');
const db = require('../models');

const publicUser = value => {
  const result = value?.toJSON ? value.toJSON() : { ...value };
  delete result.password_hash;
  return result;
};

exports.register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    await recordAudit({
      action: 'register',
      entityType: 'authentication',
      entityId: result.user.id,
      tenantId: result.tenant.id,
      after: { user_id: result.user.id, email: result.user.email, company_name: result.tenant.name }
    });
    res.status(201).json({ ...result, user: publicUser(result.user) });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    await recordAudit({
      action: 'login',
      entityType: 'authentication',
      entityId: result.user.id,
      tenantId: result.user.tenant_id,
      after: { user_id: result.user.id, email: result.user.email }
    });
    res.status(200).json({ ...result, user: publicUser(result.user) });
  } catch (error) {
    const candidate = await db.user.findOne({ where: { email: req.body.email }, attributes: ['id', 'tenant_id', 'email'] }).catch(() => null);
    await recordAudit({
      action: 'login_failed',
      entityType: 'authentication',
      entityId: candidate?.id || null,
      tenantId: candidate?.tenant_id || null,
      metadata: { email: req.body.email }
    }).catch(() => {});
    next(error);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const result = await authService.refreshAccessToken(req.body.refreshToken);
    setAuditActor(result.user);
    await recordAudit({
      action: 'token_refresh',
      entityType: 'authentication',
      entityId: result.user.id,
      tenantId: result.user.tenant_id,
      after: { user_id: result.user.id, email: result.user.email }
    });
    res.status(200).json({ tokens: result.tokens });
  } catch (error) {
    await recordAudit({ action: 'token_refresh_failed', entityType: 'authentication' }).catch(() => {});
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    await recordAudit({ action: 'logout', entityType: 'authentication', entityId: req.user.id, tenantId: req.tenantId, before: { user_id: req.user.id, email: req.user.email } });
    res.status(200).json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    res.status(200).json({ user: publicUser(req.user) });
  } catch (error) {
    next(error);
  }
};
