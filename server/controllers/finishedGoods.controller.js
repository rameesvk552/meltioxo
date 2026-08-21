const db = require('../models');
const { finishedGood } = db;
const { AppError } = require('../middleware/errorHandler');

const SOURCE_TYPES = ['live_make', 'ready_made'];

const validateConfiguration = async ({ tenantId, product, sourceType, formulaId, fillQuantity, transaction }) => {
  if (!SOURCE_TYPES.includes(sourceType)) throw new AppError('Select Ready-made or Make live for this variant', 400);
  if (sourceType === 'ready_made') {
    const numericFill = Number(fillQuantity);
    return { formulaId: null, fillQuantity: Number.isFinite(numericFill) && numericFill > 0 ? numericFill : null };
  }

  const effectiveFormulaId = formulaId || product.formula_id;
  if (!effectiveFormulaId) throw new AppError('A live-making variant requires an active formula', 400);
  const formula = await db.formula.findOne({ where: { id: effectiveFormulaId, tenant_id: tenantId, is_active: true }, transaction });
  if (!formula) throw new AppError('A live-making variant requires an active formula', 400);
  const numericFill = Number(fillQuantity);
  if (!Number.isFinite(numericFill) || numericFill <= 0) throw new AppError('Fill quantity must be greater than zero for live making', 400);
  return { formulaId: formulaId === product.formula_id ? null : formulaId || null, fillQuantity: numericFill };
};

const validatePackaging = async (tenantId, packaging, transaction) => {
  const materialIds = packaging.map(row => row.packaging_material_id);
  if (materialIds.some(id => !id) || packaging.some(row => Number(row.quantity) <= 0)) {
    throw new AppError('Every packaging item requires a material and a positive quantity', 400);
  }
  if (new Set(materialIds).size !== materialIds.length) throw new AppError('A packaging material can only appear once in a variant BOM', 400);
  if (materialIds.length) {
    const validMaterials = await db.packagingMaterial.count({ where: { id: materialIds, tenant_id: tenantId }, transaction });
    if (validMaterials !== materialIds.length) throw new AppError('One or more packaging materials are invalid', 400);
  }
};

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

exports.createReadyMade = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const productId = req.body.product_id || null;
    const productName = String(req.body.product_name || '').trim();
    const productCode = String(req.body.product_code || '').trim() || null;
    const sizeLabel = String(req.body.size_label || '').trim();
    const sku = String(req.body.sku || '').trim() || null;
    const displayName = String(req.body.name || '').trim() || null;
    const costPrice = Number(req.body.cost_price || 0);
    const sellingPrice = Number(req.body.selling_price || 0);
    const reorderLevel = Number(req.body.reorder_level || 0);

    if (!productId && !productName) throw new AppError('Enter a product name', 400);
    if (!sizeLabel) throw new AppError('Enter a variant label', 400);
    if (![costPrice, sellingPrice, reorderLevel].every(Number.isFinite) || [costPrice, sellingPrice, reorderLevel].some(value => value < 0)) {
      throw new AppError('Prices and reorder level cannot be negative', 400);
    }

    let product;
    if (productId) {
      product = await db.product.findOne({ where: { id: productId, tenant_id: req.tenantId, is_active: true }, transaction });
      if (!product) throw new AppError('Select an active product', 400);
    } else {
      if (productCode) {
        const duplicateProduct = await db.product.findOne({ where: { tenant_id: req.tenantId, code: productCode }, transaction });
        if (duplicateProduct) throw new AppError('That product code is already in use', 400);
      }
      const productSequence = await db.product.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
      product = await db.product.create({
        tenant_id: req.tenantId,
        code: productCode || `PROD-${String(productSequence).padStart(4, '0')}`,
        name: productName,
        source_type: 'ready_made',
        formula_id: null,
        is_active: true
      }, { transaction });
    }

    if (sku) {
      const duplicateVariant = await finishedGood.findOne({ where: { tenant_id: req.tenantId, sku }, transaction });
      if (duplicateVariant) throw new AppError('That SKU is already in use', 400);
    }
    const variantSequence = await finishedGood.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    const item = await finishedGood.create({
      tenant_id: req.tenantId,
      product_id: product.id,
      source_type: 'ready_made',
      formula_id: null,
      name: displayName || `${product.name} ${sizeLabel}`,
      size_label: sizeLabel,
      sku: sku || `FG-${String(variantSequence).padStart(4, '0')}`,
      fill_quantity_ml: null,
      cost_price: costPrice,
      selling_price: sellingPrice,
      current_stock: 0,
      reorder_level: reorderLevel,
      is_active: true
    }, { transaction });

    await transaction.commit();
    res.status(201).json({ ...item.toJSON(), product: product.toJSON() });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
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

    const sourceType = variantData.source_type || 'live_make';
    const configuration = await validateConfiguration({ tenantId: req.tenantId, product, sourceType, formulaId: variantData.formula_id || null, fillQuantity: variantData.fill_quantity_ml, transaction });
    const variantPackaging = sourceType === 'ready_made' ? [] : packaging;
    await validatePackaging(req.tenantId, variantPackaging, transaction);

    const sequence = await finishedGood.count({
      where: { tenant_id: req.tenantId },
      transaction
    }) + 1;
    const item = await finishedGood.create({
      ...variantData,
      source_type: sourceType,
      name: variantData.name || `${product.name} ${variantData.size_label || (configuration.fillQuantity ? `${configuration.fillQuantity}ml` : 'Standard')}`,
      formula_id: configuration.formulaId,
      fill_quantity_ml: configuration.fillQuantity,
      sku: variantData.sku || `FG-${String(sequence).padStart(4, '0')}`,
      tenant_id: req.tenantId
    }, { transaction });

    if (variantPackaging.length) {
      await db.variantPackaging.bulkCreate(variantPackaging.map(row => ({
        finished_good_id: item.id,
        packaging_material_id: row.packaging_material_id,
        quantity: Number(row.quantity)
      })), { transaction });
    }

    const openingStock = Number(item.current_stock || 0);
    if (openingStock > 0) {
      const batch = await db.stockBatch.create({
        tenant_id: req.tenantId,
        material_type: 'finished',
        material_id: item.id,
        batch_number: `OPEN-${item.sku}`,
        quantity: openingStock,
        remaining_qty: openingStock,
        cost_per_unit: Number(item.cost_price || 0),
        received_date: new Date()
      }, { transaction });
      await db.stockMovement.create({ tenant_id: req.tenantId, material_type: 'finished', material_id: item.id, movement_type: 'adjustment', direction: 'in', quantity: openingStock, batch_id: batch.id, unit_cost: Number(item.cost_price || 0), total_cost: openingStock * Number(item.cost_price || 0), reference_type: 'opening_stock', reference_id: item.id, notes: 'Opening finished-product stock', created_by: req.user.id }, { transaction });
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
    const sourceType = variantData.source_type || item.source_type || 'live_make';
    if (sourceType !== item.source_type && Number(item.current_stock || 0) > 0) {
      throw new AppError('Reduce this variant stock to zero before changing how it is supplied', 400);
    }
    const configuration = await validateConfiguration({
      tenantId: req.tenantId,
      product,
      sourceType,
      formulaId: Object.prototype.hasOwnProperty.call(variantData, 'formula_id') ? variantData.formula_id : item.formula_id,
      fillQuantity: Object.prototype.hasOwnProperty.call(variantData, 'fill_quantity_ml') ? variantData.fill_quantity_ml : item.fill_quantity_ml,
      transaction
    });
    variantData.source_type = sourceType;
    variantData.formula_id = configuration.formulaId;
    variantData.fill_quantity_ml = configuration.fillQuantity;
    await item.update(variantData, { transaction });

    const nextPackaging = sourceType === 'ready_made' ? [] : packaging;
    if (Array.isArray(nextPackaging)) {
      await validatePackaging(req.tenantId, nextPackaging, transaction);
      await db.variantPackaging.destroy({
        where: { finished_good_id: item.id },
        transaction
      });
      if (nextPackaging.length) {
        await db.variantPackaging.bulkCreate(nextPackaging.map(row => ({
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
