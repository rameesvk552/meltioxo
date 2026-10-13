const { randomUUID } = require('crypto');
const db = require('../models');
const { AppError } = require('../middleware/errorHandler');

const round4 = value => Math.round((value + Number.EPSILON) * 10000) / 10000;

const nextSku = async (tenantId, transaction) => {
  let sequence = await db.rawMaterial.count({ where: { tenant_id: tenantId }, transaction }) + 1;
  let sku;
  do {
    sku = `RM-${String(sequence++).padStart(4, '0')}`;
  } while (await db.rawMaterial.findOne({ where: { tenant_id: tenantId, sku }, transaction }));
  return sku;
};

exports.createMix = async ({ tenantId, branchId, userId, requestKey, data }) => db.sequelize.transaction(async transaction => {
  const settings = await db.tenant.findByPk(tenantId, { transaction });
  if (!settings?.raw_material_mixing_enabled) throw new AppError('Enable raw material mixing in Company Settings first', 403);

  if (requestKey) {
    const existing = await db.rawMaterialMix.findOne({ where: { tenant_id: tenantId, request_key: requestKey }, transaction });
    if (existing) return { mix: existing, output: await db.rawMaterial.findByPk(existing.output_material_id, { transaction }), repeated: true };
  }

  // Lock all existing materials in a stable order, including the output, so
  // overlapping mixes cannot both spend the same input stock.
  const ids = [...data.ingredients.map(row => row.material_id), data.output_material_id].filter(Boolean).sort();
  const materials = new Map();
  for (const id of ids) {
    const material = await db.rawMaterial.findOne({ where: { id, tenant_id: tenantId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!material) throw new AppError('A selected raw material was not found', 400);
    materials.set(id, material);
  }
  // A concurrent retry may have completed while this request waited for an
  // input lock. Recheck before applying any stock changes.
  if (requestKey) {
    const existing = await db.rawMaterialMix.findOne({ where: { tenant_id: tenantId, request_key: requestKey }, transaction });
    if (existing) return { mix: existing, output: await db.rawMaterial.findByPk(existing.output_material_id, { transaction }), repeated: true };
  }

  for (const row of data.ingredients) {
    const material = materials.get(row.material_id);
    if (Number(material.current_stock) - Number(material.reserved_stock || 0) + 0.000001 < row.quantity) {
      throw new AppError(`Insufficient available stock for ${material.name}`, 400);
    }
  }

  let output = data.output_material_id ? materials.get(data.output_material_id) : null;
  if (!output) {
    const sku = data.new_material.sku?.trim() || await nextSku(tenantId, transaction);
    if (await db.rawMaterial.findOne({ where: { tenant_id: tenantId, sku }, transaction })) throw new AppError(`SKU ${sku} is already in use`, 409);
    output = await db.rawMaterial.create({
      tenant_id: tenantId, sku, name: data.new_material.name.trim(),
      category: data.new_material.category.trim(), unit: data.new_material.unit,
      current_stock: 0, avg_cost: 0, last_cost: 0, reorder_level: 0
    }, { transaction });
  }
  if (Number(output.current_stock) < 0) {
    throw new AppError(`Reconcile negative stock for ${output.name} before receiving a mix`, 400);
  }

  const mixId = randomUUID();
  const batchNumber = `MIX-${new Date().toISOString().slice(0, 10)}-${mixId.slice(0, 8)}`;
  let totalCost = 0;
  const ingredientSnapshots = [];
  for (const row of data.ingredients) {
    const material = materials.get(row.material_id);
    let remaining = row.quantity;
    let ingredientCost = 0;
    const batches = await db.stockBatch.findAll({
      where: { tenant_id: tenantId, material_type: 'raw', material_id: material.id },
      order: [['received_date', 'ASC'], ['created_at', 'ASC']], transaction, lock: transaction.LOCK.UPDATE
    });
    for (const batch of batches) {
      if (remaining < 0.000001) break;
      const taken = Math.min(remaining, Number(batch.remaining_qty));
      if (taken <= 0) continue;
      const cost = round4(taken * Number(batch.cost_per_unit));
      await batch.update({ remaining_qty: round4(Number(batch.remaining_qty) - taken) }, { transaction });
      await db.stockMovement.create({
        tenant_id: tenantId, branch_id: branchId, material_type: 'raw', material_id: material.id,
        movement_type: 'consumption', direction: 'out', quantity: taken, batch_id: batch.id,
        unit_cost: batch.cost_per_unit, total_cost: cost, reference_type: 'raw_material_mix',
        reference_id: mixId, notes: `Mixed into ${output.name}`, created_by: userId
      }, { transaction });
      remaining = round4(remaining - taken);
      ingredientCost += cost;
    }
    if (remaining > 0.000001) {
      // Opening balances can have stock without batches. They still need an
      // auditable movement and a cost based on the material's saved average.
      const unitCost = Number(material.avg_cost || material.last_cost || 0);
      const cost = round4(remaining * unitCost);
      await db.stockMovement.create({
        tenant_id: tenantId, branch_id: branchId, material_type: 'raw', material_id: material.id,
        movement_type: 'consumption', direction: 'out', quantity: remaining,
        unit_cost: unitCost, total_cost: cost, reference_type: 'raw_material_mix',
        reference_id: mixId, notes: `Opening/unbatched stock mixed into ${output.name}`, created_by: userId
      }, { transaction });
      ingredientCost += cost;
    }
    await material.update({ current_stock: round4(Number(material.current_stock) - row.quantity) }, { transaction });
    ingredientCost = round4(ingredientCost);
    totalCost += ingredientCost;
    ingredientSnapshots.push({ material_id: material.id, name: material.name, unit: material.unit, quantity: row.quantity, cost: ingredientCost });
  }

  totalCost = round4(totalCost);
  const previousStock = Number(output.current_stock);
  const nextStock = round4(previousStock + data.output_quantity);
  const nextAvgCost = round4(((previousStock * Number(output.avg_cost || 0)) + totalCost) / nextStock);
  await output.update({ current_stock: nextStock, avg_cost: nextAvgCost }, { transaction });
  const batch = await db.stockBatch.create({
    tenant_id: tenantId, branch_id: branchId, material_type: 'raw', material_id: output.id,
    batch_number: batchNumber, quantity: data.output_quantity, remaining_qty: data.output_quantity,
    cost_per_unit: round4(totalCost / data.output_quantity), received_date: new Date().toISOString().slice(0, 10)
  }, { transaction });
  await db.stockMovement.create({
    tenant_id: tenantId, branch_id: branchId, material_type: 'raw', material_id: output.id,
    movement_type: 'production', direction: 'in', quantity: data.output_quantity, batch_id: batch.id,
    unit_cost: batch.cost_per_unit, total_cost: totalCost, reference_type: 'raw_material_mix',
    reference_id: mixId, notes: data.notes || 'Produced by mixing raw materials', created_by: userId
  }, { transaction });
  const mix = await db.rawMaterialMix.create({
    id: mixId, tenant_id: tenantId, branch_id: branchId, output_material_id: output.id,
    output_quantity: data.output_quantity, total_cost: totalCost, batch_number: batchNumber,
    ingredients: ingredientSnapshots, notes: data.notes || null, request_key: requestKey || null,
    created_by: userId
  }, { transaction });
  return { mix, output, repeated: false };
});
