const { rawMaterial, stockBatch, stockMovement, formulaIngredient } = require('../models');
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
    const requestedSku = String(req.body.sku || '').trim();
    let sku = requestedSku || null;
    if (!sku) {
      let sequence = await rawMaterial.count({ where: { tenant_id: req.tenantId } }) + 1;
      do {
        sku = `RM-${String(sequence).padStart(4, '0')}`;
        sequence += 1;
      } while (await rawMaterial.findOne({ where: { tenant_id: req.tenantId, sku } }));
    } else {
      const duplicate = await rawMaterial.findOne({ where: { tenant_id: req.tenantId, sku } });
      if (duplicate) throw new AppError(`SKU ${sku} is already in use. Choose a different SKU.`, 409);
    }
    const material = await rawMaterial.create({
      ...req.body,
      sku,
      tenant_id: req.tenantId
    });
    res.status(201).json(material);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return next(new AppError('That SKU is already in use. Choose a different SKU.', 409));
    }
    next(error);
  }
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
    const formulaCount = await formulaIngredient.count({ where: { raw_material_id: req.params.id } });
    if (formulaCount) throw new AppError(`Remove this raw material from ${formulaCount} formula ingredient(s) before deleting it.`, 409);
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
