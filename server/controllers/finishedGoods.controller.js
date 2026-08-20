const db = require('../models');
const { finishedGood } = db;
const { AppError } = require('../middleware/errorHandler');

exports.getAll = async (req, res, next) => {
  try {
    const items = await finishedGood.findAll({
      where: { tenant_id: req.tenantId },
      include: [
        { model: db.product, include: [db.formula] },
        db.formula,
        { model: db.variantPackaging, include: [db.packagingMaterial] }
      ],
      order: [['name', 'ASC']]
    });
    res.status(200).json(items);
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await finishedGood.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      include: [
        { model: db.product, include: [db.formula] },
        db.formula,
        { model: db.variantPackaging, include: [db.packagingMaterial] }
      ]
    });
    if (!item) throw new AppError('Not found', 404);
    res.status(200).json(item);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { packaging = [], ...variantData } = req.body;
    const product = await db.product.findOne({
      where: { id: variantData.product_id, tenant_id: req.tenantId },
      transaction
    });
    if (!product) throw new AppError('Select a valid product for this variant', 400);

    let formulaId = variantData.formula_id || null;
    if (formulaId) {
      const formula = await db.formula.findOne({ where: { id: formulaId, tenant_id: req.tenantId, is_active: true }, transaction });
      if (!formula) throw new AppError('Select a valid active formula override', 400);
      if (formulaId === product.formula_id) formulaId = null;
    }

    const fillQuantity = Number(variantData.fill_quantity_ml);
    if (!Number.isFinite(fillQuantity) || fillQuantity <= 0) {
      throw new AppError('Fill quantity must be greater than zero', 400);
    }

    const sequence = await finishedGood.count({
      where: { tenant_id: req.tenantId },
      transaction
    }) + 1;
    const item = await finishedGood.create({
      ...variantData,
      name: variantData.name || `${product.name} ${variantData.size_label || `${fillQuantity}ml`}`,
      formula_id: formulaId,
      sku: variantData.sku || `FG-${String(sequence).padStart(4, '0')}`,
      tenant_id: req.tenantId
    }, { transaction });

    if (packaging.length) {
      const materialIds = packaging.map(row => row.packaging_material_id);
      if (materialIds.some(id => !id) || packaging.some(row => Number(row.quantity) <= 0)) {
        throw new AppError('Every packaging item requires a material and a positive quantity', 400);
      }
      if (new Set(materialIds).size !== materialIds.length) {
        throw new AppError('A packaging material can only appear once in a variant BOM', 400);
      }
      const validMaterials = await db.packagingMaterial.count({
        where: { id: materialIds, tenant_id: req.tenantId },
        transaction
      });
      if (validMaterials !== new Set(materialIds).size) {
        throw new AppError('One or more packaging materials are invalid', 400);
      }
      await db.variantPackaging.bulkCreate(packaging.map(row => ({
        finished_good_id: item.id,
        packaging_material_id: row.packaging_material_id,
        quantity: Number(row.quantity)
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
    const { packaging, ...variantData } = req.body;
    const item = await finishedGood.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      transaction
    });
    if (!item) throw new AppError('Not found', 404);
    const productId = variantData.product_id || item.product_id;
    const product = await db.product.findOne({ where: { id: productId, tenant_id: req.tenantId }, transaction });
    if (!product) throw new AppError('Select a valid product for this variant', 400);
    if (Object.prototype.hasOwnProperty.call(variantData, 'formula_id')) {
      if (variantData.formula_id) {
        const formula = await db.formula.findOne({ where: { id: variantData.formula_id, tenant_id: req.tenantId, is_active: true }, transaction });
        if (!formula) throw new AppError('Select a valid active formula override', 400);
      }
      if (variantData.formula_id === product.formula_id) variantData.formula_id = null;
    }
    await item.update(variantData, { transaction });

    if (Array.isArray(packaging)) {
      const materialIds = packaging.map(row => row.packaging_material_id);
      if (materialIds.some(id => !id) || packaging.some(row => Number(row.quantity) <= 0)) {
        throw new AppError('Every packaging item requires a material and a positive quantity', 400);
      }
      if (new Set(materialIds).size !== materialIds.length) {
        throw new AppError('A packaging material can only appear once in a variant BOM', 400);
      }
      await db.variantPackaging.destroy({
        where: { finished_good_id: item.id },
        transaction
      });
      if (packaging.length) {
        await db.variantPackaging.bulkCreate(packaging.map(row => ({
          finished_good_id: item.id,
          packaging_material_id: row.packaging_material_id,
          quantity: Number(row.quantity)
        })), { transaction });
      }
    }

    await transaction.commit();
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
