const { user, branch } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');
const { normalizePermissions } = require('../middleware/permission');

const publicAttributes = { exclude: ['password_hash'] };

const buildUpdate = body => {
  const update = {};
  if (body.name !== undefined) update.name = String(body.name).trim();
  if (body.email !== undefined) update.email = String(body.email).trim().toLowerCase();
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) throw new AppError('Invalid role', 400);
    update.role = body.role;
  }
  if (body.is_active !== undefined) update.is_active = Boolean(body.is_active);
  if (body.permissions !== undefined) update.permissions = normalizePermissions(body.permissions);
  return update;
};

exports.getAll = async (req, res, next) => {
  try {
    const users = await user.findAll({
      where: { tenant_id: req.tenantId },
      attributes: publicAttributes,
      order: [['name', 'ASC']]
    });
    res.status(200).json(users);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    if (!req.body.password || String(req.body.password).length < 8) {
      throw new AppError('A password of at least 8 characters is required', 400);
    }
    const values = buildUpdate(req.body);
    if (req.body.branch_id) {
      const assignedBranch = await branch.findOne({ where: { id: req.body.branch_id, tenant_id: req.tenantId, is_active: true } });
      if (!assignedBranch) throw new AppError('Invalid branch', 400);
    }
    const item = await user.create({
      ...values,
      tenant_id: req.tenantId,
      branch_id: req.body.branch_id || req.branchId,
      password_hash: await bcrypt.hash(String(req.body.password), 12),
      role: values.role || 'viewer'
    });
    res.status(201).json(await user.findByPk(item.id, { attributes: publicAttributes }));
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const values = buildUpdate(req.body);
    if (req.params.id === req.user.id && (values.is_active === false || (values.role && !['super_admin', 'admin'].includes(values.role)))) {
      throw new AppError('You cannot remove your own administrator access', 400);
    }
    const [updated] = await user.update(values, { where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!updated) throw new AppError('Not found', 404);
    res.status(200).json(await user.findByPk(req.params.id, { attributes: publicAttributes }));
  } catch (error) { next(error); }
};

exports.deactivate = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) throw new AppError('You cannot deactivate your own account', 400);
    const [updated] = await user.update({ is_active: false }, { where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!updated) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Deactivated successfully' });
  } catch (error) { next(error); }
};
