const db = require('../models');
const accounting = require('./accounting.service');
const { AppError } = require('../middleware/errorHandler');

const calculateFormulaOutput = (formula, variant, plannedUnits) => {
  const outputUnit = String(formula.output_unit || '').trim().toLowerCase();
  const fillQuantityMl = Number(variant.fill_quantity_ml);

  if (['pcs', 'pc', 'unit', 'units'].includes(outputUnit)) {
    return plannedUnits;
  }
  if (!Number.isFinite(fillQuantityMl) || fillQuantityMl <= 0) {
    throw new Error('The selected variant requires a valid fill quantity in millilitres');
  }
  if (['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'].includes(outputUnit)) {
    return plannedUnits * fillQuantityMl;
  }
  if (['l', 'litre', 'litres', 'liter', 'liters'].includes(outputUnit)) {
    return (plannedUnits * fillQuantityMl) / 1000;
  }

  throw new Error(`Formula output unit "${formula.output_unit}" cannot be converted from a perfume variant fill quantity`);
};

exports.calculateFormulaOutput = calculateFormulaOutput;

exports.resolveVariantFormulaId = (variant) => variant.formula_id || variant.product?.formula_id;

exports.calculateMaterialRequirements = async (tenantId, formulaId, plannedUnits, finishedGoodId, transaction) => {
  const formula = await db.formula.findOne({
    where: { id: formulaId, tenant_id: tenantId },
    include: [db.formulaIngredient, db.formulaPackaging],
    transaction
  });

  if (!formula) throw new Error('Formula not found');

  const variant = await db.finishedGood.findOne({
    where: { id: finishedGoodId, tenant_id: tenantId },
    include: [db.variantPackaging],
    transaction
  });
  if (!variant) throw new Error('Finished-good variant not found');

  const requiredFormulaOutput = calculateFormulaOutput(formula, variant, plannedUnits);
  const formulaOutput = Number(formula.output_quantity);
  if (!Number.isFinite(formulaOutput) || formulaOutput <= 0) {
    throw new Error('Formula output quantity must be greater than zero');
  }

  const ratio = requiredFormulaOutput / formulaOutput;
  const requirements = [];

  formula.formulaIngredients.forEach(ing => {
    requirements.push({
      material_type: 'raw',
      material_id: ing.raw_material_id,
      required_qty: parseFloat(ing.quantity) * ratio
    });
  });

  if (variant.variantPackagings.length) {
    variant.variantPackagings.forEach(pkg => {
      requirements.push({
        material_type: 'packaging',
        material_id: pkg.packaging_material_id,
        required_qty: parseFloat(pkg.quantity) * plannedUnits
      });
    });
  } else {
    // Preserve legacy formulas that stored packaging at formula level.
    formula.formulaPackagings.forEach(pkg => {
      requirements.push({
        material_type: 'packaging',
        material_id: pkg.packaging_material_id,
        required_qty: parseFloat(pkg.quantity) * ratio
      });
    });
  }

  return requirements;
};

exports.checkAvailability = async (tenantId, requirements, transaction) => {
  const result = [];
  for (const req of requirements) {
    const Model = req.material_type === 'raw' ? db.rawMaterial : db.packagingMaterial;
    const item = await Model.findOne({ where: { id: req.material_id, tenant_id: tenantId }, transaction });
    result.push({
      ...req,
      current_stock: item ? parseFloat(item.current_stock) : 0,
      is_available: item ? parseFloat(item.current_stock) >= req.required_qty : false
    });
  }
  return result;
};

exports.combineMaterialRequirements = (requirements) => Object.values(requirements.reduce((combined, row) => {
  const key = `${row.material_type}:${row.material_id}`;
  if (!combined[key]) combined[key] = { ...row };
  else combined[key].required_qty += Number(row.required_qty);
  return combined;
}, {}));

exports.consumeMaterials = async (tenantId, productionOrderId, transaction, options = {}) => {
  const materials = await db.productionMaterial.findAll({ where: { production_order_id: productionOrderId }, transaction });
  const journalLines = [];
  
  for (const mat of materials) {
    const Model = mat.material_type === 'raw' ? db.rawMaterial : db.packagingMaterial;
    const item = await Model.findOne({ where: { id: mat.material_id, tenant_id: tenantId }, transaction, lock: transaction.LOCK.UPDATE });
    
    if (!item) throw new AppError('Material not found', 400);
    
    const requiredQuantity = parseFloat(mat.required_qty);
    const startingStock = parseFloat(item.current_stock);
    let quantity = requiredQuantity;
    if (!options.allowNegative && startingStock < quantity) throw new AppError(`Insufficient stock for ${item.name}`, 400);
    await item.update({ current_stock: startingStock - quantity }, { transaction });
    let consumedCost = 0;
    const batches = await db.stockBatch.findAll({
      where: { tenant_id: tenantId, material_type: mat.material_type, material_id: mat.material_id },
      order: [['received_date', 'ASC'], ['created_at', 'ASC']], transaction, lock: transaction.LOCK.UPDATE
    });
    for (const batch of batches) {
      if (quantity <= 0) break;
      const taken = Math.min(quantity, Number(batch.remaining_qty));
      if (taken <= 0) continue;
      const cost = taken * Number(batch.cost_per_unit);
      await batch.update({ remaining_qty: Number(batch.remaining_qty) - taken }, { transaction });
      await db.stockMovement.create({ tenant_id: tenantId, material_type: mat.material_type, material_id: mat.material_id,
        movement_type: 'consumption', direction: 'out', quantity: taken, batch_id: batch.id, unit_cost: batch.cost_per_unit, total_cost: cost,
        reference_type: 'production_order', reference_id: productionOrderId }, { transaction });
      quantity -= taken;
      consumedCost += cost;
    }
    if (quantity > 0.0001) {
      if (!options.allowNegative) throw new AppError(`No costed stock batches available for ${item.name}`, 400);
      const estimatedUnitCost = mat.material_type === 'raw'
        ? Number(item.last_cost || item.avg_cost || 0)
        : Number(item.avg_cost || 0);
      const deficitQuantity = Math.min(quantity, Math.max(0, requiredQuantity - Math.max(0, startingStock)));
      const unbatchedQuantity = quantity - deficitQuantity;
      if (unbatchedQuantity > 0.0001) {
        const unbatchedCost = unbatchedQuantity * estimatedUnitCost;
        await db.stockMovement.create({ tenant_id: tenantId, material_type: mat.material_type, material_id: mat.material_id, movement_type: 'consumption', direction: 'out', quantity: unbatchedQuantity, unit_cost: estimatedUnitCost, total_cost: unbatchedCost, reference_type: 'production_order', reference_id: productionOrderId, notes: 'Consumed from opening/unbatched stock', created_by: options.createdBy || null }, { transaction });
        consumedCost += unbatchedCost;
      }
      if (deficitQuantity > 0.0001) {
        const shortageCost = deficitQuantity * estimatedUnitCost;
        const movement = await db.stockMovement.create({ tenant_id: tenantId, material_type: mat.material_type, material_id: mat.material_id, movement_type: 'consumption', direction: 'out', quantity: deficitQuantity, unit_cost: estimatedUnitCost, total_cost: shortageCost, reference_type: 'production_order', reference_id: productionOrderId, notes: 'Negative stock consumed by Create Now sale', created_by: options.createdBy || null }, { transaction });
        await db.inventoryDeficit.create({ tenant_id: tenantId, material_type: mat.material_type, material_id: mat.material_id, production_order_id: productionOrderId, stock_movement_id: movement.id, quantity: deficitQuantity, remaining_qty: deficitQuantity, estimated_unit_cost: estimatedUnitCost }, { transaction });
        consumedCost += shortageCost;
      }
      quantity = 0;
    }
    await mat.update({ consumed_qty: parseFloat(mat.required_qty), consumed_cost: consumedCost }, { transaction });
    if (consumedCost > 0) {
      const accounts = await accounting.getAccountsByCode(tenantId, ['1200', '1210', '1220'], transaction);
      journalLines.push({ account_id: accounts['1220'].id, debit_amount: consumedCost, description: `Material issued to ${productionOrderId}` });
      journalLines.push({ account_id: accounts[mat.material_type === 'raw' ? '1200' : '1210'].id, credit_amount: consumedCost, description: `Material issued to ${productionOrderId}` });
    }
  }
  if (journalLines.length) await accounting.createAndPost(tenantId, { entry_date: options.entryDate || new Date(), reference_type: 'production_issue', reference_id: productionOrderId,
    narration: 'Materials issued to production', lines: journalLines }, options.createdBy || null, transaction);
};

exports.completeProduction = async (tenantId, productionOrderId, actualQty, transaction, options = {}) => {
  const order = await db.productionOrder.findOne({
    where: { id: productionOrderId, tenant_id: tenantId },
    transaction,
    lock: transaction.LOCK.UPDATE
  });
  if (!order) throw new Error('Production Order not found');
  if (order.status !== 'in_progress') throw new Error('Only an in-progress production order can be completed');

  const outputs = await db.productionOutput.findAll({ where: { production_order_id: productionOrderId }, transaction, lock: transaction.LOCK.UPDATE });

  let totalActual = 0;
  const quantities = new Map();

  if (outputs.length) {
    const requestedOutputs = Array.isArray(actualQty) ? actualQty : [];
    if (!requestedOutputs.length) throw new Error('Actual output is required for every planned variant');
    requestedOutputs.forEach(row => quantities.set(row.finished_good_id, Number(row.actual_qty)));
    if (quantities.size !== outputs.length || outputs.some(row => !Number.isFinite(quantities.get(row.finished_good_id)) || quantities.get(row.finished_good_id) <= 0)) {
      throw new Error('Enter a valid actual quantity for every planned variant');
    }
    totalActual = [...quantities.values()].reduce((sum, qty) => sum + qty, 0);
  } else {
    if (!Number.isFinite(actualQty) || actualQty <= 0) {
      throw new Error('Actual quantity must be greater than zero');
    }
    totalActual = actualQty;
  }

  await this.consumeMaterials(tenantId, productionOrderId, transaction, options);
  const materials = await db.productionMaterial.findAll({ where: { production_order_id: productionOrderId }, transaction });
  const totalCost = materials.reduce((sum, material) => sum + Number(material.consumed_cost || 0), 0);

  if (outputs.length) {
    for (const output of outputs) {
      const actual = quantities.get(output.finished_good_id);
      const fg = await db.finishedGood.findOne({ where: { id: output.finished_good_id, tenant_id: tenantId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!fg) throw new Error('Finished-good variant not found');
      const outputCost = totalCost * (actual / totalActual);
      await fg.update({ current_stock: Number(fg.current_stock) + actual }, { transaction });
      const batch = await db.stockBatch.create({ tenant_id: tenantId, material_type: 'finished', material_id: fg.id, batch_number: order.batch_number || order.order_number, quantity: actual, remaining_qty: actual, cost_per_unit: outputCost / actual, received_date: options.entryDate || new Date() }, { transaction });
      await db.stockMovement.create({ tenant_id: tenantId, material_type: 'finished', material_id: fg.id, movement_type: 'production', direction: 'in', quantity: actual, batch_id: batch.id, unit_cost: outputCost / actual, total_cost: outputCost, reference_type: 'production_order', reference_id: productionOrderId }, { transaction });
      await output.update({ actual_qty: actual }, { transaction });
    }
    if (totalCost > 0) {
      const accounts = await accounting.getAccountsByCode(tenantId, ['1220', '1300'], transaction);
      const journal = await accounting.createAndPost(tenantId, { entry_date: options.entryDate || new Date(), reference_type: 'production_completion', reference_id: order.id, narration: 'Production completion', lines: [{ account_id: accounts['1300'].id, debit_amount: totalCost, description: `Finished goods completed: ${order.order_number}` }, { account_id: accounts['1220'].id, credit_amount: totalCost, description: `Production completed: ${order.order_number}` }] }, options.createdBy || null, transaction);
      await order.update({ journal_entry_id: journal.id }, { transaction });
    }
    await order.update({ status: 'completed', actual_qty: totalActual, completion_date: options.entryDate || new Date() }, { transaction });
    return order;
  }

  let finishedGoodId = order.finished_good_id;
  if (!finishedGoodId) {
    const legacyMatches = await db.finishedGood.findAll({
      where: { formula_id: order.formula_id, tenant_id: tenantId },
      attributes: ['id'],
      transaction
    });
    if (legacyMatches.length !== 1) {
      throw new Error('Production order does not identify a unique finished-good variant');
    }
    finishedGoodId = legacyMatches[0].id;
  }

  const fg = await db.finishedGood.findOne({
    where: { id: finishedGoodId, tenant_id: tenantId },
    transaction,
    lock: transaction.LOCK.UPDATE
  });
  if (!fg) throw new Error('Finished-good variant not found');

  await fg.update({
    current_stock: parseFloat(fg.current_stock) + actualQty
  }, { transaction });

  const unitCost = totalCost / actualQty;
  const batch = await db.stockBatch.create({ tenant_id: tenantId, material_type: 'finished', material_id: fg.id,
    batch_number: order.batch_number || order.order_number, quantity: actualQty, remaining_qty: actualQty,
    cost_per_unit: unitCost, received_date: options.entryDate || new Date() }, { transaction });

  await db.stockMovement.create({
    tenant_id: tenantId,
    material_type: 'finished',
    material_id: fg.id,
    movement_type: 'production',
    direction: 'in',
    quantity: actualQty,
    batch_id: batch.id,
    unit_cost: unitCost,
    total_cost: totalCost,
    reference_type: 'production_order',
    reference_id: productionOrderId
  }, { transaction });

  if (totalCost > 0) {
    const accounts = await accounting.getAccountsByCode(tenantId, ['1200', '1210', '1220', '1300'], transaction);
    const lines = [
      { account_id: accounts['1300'].id, debit_amount: totalCost, description: `Finished goods completed: ${order.order_number}` },
      { account_id: accounts['1220'].id, credit_amount: totalCost, description: `Production completed: ${order.order_number}` }
    ];
    const journal = await accounting.createAndPost(tenantId, { entry_date: options.entryDate || new Date(), reference_type: 'production_completion', reference_id: order.id,
      narration: 'Production completion', lines }, options.createdBy || null, transaction);
    await order.update({ journal_entry_id: journal.id }, { transaction });
  }

  await order.update({ status: 'completed', actual_qty: actualQty, completion_date: options.entryDate || new Date() }, { transaction });
  return order;
};

exports.createInstantProduction = async ({ tenantId, retailSaleId, variant, quantity, saleDate, lineNumber, createdBy, transaction }) => {
  const formulaId = exports.resolveVariantFormulaId(variant);
  if (!formulaId) throw new AppError(`${variant.name} does not have a formula`, 400);
  const formula = await db.formula.findOne({ where: { id: formulaId, tenant_id: tenantId, is_active: true }, transaction });
  if (!formula) throw new AppError(`${variant.name} does not have an active formula`, 400);

  const sequence = await db.productionOrder.count({ where: { tenant_id: tenantId }, transaction }) + 1;
  const orderNumber = `PROD-${new Date(saleDate).getFullYear()}-${String(sequence).padStart(4, '0')}`;
  const batchNumber = `MAKE-${String(lineNumber).padStart(2, '0')}-${orderNumber}`;
  const order = await db.productionOrder.create({
    tenant_id: tenantId,
    order_number: orderNumber,
    formula_id: formulaId,
    finished_good_id: variant.id,
    retail_sale_id: retailSaleId,
    batch_number: batchNumber,
    planned_qty: quantity,
    status: 'in_progress',
    planned_date: saleDate,
    start_date: saleDate,
    notes: 'Automatically created by a Create Now retail sale',
    created_by: createdBy
  }, { transaction });
  await db.productionOutput.create({ production_order_id: order.id, finished_good_id: variant.id, planned_qty: quantity }, { transaction });
  const requirements = exports.combineMaterialRequirements(await exports.calculateMaterialRequirements(tenantId, formulaId, quantity, variant.id, transaction));
  const availability = await exports.checkAvailability(tenantId, requirements, transaction);
  if (availability.length) await db.productionMaterial.bulkCreate(availability.map(row => ({
    production_order_id: order.id,
    material_type: row.material_type,
    material_id: row.material_id,
    required_qty: row.required_qty,
    available_qty: row.current_stock,
    is_available: row.is_available
  })), { transaction });
  await exports.completeProduction(tenantId, order.id, [{ finished_good_id: variant.id, actual_qty: quantity }], transaction, {
    allowNegative: true,
    entryDate: saleDate,
    createdBy
  });
  const batch = await db.stockBatch.findOne({ where: { tenant_id: tenantId, material_type: 'finished', material_id: variant.id, batch_number: batchNumber }, transaction });
  return { order, batch, requirements: availability };
};
