const { branch } = require('../models');
const { AppError } = require('../middleware/errorHandler');

const clean = (body, existing = {}) => ({
  name: String(body.name || '').trim(),
  code: String(body.code || existing.code || '').trim().toUpperCase(),
  address: body.address !== undefined ? body.address : existing.address,
  phone: body.phone !== undefined ? body.phone : existing.phone,
  email: body.email !== undefined ? body.email : existing.email,
  tax_id: body.tax_id !== undefined ? body.tax_id : existing.tax_id
});

exports.getAll = async (req, res, next) => {
  try {
    const where = { tenant_id: req.tenantId, is_active: true };
    if (!['admin', 'super_admin', 'SUPER_ADMIN'].includes(req.user.role) && req.user.branch_id) where.id = req.user.branch_id;
    const rows = await branch.findAll({ where, order: [['is_default', 'DESC'], ['name', 'ASC']] });
    res.json(rows);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const values = clean(req.body);
    if (!values.name || !values.code) throw new AppError('Branch name and code are required', 400);
    const exists = await branch.findOne({ where: { tenant_id: req.tenantId, code: values.code } });
    if (exists) throw new AppError('Branch code already exists', 409);
    const count = await branch.count({ where: { tenant_id: req.tenantId } });
    const created = await branch.create({ ...values, tenant_id: req.tenantId, is_default: count === 0 });
    res.status(201).json(created);
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const item = await branch.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!item) throw new AppError('Branch not found', 404);
    const values = clean(req.body, item);
    if (!values.name || !values.code) throw new AppError('Branch name and code are required', 400);
    const [updated] = await branch.update(values, { where: { id: req.params.id, tenant_id: req.tenantId } });
    res.json(await branch.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } }));
  } catch (error) { next(error); }
};

exports.deactivate = async (req, res, next) => {
  try {
    const item = await branch.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!item) throw new AppError('Branch not found', 404);
    if (item.is_default) throw new AppError('The default branch cannot be deactivated', 400);
    await item.update({ is_active: false });
    res.json({ message: 'Branch deactivated' });
  } catch (error) { next(error); }
};
