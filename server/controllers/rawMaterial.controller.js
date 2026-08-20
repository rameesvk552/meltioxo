const { rawMaterial, stockBatch, stockMovement } = require('../models');
const { AppError } = require('../middleware/errorHandler');

exports.getAll = async (req, res, next) => {
  try {
    const materials = await rawMaterial.findAll({ where: { tenant_id: req.tenantId } });
    res.status(200).json(materials);
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const material = await rawMaterial.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, include: [stockBatch, stockMovement] });
    if (!material) throw new AppError('Not found', 404);
    res.status(200).json(material);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const sequence = await rawMaterial.count({ where: { tenant_id: req.tenantId } }) + 1;
    const material = await rawMaterial.create({
      ...req.body,
      sku: req.body.sku || `RM-${String(sequence).padStart(4, '0')}`,
      tenant_id: req.tenantId
    });
    res.status(201).json(material);
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const [updated] = await rawMaterial.update(req.body, { where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!updated) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) { next(error); }
};

exports.delete = async (req, res, next) => {
  try {
    const deleted = await rawMaterial.destroy({ where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!deleted) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) { next(error); }
};

exports.getLedger = async (req, res, next) => {
  try {
    const movements = await stockMovement.findAll({ where: { material_id: req.params.id, tenant_id: req.tenantId } });
    res.status(200).json(movements);
  } catch (error) { next(error); }
};

exports.adjustStock = async (req, res, next) => {
  try {
    res.status(200).json({ message: 'Stock adjusted' });
  } catch (error) { next(error); }
};

exports.getLowStock = async (req, res, next) => {
  try {
    res.status(200).json({ message: 'Low stock' });
  } catch (error) { next(error); }
};
