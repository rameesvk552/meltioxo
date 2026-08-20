const { tenant } = require('../models');
const { AppError } = require('../middleware/errorHandler');

exports.getTenants = async (req, res, next) => {
  try {
    const tenants = await tenant.findAll();
    res.status(200).json(tenants);
  } catch (error) { next(error); }
};

exports.getTenantById = async (req, res, next) => {
  try {
    const item = await tenant.findByPk(req.params.id);
    if (!item) throw new AppError('Not found', 404);
    res.status(200).json(item);
  } catch (error) { next(error); }
};

exports.updateTenantStatus = async (req, res, next) => {
  try {
    const [updated] = await tenant.update(req.body, { where: { id: req.params.id } });
    if (!updated) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Status updated successfully' });
  } catch (error) { next(error); }
};

exports.getStats = async (req, res, next) => {
  try {
    res.status(200).json({ message: 'Stats placeholder' });
  } catch (error) { next(error); }
};
