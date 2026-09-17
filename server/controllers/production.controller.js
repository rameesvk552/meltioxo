const db = require('../models');
const { productionOrder, productionMaterial, productionOutput } = db;
const { AppError } = require('../middleware/errorHandler');
const productionService = require('../services/production.service');

const ensureStandardFinishedGood = async ({ product, tenantId, transaction }) => {
  const existing = await db.finishedGood.findOne({ where: { tenant_id: tenantId, product_id: product.id, is_measurement_item: false }, transaction });
  if (existing) return existing;
  const baseSku = `${product.code}-STD`;
  const duplicateSku = await db.finishedGood.findOne({ where: { tenant_id: tenantId, sku: baseSku }, transaction });
  return db.finishedGood.create({
    tenant_id: tenantId, product_id: product.id, source_type: product.source_type || 'live_make', formula_id: null,
    name: product.name, size_label: 'Standard', uom: 'pcs',
    fill_quantity_ml: product.source_type === 'ready_made' ? null : 1,
    sku: duplicateSku ? `${baseSku}-${String(product.id).slice(0, 6)}` : baseSku,
    selling_price: 0, cost_price: 0, current_stock: 0, reorder_level: 0, is_measurement_item: false, is_active: true
  }, { transaction });
};

exports.getAll = async (req, res, next) => {
  try {
    const items = await productionOrder.findAll({
      where: { tenant_id: req.tenantId },
      include: [
        db.formula, db.retailSale, { model: productionOutput, include: [db.finishedGood] },
        { model: db.finishedGood, include: [db.product] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json(items);
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await productionOrder.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      include: [
        productionMaterial, { model: productionOutput, include: [db.finishedGood] },
        db.formula, db.retailSale, db.inventoryDeficit,
        { model: db.finishedGood, include: [db.product] }
      ]
    });
    if (!item) throw new AppError('Not found', 404);
    // Production materials are polymorphic (raw material or packaging), so
    // Sequelize cannot add one simple belongsTo include. Resolve the display
    // details here instead of making the client show the stored UUID.
    const data = item.toJSON();
    // Available stock changes after an order is created (for example, when a
    // purchase is received).  Requirements remain the order's saved snapshot,
    // but availability must always be checked against live inventory.
    const liveAvailability = await productionService.checkAvailability(req.tenantId, data.productionMaterials);
    const availabilityByMaterial = new Map(liveAvailability.map(row => [
      `${row.material_type}:${row.material_id}`,
      row
    ]));
    const rawIds = data.productionMaterials
      .filter(row => row.material_type === 'raw')
      .map(row => row.material_id);
    const packagingIds = data.productionMaterials
      .filter(row => row.material_type === 'packaging')
      .map(row => row.material_id);
    const [rawMaterials, packagingMaterials] = await Promise.all([
      rawIds.length ? db.rawMaterial.findAll({ where: { id: rawIds, tenant_id: req.tenantId }, attributes: ['id', 'name', 'unit'] }) : [],
      packagingIds.length ? db.packagingMaterial.findAll({ where: { id: packagingIds, tenant_id: req.tenantId }, attributes: ['id', 'name'] }) : []
    ]);
    const materialDetails = new Map([
      ...rawMaterials.map(row => [row.id, { name: row.name, unit: row.unit || 'units' }]),
      ...packagingMaterials.map(row => [row.id, { name: row.name, unit: 'pcs' }])
    ]);
    data.productionMaterials = data.productionMaterials.map(row => ({
      ...row,
      available_qty: availabilityByMaterial.get(`${row.material_type}:${row.material_id}`)?.current_stock ?? row.available_qty,
      is_available: availabilityByMaterial.get(`${row.material_type}:${row.material_id}`)?.is_available ?? row.is_available,
      material_name: materialDetails.get(row.material_id)?.name || 'Material not found',
      material_unit: materialDetails.get(row.material_id)?.unit || (row.material_type === 'packaging' ? 'pcs' : 'units')
    }));
    res.status(200).json(data);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const requestedOutputs = Array.isArray(req.body.outputs) && req.body.outputs.length
      ? req.body.outputs : [{ finished_good_id: req.body.finished_good_id, planned_qty: req.body.planned_qty }];
    const outputSpecs = [];
    for (const row of requestedOutputs) {
      let finishedGoodId = row.finished_good_id;
      if (!finishedGoodId && row.product_id) {
        const product = await db.product.findOne({ where: { id: row.product_id, tenant_id: req.tenantId, is_active: true }, transaction });
        if (!product) throw new AppError('Select an active product', 400);
        finishedGoodId = (await ensureStandardFinishedGood({ product, tenantId: req.tenantId, transaction })).id;
      }
      outputSpecs.push({ finished_good_id: finishedGoodId, planned_qty: Number(row.planned_qty) });
    }
    if (outputSpecs.some(row => !row.finished_good_id || !Number.isFinite(row.planned_qty) || row.planned_qty <= 0)) throw new AppError('Every product needs a planned quantity greater than zero', 400);
    if (new Set(outputSpecs.map(row => row.finished_good_id)).size !== outputSpecs.length) throw new AppError('Add each variant only once', 400);

    const variant = await db.finishedGood.findOne({
      where: {
        id: outputSpecs[0].finished_good_id,
        tenant_id: req.tenantId,
        is_active: true
      },
      include: [db.product],
      transaction
    });
    if (!variant || !variant.product || !variant.product.is_active) {
      throw new AppError('Select an active product variant', 400);
    }
    if (variant.source_type === 'ready_made') {
      throw new AppError('Ready-made variants must be purchased and cannot be sent to production', 400);
    }

    const formulaId = variant.formula_id || variant.product.formula_id;
    const formula = await db.formula.findOne({
      where: { id: formulaId, tenant_id: req.tenantId, is_active: true },
      transaction
    });
    if (!formula) throw new AppError('The selected product does not have an active formula', 400);

    const sequence = await productionOrder.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    const variants = await db.finishedGood.findAll({
      where: { id: outputSpecs.map(row => row.finished_good_id), tenant_id: req.tenantId, is_active: true },
      include: [db.product], transaction
    });
    if (variants.length !== outputSpecs.length || variants.some(row => row.source_type === 'ready_made' || !row.product || !row.product.is_active || (row.formula_id || row.product.formula_id) !== formulaId)) {
      throw new AppError('All variants must be active and use the same product formula', 400);
    }
    const item = await productionOrder.create({
      ...req.body,
      tenant_id: req.tenantId,
      formula_id: formulaId,
      finished_good_id: variant.id,
      planned_qty: outputSpecs.reduce((sum, row) => sum + row.planned_qty, 0),
      order_number: req.body.order_number || `PROD-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`
    }, { transaction });
    await productionOutput.bulkCreate(outputSpecs.map(row => ({ ...row, production_order_id: item.id })), { transaction });
    const requirementRows = await Promise.all(outputSpecs.map(row => {
      const outputVariant = variants.find(candidate => candidate.id === row.finished_good_id);
      return productionService.calculateMaterialRequirements(req.tenantId, item.formula_id, row.planned_qty, row.finished_good_id, transaction, { excludePackaging: Boolean(outputVariant?.is_measurement_item) });
    }));
    const requirements = productionService.combineMaterialRequirements(requirementRows.flat());
    const availability = await productionService.checkAvailability(req.tenantId, requirements);
    if (availability.length) {
      await productionMaterial.bulkCreate(availability.map(row => ({
        production_order_id: item.id,
        material_type: row.material_type,
        material_id: row.material_id,
        required_qty: row.required_qty,
        available_qty: row.current_stock,
        is_available: row.is_available
      })), { transaction });
    }
    const result = await productionOrder.findByPk(item.id, { 
      include: [{ model: productionOutput, include: [db.finishedGood] }], 
      transaction 
    });
    await transaction.commit();
    res.status(201).json(result);
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

exports.start = async (req, res, next) => {
  try {
    const [updated] = await productionOrder.update(
      { status: 'in_progress', start_date: new Date() },
      { where: { id: req.params.id, tenant_id: req.tenantId, status: 'planned' } }
    );
    if (!updated) throw new AppError('Production order cannot be started', 400);
    res.json({ message: 'Started' });
  } catch (error) { next(error); }
};

exports.complete = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const item = await productionService.completeProduction(
      req.tenantId, req.params.id, Array.isArray(req.body.actual_qty) ? req.body.actual_qty : Number(req.body.actual_qty), transaction
    );
    await transaction.commit();
    res.json(item);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.availability = async (req, res, next) => {
  try {
    const materials = await productionMaterial.findAll({
      where: { production_order_id: req.params.id },
      attributes: ['material_type', 'material_id', 'required_qty']
    });
    const availability = await productionService.checkAvailability(req.tenantId, materials);
    res.json(availability);
  } catch (error) { next(error); }
};

exports.cancel = async (req, res, next) => {
  try {
    const [updated] = await productionOrder.update(
      { status: 'cancelled' },
      { where: { id: req.params.id, tenant_id: req.tenantId } }
    );
    if (!updated) throw new AppError('Not found', 404);
    res.json({ message: 'Cancelled' });
  } catch (error) { next(error); }
};
