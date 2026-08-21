const db = require('../models');
const { formula, formulaIngredient, formulaPackaging } = db;
const { AppError } = require('../middleware/errorHandler');

const normalizeOutputUnit = value => String(value || '').trim().toLowerCase();
const isLitreOutput = value => ['l', 'litre', 'litres', 'liter', 'liters'].includes(normalizeOutputUnit(value));
const validateOutputSafety = (outputQuantity, outputUnit, confirmed) => {
  const unit = normalizeOutputUnit(outputUnit);
  if (!['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters', 'l', 'litre', 'litres', 'liter', 'liters'].includes(unit)) {
    throw new AppError('Formula output unit must be millilitres (ml) or litres (L)', 400);
  }
  if (!Number.isFinite(Number(outputQuantity)) || Number(outputQuantity) <= 0) {
    throw new AppError('Formula output quantity must be greater than zero', 400);
  }
  if (isLitreOutput(outputUnit) && confirmed !== true) {
    throw new AppError('Confirm the litre batch size before saving this formula', 400);
  }
};

exports.validateOutputSafety = validateOutputSafety;

exports.getAll = async (req, res, next) => {
  try {
    const formulas = await formula.findAll({
      where: { tenant_id: req.tenantId },
      include: [formulaIngredient, formulaPackaging]
    });
    res.status(200).json(formulas);
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await formula.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, include: [formulaIngredient, formulaPackaging] });
    if (!item) throw new AppError('Not found', 404);
    res.status(200).json(item);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { ingredients = [], packaging = [], confirm_litre_output: confirmedLitreOutput, ...header } = req.body;
    validateOutputSafety(header.output_quantity, header.output_unit, confirmedLitreOutput);
    header.version = Number.parseInt(header.version, 10) || 1;
    if (!header.code?.trim()) {
      const formulaCount = await formula.count({ where: { tenant_id: req.tenantId }, transaction });
      header.code = `FORM-${String(formulaCount + 1).padStart(4, '0')}`;
    }
    const item = await formula.create({ ...header, tenant_id: req.tenantId }, { transaction });
    if (ingredients.length) {
      await formulaIngredient.bulkCreate(ingredients.map(row => ({
        formula_id: item.id,
        raw_material_id: row.raw_material_id,
        quantity: row.quantity,
        unit: row.unit
      })), { transaction });
    }
    if (packaging.length) {
      await formulaPackaging.bulkCreate(packaging.map(row => ({
        formula_id: item.id,
        packaging_material_id: row.packaging_material_id,
        quantity: row.quantity
      })), { transaction });
    }
    await transaction.commit();
    res.status(201).json(item);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.update = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { ingredients, packaging, confirm_litre_output: confirmedLitreOutput, ...header } = req.body;
    if (header.version !== undefined) header.version = Number.parseInt(header.version, 10) || 1;
    const item = await formula.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, transaction });
    if (!item) throw new AppError('Not found', 404);
    const changesRecipe = ['output_quantity', 'output_unit'].some(key => Object.prototype.hasOwnProperty.call(header, key)) || ingredients !== undefined;
    if (changesRecipe) {
      validateOutputSafety(
        header.output_quantity ?? item.output_quantity,
        header.output_unit ?? item.output_unit,
        confirmedLitreOutput
      );
    }
    await item.update(header, { transaction });
    if (ingredients !== undefined) {
      await formulaIngredient.destroy({ where: { formula_id: item.id }, transaction });
      if (ingredients.length) await formulaIngredient.bulkCreate(ingredients.map(row => ({ formula_id: item.id, raw_material_id: row.raw_material_id, quantity: row.quantity, unit: row.unit })), { transaction });
    }
    if (packaging !== undefined) {
      await formulaPackaging.destroy({ where: { formula_id: item.id }, transaction });
      if (packaging.length) await formulaPackaging.bulkCreate(packaging.map(row => ({ formula_id: item.id, packaging_material_id: row.packaging_material_id, quantity: row.quantity })), { transaction });
    }
    await transaction.commit();
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const deleted = await formula.destroy({ where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!deleted) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) { next(error); }
};

exports.clone = async (req, res, next) => {
  try { res.status(201).json({ message: 'Cloned' }); } catch (error) { next(error); }
};

exports.calculateCost = async (req, res, next) => {
  try {
    const item = await formula.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      include: [
        { model: formulaIngredient, include: [db.rawMaterial] },
        { model: formulaPackaging, include: [db.packagingMaterial] }
      ]
    });
    if (!item) throw new AppError('Not found', 404);
    const rawCost = item.formulaIngredients.reduce((sum, row) =>
      sum + Number(row.quantity || 0) * Number(row.rawMaterial?.avg_cost || 0), 0);
    const packagingCost = item.formulaPackagings.reduce((sum, row) =>
      sum + Number(row.quantity || 0) * Number(row.packagingMaterial?.avg_cost || 0), 0);
    const totalCost = rawCost + packagingCost;
    res.json({
      raw_material_cost: rawCost,
      packaging_cost: packagingCost,
      total_cost: totalCost,
      cost_per_output_unit: Number(item.output_quantity) ? totalCost / Number(item.output_quantity) : 0
    });
  } catch (error) { next(error); }
};
