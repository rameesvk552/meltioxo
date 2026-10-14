const { rawMaterial, stockBatch, stockMovement, formulaIngredient, rawMaterialMix, tenant } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const mixService = require('../services/rawMaterialMix.service');

exports.getMixes = async (req, res, next) => {
  try {
    const settings = await tenant.findByPk(req.tenantId);
    if (!settings?.raw_material_mixing_enabled) throw new AppError('Enable raw material mixing in Company Settings first', 403);
    const mixes = await rawMaterialMix.findAll({ where: { tenant_id: req.tenantId }, order: [['created_at', 'DESC']], limit: 100 });
    res.status(200).json(mixes);
  } catch (error) { next(error); }
};

exports.createMix = async (req, res, next) => {
  try {
    const requestKey = req.get('Idempotency-Key') || null;
    if (requestKey && requestKey.length > 100) throw new AppError('Idempotency key is too long', 400);
    const result = await mixService.createMix({
      tenantId: req.tenantId, branchId: req.branchId, userId: req.user.id,
      requestKey, data: req.body
    });
    res.status(result.repeated ? 200 : 201).json(result);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return next(new AppError('This mix or material SKU already exists. Refresh and try again.', 409));
    next(error);
  }
};

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
    const mixMovementCount = await stockMovement.count({ where: { tenant_id: req.tenantId, material_type: 'raw', material_id: req.params.id, reference_type: 'raw_material_mix' } });
    if (mixMovementCount) throw new AppError('This material has mixing history and cannot be deleted.', 409);
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
