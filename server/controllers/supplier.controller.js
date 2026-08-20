const { supplier, purchaseOrder } = require('../models');
const { AppError } = require('../middleware/errorHandler');

exports.getAll = async (req, res, next) => {
  try {
    const suppliers = await supplier.findAll({ where: { tenant_id: req.tenantId } });
    res.status(200).json(suppliers);
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await supplier.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, include: [purchaseOrder] });
    if (!item) throw new AppError('Not found', 404);
    res.status(200).json(item);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const item = await supplier.create({ ...req.body, tenant_id: req.tenantId });
    res.status(201).json(item);
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const [updated] = await supplier.update(req.body, { where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!updated) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) { next(error); }
};

exports.delete = async (req, res, next) => {
  try {
    const deleted = await supplier.destroy({ where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!deleted) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) { next(error); }
};
