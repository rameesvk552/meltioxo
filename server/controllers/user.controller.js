const { user } = require('../models');
const { AppError } = require('../middleware/errorHandler');

exports.getAll = async (req, res, next) => {
  try {
    const users = await user.findAll({ where: { tenant_id: req.tenantId } });
    res.status(200).json(users);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const item = await user.create({ ...req.body, tenant_id: req.tenantId });
    res.status(201).json(item);
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const [updated] = await user.update(req.body, { where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!updated) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) { next(error); }
};

exports.deactivate = async (req, res, next) => {
  try {
    const [updated] = await user.update({ is_active: false }, { where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!updated) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Deactivated successfully' });
  } catch (error) { next(error); }
};
