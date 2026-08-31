const db = require('../models');
const { AppError } = require('../middleware/errorHandler');

const generateVariantSku = async ({ product, tenantId, transaction }) => {
  const base = String(product.code || '').trim();
  if (!base) return null;
  const variants = await db.finishedGood.findAll({ where: { tenant_id: tenantId, product_id: product.id }, attributes: ['sku'], transaction });
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedBase}-(\\d+)$`, 'i');
  let suffix = variants.reduce((highest, variant) => {
    const match = String(variant.sku || '').match(pattern);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;
  let candidate = `${base}-${suffix}`;
  while (await db.finishedGood.findOne({ where: { tenant_id: tenantId, sku: candidate }, attributes: ['id'], transaction })) {
    candidate = `${base}-${++suffix}`;
  }
  return candidate;
};
const SOURCE_TYPES = ['live_make', 'ready_made'];
const MEASUREMENT_SOURCE_TYPES = ['formula', 'raw_material', 'bulk_stock'];
const ALLOWED_UOMS = ['pcs', 'ml', 'L', 'g', 'kg', 'box', 'bottle', 'pack', 'set'];

const validatePackaging = async (tenantId, packaging, transaction) => {
  if (!Array.isArray(packaging)) throw new AppError('Packaging must be a list', 400);
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

const measurementSettings = body => {
  const enabled = body.sell_by_measurement === true;
  if (!enabled) return { sell_by_measurement: false, measurement_unit: null, measurement_price: null, measurement_min_qty: null, measurement_step: null };
  const unit = String(body.measurement_unit || 'ml').trim();
  const price = Number(body.measurement_price);
  if (unit !== 'ml') throw new AppError('Measured perfume products must use millilitres (ml)', 400);
  if (!Number.isFinite(price) || price < 0) throw new AppError('Enter a valid price per ml', 400);
  return { sell_by_measurement: true, measurement_unit: unit, measurement_price: price, measurement_min_qty: null, measurement_step: null };
};

const resolveMeasurementSource = async (tenantId, body, measurement, transaction, existing = null) => {
  if (!measurement.sell_by_measurement) return { measurement_source_type: 'formula', measurement_source_id: null };
  const type = body.measurement_source_type || existing?.measurement_source_type || 'formula';
  if (!MEASUREMENT_SOURCE_TYPES.includes(type)) throw new AppError('Select formula, raw material, or bulk perfume stock as the measured source', 400);
  const sourceId = type === 'raw_material' ? (body.measurement_source_id || existing?.measurement_source_id) : null;
  if (type === 'raw_material') {
    const material = sourceId ? await db.rawMaterial.findOne({ where: { id: sourceId, tenant_id: tenantId }, transaction }) : null;
    if (!material) throw new AppError('Select the raw material that supplies this measured perfume', 400);
    const unit = String(material.unit || '').trim().toLowerCase();
    if (!['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters', 'l', 'litre', 'litres', 'liter', 'liters'].includes(unit)) {
      throw new AppError('The selected raw material must use ml or L as its stock unit', 400);
    }
  }
  return { measurement_source_type: type, measurement_source_id: sourceId };
};

const syncMeasurementItem = async (tenantId, product, settings, transaction) => {
  let item = await db.finishedGood.findOne({ where: { tenant_id: tenantId, product_id: product.id, is_measurement_item: true }, transaction });
  if (!settings.sell_by_measurement) {
    if (item) await item.update({ is_active: false }, { transaction });
    return item;
  }
  if (!item) {
    const sequence = await db.finishedGood.count({ where: { tenant_id: tenantId }, transaction }) + 1;
    item = await db.finishedGood.create({
      tenant_id: tenantId, product_id: product.id, source_type: 'live_make', formula_id: null,
      name: product.name, size_label: null, uom: 'ml', sku: `MEAS-${String(sequence).padStart(4, '0')}`,
      fill_quantity_ml: 1, selling_price: settings.measurement_price, cost_price: 0,
      current_stock: 0, reorder_level: 0, is_measurement_item: true, is_active: true
    }, { transaction });
  } else {
    await item.update({ name: product.name, source_type: 'live_make', formula_id: null, uom: 'ml', fill_quantity_ml: 1, selling_price: settings.measurement_price, is_active: true }, { transaction });
  }
  return item;
};

const productInclude = [
  db.formula,
  { model: db.finishedGood, include: [db.variantPackaging] }
];

exports.getAll = async (req, res, next) => {
  try {
    const items = await db.product.findAll({
      where: { tenant_id: req.tenantId },
      include: productInclude,
      order: [['name', 'ASC']]
    });
    res.json(items);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await db.product.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      include: productInclude
    });
    if (!item) throw new AppError('Product not found', 404);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    if (!String(req.body.name || '').trim()) {
      throw new AppError('Product name is required', 400);
    }
    const measurement = measurementSettings(req.body);
    const measurementSource = await resolveMeasurementSource(req.tenantId, req.body, measurement, transaction);
    const sourceType = measurement.sell_by_measurement ? 'live_make' : req.body.source_type || 'live_make';
    if (!SOURCE_TYPES.includes(sourceType)) throw new AppError('Select Ready-made or Make live for this product', 400);
    const requestedFormulaId = sourceType === 'ready_made' ? null : req.body.formula_id;
    const formula = requestedFormulaId ? await db.formula.findOne({
      where: { id: requestedFormulaId, tenant_id: req.tenantId },
      transaction
    }) : null;
    if (requestedFormulaId && !formula) throw new AppError('Formula not found for this company', 400);
    if (measurement.sell_by_measurement && measurementSource.measurement_source_type !== 'raw_material' && !formula) throw new AppError('Select the formula used by this measured product', 400);
    if (measurement.sell_by_measurement && formula && !['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters', 'l', 'litre', 'litres', 'liter', 'liters'].includes(String(formula.output_unit || '').toLowerCase())) {
      throw new AppError('A measured product needs a formula whose output unit is ml or L', 400);
    }

    const sequence = await db.product.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    const item = await db.product.create({
      tenant_id: req.tenantId,
      code: req.body.code || `PROD-${String(sequence).padStart(4, '0')}`,
      name: req.body.name,
      description: req.body.description,
      source_type: sourceType,
      formula_id: formula?.id || null,
      ...measurement,
      ...measurementSource,
      is_active: req.body.is_active ?? true
    }, { transaction });

    let createdVariant = null;
    if (measurement.sell_by_measurement) {
      createdVariant = await syncMeasurementItem(req.tenantId, item, measurement, transaction);
    } else if (req.body.initial_variants?.length || req.body.initial_variant) {
      const variants = req.body.initial_variants?.length ? req.body.initial_variants : [req.body.initial_variant];
      for (const variant of variants) {
      const packaging = sourceType === 'ready_made' ? [] : (variant.packaging || []);
      await validatePackaging(req.tenantId, packaging, transaction);
      const sizeLabel = String(variant.size_label || '').trim();
      const uom = String(variant.uom || 'pcs').trim();
      const fillQuantity = Number(variant.fill_quantity_ml);
      const prices = [variant.cost_price || 0, variant.selling_price || 0, variant.current_stock || 0, variant.reorder_level || 0].map(Number);
      if (!sizeLabel) throw new AppError('Enter an initial variant label', 400);
      if (!ALLOWED_UOMS.includes(uom)) throw new AppError('Select a valid unit of measure', 400);
      if (sourceType === 'live_make' && !formula) throw new AppError('Select a formula to create the initial live-making variant', 400);
      if (sourceType === 'live_make' && (!Number.isFinite(fillQuantity) || fillQuantity <= 0)) throw new AppError('Fill quantity must be greater than zero', 400);
      if (prices.some(value => !Number.isFinite(value) || value < 0)) throw new AppError('Prices and stock quantities cannot be negative', 400);

      const variantSequence = await db.finishedGood.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
      const requestedSku = String(variant.sku || '').trim();
      if (requestedSku) {
        const duplicateVariant = await db.finishedGood.findOne({ where: { tenant_id: req.tenantId, sku: requestedSku }, transaction });
        if (duplicateVariant) throw new AppError('That SKU is already in use', 400);
      }
      const generatedSku = requestedSku || await generateVariantSku({ product: item, tenantId: req.tenantId, transaction });
      createdVariant = await db.finishedGood.create({
        tenant_id: req.tenantId,
        product_id: item.id,
        source_type: sourceType,
        formula_id: null,
        name: String(variant.name || '').trim() || `${item.name} ${sizeLabel}`,
        size_label: sizeLabel,
        uom,
        sku: generatedSku || `FG-${String(variantSequence).padStart(4, '0')}`,
        fill_quantity_ml: sourceType === 'ready_made' ? null : fillQuantity,
        cost_price: prices[0],
        selling_price: prices[1],
        current_stock: prices[2],
        reorder_level: prices[3],
        is_active: true
      }, { transaction });

      if (packaging.length) {
        await db.variantPackaging.bulkCreate(packaging.map(row => ({
          finished_good_id: createdVariant.id,
          packaging_material_id: row.packaging_material_id,
          quantity: Number(row.quantity)
        })), { transaction });
      }

      if (prices[2] > 0) {
        const batch = await db.stockBatch.create({
          tenant_id: req.tenantId, material_type: 'finished', material_id: createdVariant.id,
          batch_number: `OPEN-${createdVariant.sku}`, quantity: prices[2], remaining_qty: prices[2],
          cost_per_unit: prices[0], received_date: new Date()
        }, { transaction });
        await db.stockMovement.create({
          tenant_id: req.tenantId, material_type: 'finished', material_id: createdVariant.id,
          movement_type: 'adjustment', direction: 'in', quantity: prices[2], batch_id: batch.id,
          unit_cost: prices[0], total_cost: prices[2] * prices[0], reference_type: 'opening_stock',
          reference_id: createdVariant.id, notes: 'Opening finished-product stock', created_by: req.user.id
        }, { transaction });
      }
      }
    }

    await transaction.commit();
    res.status(201).json({ ...item.toJSON(), initial_variant: createdVariant?.toJSON() || null });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.update = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const product = await db.product.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, transaction });
    if (!product) throw new AppError('Product not found', 404);
    const previousFormulaId = product.formula_id;
    const measurement = measurementSettings({
      sell_by_measurement: Object.prototype.hasOwnProperty.call(req.body, 'sell_by_measurement') ? req.body.sell_by_measurement : product.sell_by_measurement,
      measurement_unit: req.body.measurement_unit ?? product.measurement_unit,
      measurement_price: req.body.measurement_price ?? product.measurement_price
    });
    const measurementSource = await resolveMeasurementSource(req.tenantId, req.body, measurement, transaction, product);
    const sourceType = measurement.sell_by_measurement ? 'live_make' : req.body.source_type || product.source_type || 'live_make';
    if (!SOURCE_TYPES.includes(sourceType)) throw new AppError('Select Ready-made or Make live for this product', 400);
    const requestedFormulaId = sourceType === 'ready_made' ? null : req.body.formula_id;
    let selectedFormula = null;
    if (requestedFormulaId) {
      selectedFormula = await db.formula.findOne({
        where: { id: requestedFormulaId, tenant_id: req.tenantId },
        transaction
      });
      if (!selectedFormula) throw new AppError('Formula not found for this company', 400);
    }
    if (measurement.sell_by_measurement && measurementSource.measurement_source_type !== 'raw_material' && !requestedFormulaId) throw new AppError('Select the formula used by this measured product', 400);
    if (measurement.sell_by_measurement && selectedFormula && !['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters', 'l', 'litre', 'litres', 'liter', 'liters'].includes(String(selectedFormula.output_unit || '').toLowerCase())) {
      throw new AppError('A measured product needs a formula whose output unit is ml or L', 400);
    }
    if (measurement.sell_by_measurement && !product.sell_by_measurement) {
      const regularVariants = await db.finishedGood.count({ where: { product_id: product.id, tenant_id: req.tenantId, is_measurement_item: false }, transaction });
      if (regularVariants) throw new AppError('A product with variants cannot be changed to Sell by measurement. Create a separate measured product.', 409);
    }

    const { initial_variant: _ignoredInitialVariant, ...bodyUpdates } = req.body;
    const updates = { ...bodyUpdates, ...measurement, ...measurementSource, source_type: sourceType };
    if (sourceType === 'ready_made') updates.formula_id = null;
    await product.update(updates, { transaction });
    await syncMeasurementItem(req.tenantId, product, measurement, transaction);

    if (req.body.formula_id) {
      const { Op } = db.Sequelize;
      await db.finishedGood.update(
        { formula_id: null },
        { where: { product_id: req.params.id, tenant_id: req.tenantId, formula_id: { [Op.in]: [previousFormulaId, req.body.formula_id] } }, transaction }
      );
    }

    await transaction.commit();
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const product = await db.product.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!product) throw new AppError('Product not found', 404);

    const variants = await db.finishedGood.findAll({
      where: { product_id: product.id, tenant_id: req.tenantId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    for (const variant of variants) {
      if (Math.abs(Number(variant.current_stock || 0)) > 0.0001) {
        throw new AppError(`Cannot delete this product because ${variant.name || 'one of its variants'} has stock. Reduce the stock to zero first.`, 409);
      }

      const usageChecks = await Promise.all([
        db.retailSaleItem.count({ where: { finished_good_id: variant.id }, transaction }),
        db.salesOrderItem.count({ where: { finished_good_id: variant.id }, transaction }),
        db.purchaseOrderItem.count({ where: { material_type: 'finished', material_id: variant.id }, transaction }),
        db.purchaseReceiptItem.count({ where: { material_type: 'finished', material_id: variant.id }, transaction }),
        db.productionOrder.count({ where: { finished_good_id: variant.id }, transaction }),
        db.productionOutput.count({ where: { finished_good_id: variant.id }, transaction }),
        db.stockBatch.count({ where: { tenant_id: req.tenantId, material_type: 'finished', material_id: variant.id }, transaction }),
        db.stockMovement.count({ where: { tenant_id: req.tenantId, material_type: 'finished', material_id: variant.id }, transaction })
      ]);
      const labels = ['retail sales', 'sales orders', 'purchases', 'purchase receipts', 'production orders', 'production outputs', 'stock batches', 'stock movements'];
      const usedBy = labels.filter((_, index) => usageChecks[index] > 0);
      if (usedBy.length) {
        throw new AppError(`Cannot delete this product because ${variant.name || 'one of its variants'} is used in ${usedBy.join(', ')}.`, 409);
      }
    }

    for (const variant of variants) {
      await db.variantPackaging.destroy({ where: { finished_good_id: variant.id }, transaction });
      await variant.destroy({ transaction });
    }

    await product.destroy({ transaction });
    await transaction.commit();
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
