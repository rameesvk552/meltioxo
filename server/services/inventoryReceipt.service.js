const db = require('../models');
const { AppError } = require('../middleware/errorHandler');

const number = value => Number(value || 0);

exports.receiveMaterial = async ({
  tenantId,
  materialType,
  materialId,
  quantity,
  unitCost,
  batchNumber,
  supplierId,
  purchaseId,
  receivedDate,
  referenceId,
  createdBy,
  transaction
}) => {
  const Model = materialType === 'raw'
    ? db.rawMaterial
    : materialType === 'packaging'
      ? db.packagingMaterial
      : materialType === 'finished'
        ? db.finishedGood
        : null;
  if (!Model) throw new AppError('Invalid purchase item type', 400);
  const material = await Model.findOne({ where: { id: materialId, tenant_id: tenantId }, transaction, lock: transaction.LOCK.UPDATE });
  if (!material) throw new AppError('Purchase material not found', 400);
  if (materialType === 'finished' && material.source_type !== 'ready_made') {
    throw new AppError('Only ready-made product variants can be purchased', 400);
  }

  let remainingReceipt = number(quantity);
  let costVariance = 0;
  const deficits = materialType === 'finished' ? [] : await db.inventoryDeficit.findAll({
    where: { tenant_id: tenantId, material_type: materialType, material_id: materialId, status: 'open' },
    order: [['created_at', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE
  });
  for (const deficit of deficits) {
    if (remainingReceipt <= 0) break;
    const covered = Math.min(remainingReceipt, number(deficit.remaining_qty));
    if (covered <= 0) continue;
    const nextRemaining = number(deficit.remaining_qty) - covered;
    costVariance += covered * (number(unitCost) - number(deficit.estimated_unit_cost));
    await deficit.update({ remaining_qty: nextRemaining, status: nextRemaining <= 0.0001 ? 'reconciled' : 'open', reconciled_at: nextRemaining <= 0.0001 ? new Date() : null }, { transaction });
    remainingReceipt -= covered;
  }

  const previousQty = number(material.current_stock);
  const previousCost = number(materialType === 'finished' ? material.cost_price : material.avg_cost);
  const nextQty = previousQty + number(quantity);
  const nextCost = nextQty > 0
    ? (previousQty > 0 ? ((previousQty * previousCost) + (number(quantity) * number(unitCost))) / nextQty : number(unitCost))
    : (number(unitCost) || previousCost);
  await material.update({
    current_stock: nextQty,
    ...(materialType === 'finished' ? { cost_price: nextCost } : { avg_cost: nextCost }),
    ...(materialType === 'raw' ? { last_cost: unitCost } : {})
  }, { transaction });

  const batch = await db.stockBatch.create({
    tenant_id: tenantId,
    material_type: materialType,
    material_id: materialId,
    batch_number: batchNumber,
    supplier_id: supplierId,
    purchase_id: purchaseId || null,
    quantity,
    remaining_qty: remainingReceipt,
    cost_per_unit: unitCost,
    received_date: receivedDate
  }, { transaction });
  await db.stockMovement.create({
    tenant_id: tenantId,
    material_type: materialType,
    material_id: materialId,
    movement_type: 'purchase',
    direction: 'in',
    quantity,
    batch_id: batch.id,
    unit_cost: unitCost,
    total_cost: number(quantity) * number(unitCost),
    reference_type: 'purchase_receipt',
    reference_id: referenceId,
    notes: remainingReceipt < number(quantity) ? `${number(quantity) - remainingReceipt} units reconciled against negative stock` : null,
    created_by: createdBy
  }, { transaction });
  return { material, batch, deficit_covered_qty: number(quantity) - remainingReceipt, cost_variance: costVariance };
};
