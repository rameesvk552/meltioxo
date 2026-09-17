const db = require('../models');
const { Op } = db.Sequelize;
const { AppError } = require('../middleware/errorHandler');
const accounting = require('../services/accounting.service');
const production = require('../services/production.service');
const businessDays = require('../services/businessDay.service');
const saleNumbers = require('../services/saleNumber.service');
const invoiceWhatsapp = require('../services/invoiceWhatsapp.service');
const { ACCOUNT_CODES } = require('../config/constants');

const number = value => Number(value || 0);
const allocateFixedDiscount = (bases, amount) => {
  const baseCents = bases.map(base => Math.round(number(base) * 100));
  const subtotalCents = baseCents.reduce((sum, cents) => sum + cents, 0);
  const discountCents = Math.min(Math.max(0, Math.round(number(amount) * 100)), subtotalCents);
  if (!subtotalCents || !discountCents) return baseCents.map(() => 0);
  const shares = baseCents.map((cents, index) => {
    const exact = discountCents * cents / subtotalCents;
    return { index, cents: Math.floor(exact), remainder: exact % 1 };
  });
  let centsLeft = discountCents - shares.reduce((sum, share) => sum + share.cents, 0);
  shares.sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let index = 0; index < centsLeft; index += 1) shares[index].cents += 1;
  return shares.sort((left, right) => left.index - right.index).map(share => share.cents / 100);
};
const measurementSourceType = variant => variant?.product?.sell_by_measurement ? (variant.product.measurement_source_type || 'formula') : null;
const fulfillmentModeForVariant = variant => variant?.source_type === 'ready_made' || ['raw_material', 'bulk_stock'].includes(measurementSourceType(variant)) ? 'stock' : 'make_now';
const mlToMaterialQuantity = (ml, unit) => ['l', 'litre', 'litres', 'liter', 'liters'].includes(String(unit || '').trim().toLowerCase()) ? ml / 1000 : ml;
const packingKitSupportsFill = (kit, fillMl) => number(kit?.minimum_fill_ml) <= number(fillMl) && number(kit?.maximum_fill_ml) >= number(fillMl);

const loadMatchingKits = (tenantId, fillMl, transaction) => db.packingKit.findAll({
  where: {
    tenant_id: tenantId, is_active: true,
    minimum_fill_ml: { [db.Sequelize.Op.lte]: fillMl },
    maximum_fill_ml: { [db.Sequelize.Op.gte]: fillMl }
  },
  include: [{ model: db.packingKitItem, include: [db.packagingMaterial] }],
  order: [['priority', 'DESC'], ['is_default', 'DESC'], ['name', 'ASC']],
  transaction
});

const loadVariant = (tenantId, id, transaction) => db.finishedGood.findOne({
  where: { id, tenant_id: tenantId, is_active: true },
  include: [
    { model: db.product, include: [db.formula] },
    db.formula,
    { model: db.variantPackaging, include: [db.packagingMaterial] }
  ],
  transaction,
  ...(transaction ? { lock: { level: transaction.LOCK.UPDATE, of: db.finishedGood } } : {})
});

const buildPreview = async (tenantId, items, transaction) => {
  if (!Array.isArray(items) || !items.length) throw new AppError('A retail sale needs at least one item', 400);
  const settings = await db.tenant.findByPk(tenantId, { transaction });
  const lines = [];
  const combined = new Map();
  for (const [index, row] of items.entries()) {
    const quantity = number(row.quantity);
    if (row.packaging_material_id) {
      if (row.finished_good_id) throw new AppError(`Sale item ${index + 1} cannot be both a product and a packing material`, 400);
      if (!settings?.packaging_material_sales_enabled) throw new AppError('Selling packing materials is not enabled in Settings', 403);
      if (quantity <= 0) throw new AppError(`Sale item ${index + 1} requires a positive quantity`, 400);
      const material = await db.packagingMaterial.findOne({
        where: { id: row.packaging_material_id, tenant_id: tenantId },
        transaction,
        ...(transaction ? { lock: transaction.LOCK.UPDATE } : {})
      });
      if (!material) throw new AppError('Select a valid packing material', 400);
      const requirement = { material_type: 'packaging', material_id: material.id, required_qty: quantity };
      const key = `packaging:${material.id}`;
      const current = combined.get(key) || { ...requirement, required_qty: 0 };
      current.required_qty += quantity;
      combined.set(key, current);
      lines.push({
        index,
        item_type: 'packaging_material',
        packaging_material_id: material.id,
        product_name: material.name,
        variant_name: material.sku,
        sku: material.sku,
        unit: material.unit || 'pcs',
        quantity,
        fulfillment_mode: 'stock',
        finished_stock: number(material.current_stock),
        is_available: number(material.current_stock) >= quantity,
        materials: [requirement],
        packaging: [],
        sale_packaging: [],
        matching_kits: [],
        packing_kit: null
      });
      continue;
    }
    if (!row.finished_good_id || quantity <= 0) throw new AppError(`Sale item ${index + 1} requires a product and positive quantity`, 400);
    const variant = await loadVariant(tenantId, row.finished_good_id, transaction);
    if (!variant || !variant.product || !variant.product.is_active) throw new AppError('Select an active product variant', 400);
    const isMeasured = Boolean(variant.product.sell_by_measurement);
    const sourceType = measurementSourceType(variant);
    const fillQuantityMl = isMeasured ? number(row.fill_quantity_ml || quantity) : null;
    const packCount = isMeasured ? number(row.pack_count || 1) : 1;
    if (isMeasured && (!Number.isFinite(fillQuantityMl) || fillQuantityMl <= 0 || !Number.isFinite(packCount) || packCount <= 0 || Math.abs(quantity - fillQuantityMl * packCount) > 0.0001)) {
      throw new AppError(`${variant.product.name} quantity must equal fill quantity multiplied by pack count`, 400);
    }
    const fulfillmentMode = fulfillmentModeForVariant(variant);
    const line = {
      index,
      item_type: 'finished_good',
      finished_good_id: variant.id,
      product_name: variant.product.name,
      variant_name: variant.size_label || variant.name,
      sku: variant.sku,
      fill_quantity_ml: fillQuantityMl ?? number(variant.fill_quantity_ml),
      pack_count: packCount,
      quantity,
      fulfillment_mode: fulfillmentMode,
      measurement_source_type: sourceType,
      exclude_formula_packaging: Boolean(isMeasured && settings?.measured_packaging_enabled),
      measurement_source_id: sourceType === 'raw_material' ? variant.product.measurement_source_id : sourceType === 'bulk_stock' ? variant.id : null,
      finished_stock: number(variant.current_stock),
      formula: null,
      packaging: [],
      sale_packaging: [],
      materials: [],
      matching_kits: [],
      packing_kit: null
    };

    if (isMeasured && settings?.measured_packaging_enabled) {
      const matchingKits = await loadMatchingKits(tenantId, fillQuantityMl, transaction);
      line.matching_kits = matchingKits.map(kit => ({ id: kit.id, code: kit.code, name: kit.name, minimum_fill_ml: number(kit.minimum_fill_ml), maximum_fill_ml: number(kit.maximum_fill_ml), is_default: kit.is_default }));
      let selectedKit = row.packing_kit_id ? matchingKits.find(kit => kit.id === row.packing_kit_id) : null;
      if (row.packing_kit_id && !selectedKit) throw new AppError(`The selected packing kit does not support ${fillQuantityMl} ml`, 400);
      if (!selectedKit && settings.measured_packaging_auto_select) selectedKit = matchingKits.find(kit => kit.is_default) || (matchingKits.length === 1 ? matchingKits[0] : null);
      if (!selectedKit && settings.measured_packaging_required) {
        if (!matchingKits.length) throw new AppError(`No active packing kit supports ${fillQuantityMl} ml`, 400);
        throw new AppError(`Select a packing kit for ${variant.product.name}`, 400);
      }
      if (selectedKit) {
        line.packing_kit = { id: selectedKit.id, code: selectedKit.code, name: selectedKit.name };
        const requestedQuantities = row.packing_kit_quantities && typeof row.packing_kit_quantities === 'object' ? row.packing_kit_quantities : {};
        if (Object.values(requestedQuantities).some(value => !Number.isFinite(Number(value)) || Number(value) <= 0)) {
          throw new AppError('Packing kit material quantities must be greater than zero', 400);
        }
        line.packaging = selectedKit.packingKitItems.map(item => ({
          id: item.packaging_material_id,
          name: item.packagingMaterial?.name || 'Packaging',
          unit: item.packagingMaterial?.unit || 'pcs',
          quantity: number(requestedQuantities[item.packaging_material_id] ?? item.quantity) * packCount
        }));
        line.sale_packaging = line.packaging;
        line.packaging.forEach(pkg => {
          const key = `packaging:${pkg.id}`;
          const current = combined.get(key) || { material_type: 'packaging', material_id: pkg.id, required_qty: 0 };
          current.required_qty += pkg.quantity;
          combined.set(key, current);
        });
        line.materials.push(...line.packaging.map(pkg => ({ material_type: 'packaging', material_id: pkg.id, required_qty: pkg.quantity })));
      }
    }

    if (fulfillmentMode === 'stock') {
      if (isMeasured && sourceType === 'raw_material') {
        const material = await db.rawMaterial.findOne({ where: { id: variant.product.measurement_source_id, tenant_id: tenantId }, transaction });
        if (!material) throw new AppError(`${variant.product.name} is missing its measured raw-material source`, 400);
        const requiredQty = mlToMaterialQuantity(quantity, material.unit);
        const key = `raw:${material.id}`;
        const current = combined.get(key) || { material_type: 'raw', material_id: material.id, required_qty: 0 };
        current.required_qty += requiredQty;
        combined.set(key, current);
        line.materials.push({ material_type: 'raw', material_id: material.id, required_qty: requiredQty });
        line.source_quantity = requiredQty;
        line.source_unit = material.unit;
      } else {
        line.is_available = number(variant.current_stock) >= quantity;
        if (!line.is_available) line.finished_shortage = quantity - number(variant.current_stock);
      }
      lines.push(line);
      continue;
    }
    const formulaId = production.resolveVariantFormulaId(variant);
    const formula = formulaId ? await db.formula.findOne({ where: { id: formulaId, tenant_id: tenantId, is_active: true }, include: [db.formulaIngredient], transaction }) : null;
    if (!formula || !formula.formulaIngredients.length) throw new AppError(`${variant.name} is missing an active formula with ingredients`, 400);
    if (!variant.product.sell_by_measurement && !variant.variantPackagings.length) throw new AppError(`${variant.name} is missing its packaging BOM`, 400);
    line.formula = { id: formula.id, name: formula.name, inherited: !variant.formula_id || variant.formula_id === variant.product.formula_id };
    if (!isMeasured) line.packaging = variant.variantPackagings.map(pkg => ({ id: pkg.packaging_material_id, name: pkg.packagingMaterial?.name || 'Packaging', quantity: number(pkg.quantity) * quantity }));
    const requirements = production.combineMaterialRequirements(await production.calculateMaterialRequirements(tenantId, formula.id, quantity, variant.id, transaction, { excludePackaging: isMeasured && settings?.measured_packaging_enabled }));
    requirements.forEach(req => {
      const key = `${req.material_type}:${req.material_id}`;
      const current = combined.get(key) || { ...req, required_qty: 0 };
      current.required_qty += number(req.required_qty);
      combined.set(key, current);
    });
    line.materials.push(...requirements);
    lines.push(line);
  }
  const availability = await production.checkAvailability(tenantId, [...combined.values()], transaction);
  const rawIds = availability.filter(row => row.material_type === 'raw').map(row => row.material_id);
  const packagingIds = availability.filter(row => row.material_type === 'packaging').map(row => row.material_id);
  const [rawMaterials, packagingMaterials] = await Promise.all([
    rawIds.length ? db.rawMaterial.findAll({ where: { id: rawIds, tenant_id: tenantId }, transaction }) : [],
    packagingIds.length ? db.packagingMaterial.findAll({ where: { id: packagingIds, tenant_id: tenantId }, transaction }) : []
  ]);
  const details = new Map([...rawMaterials.map(item => [`raw:${item.id}`, item]), ...packagingMaterials.map(item => [`packaging:${item.id}`, item])]);
  const materials = availability.map(row => {
    const item = details.get(`${row.material_type}:${row.material_id}`);
    const projected = number(row.current_stock) - number(row.required_qty);
    return { ...row, name: item?.name || 'Material', unit: item?.unit || (row.material_type === 'packaging' ? 'pcs' : 'units'), projected_stock: projected, shortage_qty: Math.max(0, -projected) };
  });
  const materialByKey = new Map(materials.map(row => [`${row.material_type}:${row.material_id}`, row]));
  lines.forEach(line => { line.materials = line.materials.map(row => materialByKey.get(`${row.material_type}:${row.material_id}`) || row); });
  const stockShortages = lines.filter(line => line.fulfillment_mode === 'stock' && number(line.finished_shortage) > 0).map(line => ({ finished_good_id: line.finished_good_id, name: `${line.product_name} ${line.variant_name}`, shortage_qty: line.finished_shortage }));
  return { lines, materials, shortages: materials.filter(row => row.shortage_qty > 0), stock_shortages: stockShortages, requires_negative_confirmation: materials.some(row => row.shortage_qty > 0) };
};

const saleInclude = [
  db.customer,
  db.paymentMethod,
  { model: db.account, as: 'paymentAccount' },
  { model: db.salesReturn, as: 'salesReturns', include: [
    db.paymentMethod,
    { model: db.account, as: 'refundAccount' },
    { model: db.salesReturnItem, include: [{ model: db.finishedGood, include: [db.product] }, db.packagingMaterial] },
    { model: db.retailSale, as: 'exchangeSale', attributes: ['id', 'sale_number', 'total_amount', 'sale_date'] }
  ] },
  { model: db.salesReturn, as: 'exchangeReturn', include: [{ model: db.retailSale, as: 'retailSale', attributes: ['id', 'sale_number', 'total_amount', 'sale_date'] }] },
  { model: db.retailSaleItem, include: [
    { model: db.finishedGood, include: [db.product] },
    db.packagingMaterial,
    { model: db.packingKit },
    { model: db.retailSaleItemPackaging, include: [db.packagingMaterial] },
    { model: db.productionOrder, include: [db.formula, db.productionMaterial, db.inventoryDeficit] }
  ] }
];
const saleListInclude = [
  db.customer,
  { model: db.retailSaleItem, include: [{ model: db.finishedGood, include: [db.product] }, db.packagingMaterial] },
  db.paymentMethod,
  { model: db.account, as: 'paymentAccount' },
  { model: db.salesReturn, as: 'salesReturns', attributes: ['id', 'return_number', 'subtotal', 'discount_amount', 'total_amount', 'restocked_cost'], include: [{ model: db.salesReturnItem, attributes: ['retail_sale_item_id', 'quantity', 'restock_quantity'] }] }
];

const addReturnSummary = sale => {
  const data = typeof sale?.toJSON === 'function' ? sale.toJSON() : sale;
  const returnedByItem = new Map();
  for (const salesReturn of data.salesReturns || []) {
    for (const item of salesReturn.salesReturnItems || []) {
      const current = returnedByItem.get(item.retail_sale_item_id) || { quantity: 0, restocked: 0 };
      current.quantity += number(item.quantity);
      current.restocked += number(item.restock_quantity);
      returnedByItem.set(item.retail_sale_item_id, current);
    }
  }
  let hasReturn = false;
  let fullyReturned = Boolean((data.retailSaleItems || []).length);
  data.retailSaleItems = (data.retailSaleItems || []).map(item => {
    const returned = returnedByItem.get(item.id) || { quantity: 0, restocked: 0 };
    const returnable = Math.max(0, number(item.quantity) - returned.quantity);
    hasReturn ||= returned.quantity > 0;
    if (returnable > 0.00005) fullyReturned = false;
    return { ...item, returned_quantity: returned.quantity, restocked_quantity: returned.restocked, returnable_quantity: returnable };
  });
  data.returned_amount = accounting.money((data.salesReturns || []).reduce((sum, item) => sum + number(item.total_amount), 0));
  data.returned_revenue = accounting.money((data.salesReturns || []).reduce((sum, item) => sum + number(item.subtotal) - number(item.discount_amount), 0));
  data.returned_cost = accounting.money((data.salesReturns || []).reduce((sum, item) => sum + number(item.restocked_cost), 0));
  data.return_status = fullyReturned ? 'full' : hasReturn ? 'partial' : 'none';
  return data;
};

const enrichSaleMaterials = async (tenantId, sale) => {
  const data = addReturnSummary(sale);
  const orders = (data.retailSaleItems || []).map(item => item.productionOrder).filter(Boolean);
  const orderIds = orders.map(order => order.id);
  // Reload the polymorphic material rows directly. Deep nested Sequelize
  // includes can retain wrapper objects, causing their stored fields to vanish
  // when the sale response is serialized.
  const savedMaterials = orderIds.length ? await db.productionMaterial.findAll({
    where: { production_order_id: orderIds },
    order: [['created_at', 'ASC']]
  }) : [];
  const materialsByOrder = new Map();
  savedMaterials.forEach(instance => {
    const material = instance.toJSON();
    const rows = materialsByOrder.get(material.production_order_id) || [];
    rows.push(material);
    materialsByOrder.set(material.production_order_id, rows);
  });
  orders.forEach(order => { order.productionMaterials = materialsByOrder.get(order.id) || []; });
  const rawIds = new Set(), packagingIds = new Set();
  orders.forEach(order => (order.productionMaterials || []).forEach(material => (material.material_type === 'raw' ? rawIds : packagingIds).add(material.material_id)));
  const [raw, packaging] = await Promise.all([
    rawIds.size ? db.rawMaterial.findAll({ where: { id: [...rawIds], tenant_id: tenantId }, attributes: ['id', 'name', 'unit'] }) : [],
    packagingIds.size ? db.packagingMaterial.findAll({ where: { id: [...packagingIds], tenant_id: tenantId }, attributes: ['id', 'name', 'unit'] }) : []
  ]);
  const names = new Map([...raw, ...packaging].map(item => [item.id, item]));
  (data.retailSaleItems || []).forEach(item => {
    if (!item.productionOrder) return;
    item.productionOrder.productionMaterials = (item.productionOrder.productionMaterials || []).map(material => ({ ...material, material_name: names.get(material.material_id)?.name || 'Material', material_unit: names.get(material.material_id)?.unit || (material.material_type === 'packaging' ? 'pcs' : 'units') }));
  });
  return data;
};

exports.getAll = async (req, res, next) => {
  try {
    const sales = await db.retailSale.findAll({ where: { tenant_id: req.tenantId }, include: saleListInclude, order: [['sale_date', 'DESC'], ['created_at', 'DESC']] });
    res.json(sales.map(addReturnSummary));
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const sale = await db.retailSale.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, include: saleInclude });
    if (!sale) throw new AppError('Sale not found', 404);
    const data = await enrichSaleMaterials(req.tenantId, sale);
    data.payments = sale.journal_entry_id ? await db.payment.findAll({
      where: { tenant_id: req.tenantId, journal_entry_id: sale.journal_entry_id },
      include: [db.paymentMethod],
      order: [['created_at', 'ASC']]
    }) : [];
    res.json(data);
  } catch (error) { next(error); }
};

exports.preview = async (req, res, next) => {
  try { res.json(await buildPreview(req.tenantId, req.body.items)); } catch (error) { next(error); }
};

const consumeStockLine = async ({ tenantId, saleId, variant, line, createdBy, transaction }) => {
  const startingStock = number(variant.current_stock);
  let remaining = line.quantity, lineCost = 0, batchedQuantity = 0;
  const batches = await db.stockBatch.findAll({ where: { tenant_id: tenantId, material_type: 'finished', material_id: variant.id }, order: [['received_date', 'ASC'], ['created_at', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
  for (const batch of batches) {
    if (remaining <= 0) break;
    const taken = Math.min(remaining, number(batch.remaining_qty));
    if (taken <= 0) continue;
    const cost = taken * number(batch.cost_per_unit);
    await batch.update({ remaining_qty: number(batch.remaining_qty) - taken }, { transaction });
    await db.stockMovement.create({ tenant_id: tenantId, material_type: 'finished', material_id: variant.id, movement_type: 'sale', direction: 'out', quantity: taken, batch_id: batch.id, unit_cost: batch.cost_per_unit, total_cost: cost, reference_type: 'retail_sale', reference_id: saleId, created_by: createdBy }, { transaction });
    remaining -= taken; lineCost += cost;
    batchedQuantity += taken;
  }

  // Opening stock and stock sold before batches were introduced are valid
  // inventory too. If the sale exceeds the costed batches (or stock is already
  // zero/negative), record the unbatched part at the variant's estimated cost
  // instead of blocking the sale. This keeps the stock balance and COGS in
  // sync while making the negative quantity visible in the stock ledger.
  if (remaining > 0.0001) {
    const estimatedUnitCost = number(variant.cost_price);
    const unbatchedCost = remaining * estimatedUnitCost;
    const isNegativeStock = startingStock - line.quantity < -0.00005;
    await db.stockMovement.create({
      tenant_id: tenantId,
      material_type: 'finished',
      material_id: variant.id,
      movement_type: 'sale',
      direction: 'out',
      quantity: remaining,
      unit_cost: estimatedUnitCost,
      total_cost: unbatchedCost,
      reference_type: 'retail_sale',
      reference_id: saleId,
      notes: isNegativeStock
        ? 'Sale created negative finished-product stock'
        : `Sale consumed ${remaining} units of opening/unbatched stock${batchedQuantity ? '' : ' (no costed batch)'}`,
      created_by: createdBy
    }, { transaction });
    lineCost += unbatchedCost;
  }
  await variant.update({ current_stock: number(variant.current_stock) - line.quantity }, { transaction });
  return lineCost;
};

const consumeMaterialStock = async ({ tenantId, saleId, materialType, materialId, quantity, createdBy, transaction }) => {
  const Model = materialType === 'raw' ? db.rawMaterial : db.packagingMaterial;
  const material = await Model.findOne({ where: { id: materialId, tenant_id: tenantId }, transaction, lock: transaction.LOCK.UPDATE });
  if (!material) throw new AppError('Sale material not found', 409);
  const startingStock = number(material.current_stock);
  let remaining = number(quantity), totalCost = 0;
  const batches = await db.stockBatch.findAll({
    where: { tenant_id: tenantId, material_type: materialType, material_id: materialId },
    order: [['received_date', 'ASC'], ['created_at', 'ASC']], transaction, lock: transaction.LOCK.UPDATE
  });
  for (const batch of batches) {
    if (remaining <= 0.0001) break;
    const taken = Math.min(remaining, number(batch.remaining_qty));
    if (taken <= 0) continue;
    const cost = taken * number(batch.cost_per_unit);
    await batch.update({ remaining_qty: number(batch.remaining_qty) - taken }, { transaction });
    await db.stockMovement.create({ tenant_id: tenantId, material_type: materialType, material_id: materialId, movement_type: 'sale', direction: 'out', quantity: taken, batch_id: batch.id, unit_cost: batch.cost_per_unit, total_cost: cost, reference_type: 'retail_sale', reference_id: saleId, created_by: createdBy }, { transaction });
    remaining -= taken;
    totalCost += cost;
  }
  if (remaining > 0.0001) {
    const estimatedUnitCost = number(material.avg_cost);
    const cost = remaining * estimatedUnitCost;
    await db.stockMovement.create({ tenant_id: tenantId, material_type: materialType, material_id: materialId, movement_type: 'sale', direction: 'out', quantity: remaining, unit_cost: estimatedUnitCost, total_cost: cost, reference_type: 'retail_sale', reference_id: saleId, notes: startingStock < quantity ? 'Sale created negative material stock' : 'Sale consumed opening/unbatched stock', created_by: createdBy }, { transaction });
    totalCost += cost;
  }
  await material.update({ current_stock: startingStock - quantity }, { transaction });
  return { material, totalCost };
};

const removeJournal = async (tenantId, journalId, userId, transaction) => {
  if (!journalId) return;
  const journal = await db.journalEntry.findOne({ where: { id: journalId, tenant_id: tenantId }, transaction, lock: transaction.LOCK.UPDATE });
  if (!journal) return;
  const lines = await db.journalEntryLine.findAll({ where: { journal_entry_id: journal.id }, transaction });
  if (journal.status === 'posted') {
    const accountIds = [...new Set(lines.map(line => line.account_id))];
    const accounts = await db.account.findAll({ where: { tenant_id: tenantId, id: { [Op.in]: accountIds } }, transaction, lock: transaction.LOCK.UPDATE });
    const accountById = new Map(accounts.map(account => [account.id, account]));
    for (const line of lines) {
      const account = accountById.get(line.account_id);
      if (!account) throw new AppError(`Cannot rebuild sale: account for journal ${journal.entry_number} is missing`, 409);
      const effect = ['asset', 'expense'].includes(account.type)
        ? number(line.debit) - number(line.credit)
        : number(line.credit) - number(line.debit);
      if (effect) await account.increment('balance', { by: -effect, transaction });
    }
  }
  await db.journalEntryLine.destroy({ where: { journal_entry_id: journal.id }, transaction });
  await journal.destroy({ transaction });
};

const restoreStockForMovements = async (tenantId, movements, transaction) => {
  const itemDeltas = new Map();
  const batchDeltas = new Map();
  for (const movement of movements) {
    const quantity = number(movement.quantity);
    const delta = movement.direction === 'out' ? quantity : -quantity;
    const itemKey = `${movement.material_type}:${movement.material_id}`;
    itemDeltas.set(itemKey, (itemDeltas.get(itemKey) || 0) + delta);
    if (movement.batch_id) batchDeltas.set(movement.batch_id, (batchDeltas.get(movement.batch_id) || 0) + delta);
  }

  for (const [key, delta] of itemDeltas) {
    if (Math.abs(delta) < 0.000001) continue;
    const [materialType, materialId] = key.split(':');
    const Model = materialType === 'raw' ? db.rawMaterial : materialType === 'packaging' ? db.packagingMaterial : db.finishedGood;
    const item = await Model.findOne({ where: { id: materialId, tenant_id: tenantId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw new AppError(`Cannot rebuild sale: ${materialType} stock item is missing`, 409);
    await item.update({ current_stock: number(item.current_stock) + delta }, { transaction });
  }
  for (const [batchId, delta] of batchDeltas) {
    const batch = await db.stockBatch.findOne({ where: { id: batchId, tenant_id: tenantId }, transaction, lock: transaction.LOCK.UPDATE });
    if (batch) await batch.update({ remaining_qty: number(batch.remaining_qty) + delta }, { transaction });
  }
};

// Editing a posted sale is an in-place rebuild. Its original stock and journal
// effects are removed inside the same transaction, then the normal create path
// posts the edited sale again. No reversal rows are created.
const removeSaleDataForRebuild = async (tenantId, sale, transaction) => {
  const saleItems = await db.retailSaleItem.findAll({ where: { retail_sale_id: sale.id }, transaction, lock: transaction.LOCK.UPDATE });
  const productionOrderIds = [...new Set(saleItems.map(item => item.production_order_id).filter(Boolean))];
  const returnCount = await db.salesReturn.count({ where: { tenant_id: tenantId, retail_sale_id: sale.id }, transaction });
  if (returnCount || sale.exchange_return_id) {
    throw new AppError('A sale with returns or an exchange cannot be edited. Correct it with a return instead.', 409);
  }

  const saleJournals = await db.journalEntry.findAll({
    where: { tenant_id: tenantId, [Op.or]: [
      { id: { [Op.in]: [sale.journal_entry_id, sale.cogs_journal_id].filter(Boolean) } },
      { reference_type: { [Op.in]: ['retail_sale_revenue', 'retail_sale_cogs'] }, reference_id: sale.id }
    ] }, transaction, lock: transaction.LOCK.UPDATE
  });
  const productionJournals = productionOrderIds.length ? await db.journalEntry.findAll({
    where: { tenant_id: tenantId, [Op.or]: [
      { reference_type: { [Op.in]: ['production_issue', 'production_completion'] }, reference_id: { [Op.in]: productionOrderIds } },
      { id: { [Op.in]: (await db.productionOrder.findAll({ where: { id: productionOrderIds, tenant_id: tenantId }, attributes: ['journal_entry_id'], transaction })).map(order => order.journal_entry_id).filter(Boolean) } }
    ] }, transaction, lock: transaction.LOCK.UPDATE
  }) : [];
  const journalIds = [...new Set([...saleJournals, ...productionJournals].map(journal => journal.id))];
  const payments = journalIds.length ? await db.payment.findAll({ where: { tenant_id: tenantId, journal_entry_id: { [Op.in]: journalIds } }, transaction, lock: transaction.LOCK.UPDATE }) : [];
  const paymentIds = payments.map(payment => payment.id);
  const allocations = paymentIds.length ? await db.paymentAllocation.findAll({ where: { payment_id: { [Op.in]: paymentIds } }, transaction, lock: transaction.LOCK.UPDATE }) : [];
  if (allocations.length) throw new AppError('This sale has allocated payments and cannot be edited safely', 409);

  const movementWhere = [{ reference_type: 'retail_sale', reference_id: sale.id }];
  if (productionOrderIds.length) movementWhere.push({ reference_type: 'production_order', reference_id: { [Op.in]: productionOrderIds } });
  const movements = await db.stockMovement.findAll({ where: { tenant_id: tenantId, [Op.or]: movementWhere }, transaction, lock: transaction.LOCK.UPDATE });
  await restoreStockForMovements(tenantId, movements, transaction);

  const productionBatchIds = [...new Set(movements.filter(movement => movement.reference_type === 'production_order' && movement.direction === 'in' && movement.batch_id).map(movement => movement.batch_id))];
  await db.inventoryDeficit.destroy({ where: { tenant_id: tenantId, production_order_id: { [Op.in]: productionOrderIds } }, transaction });
  await db.stockMovement.destroy({ where: { id: { [Op.in]: movements.map(movement => movement.id) } }, transaction });
  await db.retailSaleItemPackaging.destroy({ where: { retail_sale_item_id: { [Op.in]: saleItems.map(item => item.id) } }, transaction });
  await db.retailSaleItem.destroy({ where: { retail_sale_id: sale.id }, transaction });
  if (productionOrderIds.length) {
    await db.productionMaterial.destroy({ where: { production_order_id: { [Op.in]: productionOrderIds } }, transaction });
    await db.productionOutput.destroy({ where: { production_order_id: { [Op.in]: productionOrderIds } }, transaction });
    await db.productionOrder.destroy({ where: { id: { [Op.in]: productionOrderIds }, tenant_id: tenantId }, transaction });
  }
  if (paymentIds.length) {
    await db.paymentAllocation.destroy({ where: { payment_id: { [Op.in]: paymentIds } }, transaction });
    await db.payment.destroy({ where: { id: { [Op.in]: paymentIds }, tenant_id: tenantId }, transaction });
  }
  for (const journal of [...saleJournals, ...productionJournals]) await removeJournal(tenantId, journal.id, sale.created_by, transaction);
  if (productionBatchIds.length) {
    const remainingReferences = await db.stockMovement.count({ where: { tenant_id: tenantId, batch_id: { [Op.in]: productionBatchIds } }, transaction });
    if (!remainingReferences) await db.stockBatch.destroy({ where: { tenant_id: tenantId, id: { [Op.in]: productionBatchIds } }, transaction });
  }
};

const saveSale = async (req, res, next, isEdit = false) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { items = [], customer_id = null, notes, allow_negative_materials = false, exchange_return_id = null, order_discount_amount } = req.body;
    const existingSale = isEdit ? await db.retailSale.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE }) : null;
    if (isEdit && !existingSale) throw new AppError('Sale not found', 404);
    if (isEdit) await removeSaleDataForRebuild(req.tenantId, existingSale, transaction);
    const businessDay = isEdit && existingSale.business_day_id
      ? await db.businessDay.findOne({ where: { id: existingSale.business_day_id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE })
      : await businessDays.requireOpen(req.tenantId, transaction);
    if (!businessDay) throw new AppError('The sale business day no longer exists', 409);
    const sale_date = isEdit ? existingSale.sale_date : businessDay.business_date;
    if (customer_id) {
      const customer = await db.customer.findOne({ where: { id: customer_id, tenant_id: req.tenantId, is_active: true }, transaction });
      if (!customer) throw new AppError('Customer not found', 400);
    }
    if (exchange_return_id) {
      const exchangeReturn = await db.salesReturn.findOne({ where: { id: exchange_return_id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!exchangeReturn) throw new AppError('Exchange return not found', 400);
      const originalSale = await db.retailSale.findOne({ where: { id: exchangeReturn.retail_sale_id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!originalSale) throw new AppError('Original exchange sale not found', 409);
      if ((originalSale.customer_id || null) !== (customer_id || null)) throw new AppError('Replacement sale customer must match the original sale', 400);
      const existingExchange = await db.retailSale.findOne({ where: { tenant_id: req.tenantId, exchange_return_id }, transaction, lock: transaction.LOCK.UPDATE });
      if (existingExchange) throw new AppError(`Return ${exchangeReturn.return_number} is already linked to exchange sale ${existingExchange.sale_number}`, 409);
    }
    const preview = await buildPreview(req.tenantId, items, transaction);
    if (preview.requires_negative_confirmation && !allow_negative_materials) {
      await transaction.rollback();
      return res.status(409).json({ success: false, code: 'NEGATIVE_STOCK_CONFIRMATION_REQUIRED', message: 'Confirm the material shortages to complete this sale', preview, shortages: preview.shortages });
    }
    const saleNumber = isEdit ? null : await saleNumbers.nextRetailSaleNumber({ tenantId: req.tenantId, saleDate: sale_date, transaction });
    const hasFixedOrderDiscount = order_discount_amount !== undefined && order_discount_amount !== null;
    const fixedLineDiscounts = hasFixedOrderDiscount
      ? allocateFixedDiscount(items.map(row => accounting.money(number(row.quantity) * number(row.unit_price))), order_discount_amount)
      : null;
    let subtotal = 0, discountAmount = 0, taxAmount = 0;
    const calculated = items.map((row, index) => {
      const quantity = number(row.quantity), price = number(row.unit_price), discountPct = number(row.discount_pct), taxRate = number(row.tax_rate);
      if (price < 0) throw new AppError('Sale price cannot be negative', 400);
      if (discountPct < 0 || discountPct > 100 || taxRate < 0 || taxRate > 100) throw new AppError('Discount and tax rates must be between 0 and 100', 400);
      const base = accounting.money(quantity * price), discount = hasFixedOrderDiscount ? fixedLineDiscounts[index] : accounting.money(base * discountPct / 100), taxable = accounting.money(base - discount), tax = accounting.money(taxable * taxRate / 100);
      subtotal += base; discountAmount += discount; taxAmount += tax;
      const previewLine = preview.lines[index];
      return { ...row, item_type: previewLine.item_type, line_number: index + 1, fulfillment_mode: previewLine.fulfillment_mode, measurement_source_type: previewLine.measurement_source_type, measurement_source_id: previewLine.measurement_source_id, source_quantity: previewLine.source_quantity, exclude_formula_packaging: previewLine.exclude_formula_packaging, fill_quantity_ml: previewLine.fill_quantity_ml, pack_count: previewLine.pack_count, packing_kit: previewLine.packing_kit, sale_packaging: previewLine.sale_packaging, quantity, unit_price: price, discount_pct: hasFixedOrderDiscount && base ? accounting.money(discount / base * 100) : discountPct, tax_rate: taxRate, tax_amount: tax, total: accounting.money(taxable + tax) };
    });
    subtotal = accounting.money(subtotal); discountAmount = accounting.money(discountAmount); taxAmount = accounting.money(taxAmount);
    const totalAmount = accounting.money(subtotal - discountAmount + taxAmount);
    const paymentSplits = await accounting.resolvePaymentSplits(req.tenantId, req.body, totalAmount, transaction);
    const primaryPayment = paymentSplits[0];
    const sale = isEdit
      ? existingSale
      : await db.retailSale.create({ tenant_id: req.tenantId, business_day_id: businessDay.id, exchange_return_id, sale_number: saleNumber, sale_date, customer_id, payment_account_id: primaryPayment.method.account.id, payment_method_id: primaryPayment.method.id, notes, subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total_amount: totalAmount, created_by: req.user.id }, { transaction });
    if (isEdit) await sale.update({ customer_id, payment_account_id: primaryPayment.method.account.id, payment_method_id: primaryPayment.method.id, notes, subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total_amount: totalAmount, cogs_amount: 0, journal_entry_id: null, cogs_journal_id: null }, { transaction });
    let cogs = 0, rawInventoryCost = 0, packagingInventoryCost = 0, finishedInventoryCost = 0;
    for (const line of calculated) {
      const variant = line.item_type === 'packaging_material' ? null : await loadVariant(req.tenantId, line.finished_good_id, transaction);
      let lineCost = 0, productionOrderId = null;
      if (line.item_type === 'packaging_material') {
        lineCost = (await consumeMaterialStock({ tenantId: req.tenantId, saleId: sale.id, materialType: 'packaging', materialId: line.packaging_material_id, quantity: line.quantity, createdBy: req.user.id, transaction })).totalCost;
      } else if (line.measurement_source_type === 'raw_material') {
        lineCost = (await consumeMaterialStock({ tenantId: req.tenantId, saleId: sale.id, materialType: 'raw', materialId: line.measurement_source_id, quantity: line.source_quantity, createdBy: req.user.id, transaction })).totalCost;
      } else if (line.fulfillment_mode === 'make_now') {
        const made = await production.createInstantProduction({ tenantId: req.tenantId, retailSaleId: sale.id, variant, quantity: line.quantity, saleDate: sale_date, lineNumber: line.line_number, createdBy: req.user.id, transaction, excludePackaging: line.exclude_formula_packaging });
        productionOrderId = made.order.id;
        if (!made.batch || number(made.batch.remaining_qty) < line.quantity) throw new AppError('Created production batch could not fulfill the sale', 500);
        lineCost = line.quantity * number(made.batch.cost_per_unit);
        await made.batch.update({ remaining_qty: number(made.batch.remaining_qty) - line.quantity }, { transaction });
        await variant.reload({ transaction, include: [], lock: transaction.LOCK.UPDATE });
        await variant.update({ current_stock: number(variant.current_stock) - line.quantity }, { transaction });
        await db.stockMovement.create({ tenant_id: req.tenantId, material_type: 'finished', material_id: variant.id, movement_type: 'sale', direction: 'out', quantity: line.quantity, batch_id: made.batch.id, unit_cost: made.batch.cost_per_unit, total_cost: lineCost, reference_type: 'retail_sale', reference_id: sale.id, notes: 'Create Now batch sold immediately', created_by: req.user.id }, { transaction });
      } else {
        lineCost = await consumeStockLine({ tenantId: req.tenantId, saleId: sale.id, variant, line, createdBy: req.user.id, transaction });
      }
      const sourceCost = lineCost;
      let packagingCost = 0;
      const consumedPackaging = [];
      for (const pkg of line.sale_packaging || []) {
        const consumed = await consumeMaterialStock({ tenantId: req.tenantId, saleId: sale.id, materialType: 'packaging', materialId: pkg.id, quantity: pkg.quantity, createdBy: req.user.id, transaction });
        packagingCost += consumed.totalCost;
        consumedPackaging.push({ ...pkg, material: consumed.material, totalCost: consumed.totalCost });
      }
      lineCost += packagingCost;
      if (line.item_type === 'packaging_material') packagingInventoryCost += accounting.money(sourceCost);
      else if (line.measurement_source_type === 'raw_material') rawInventoryCost += accounting.money(sourceCost);
      else finishedInventoryCost += accounting.money(sourceCost);
      packagingInventoryCost += accounting.money(packagingCost);
      const saleItem = await db.retailSaleItem.create({
        retail_sale_id: sale.id, item_type: line.item_type, finished_good_id: line.finished_good_id || null,
        packaging_material_id: line.packaging_material_id || null, fulfillment_mode: line.fulfillment_mode,
        production_order_id: productionOrderId, quantity: line.quantity, unit_price: line.unit_price,
        discount_pct: line.discount_pct, tax_rate: line.tax_rate, tax_amount: line.tax_amount, total: line.total,
        cost_amount: lineCost, fill_quantity_ml: line.fill_quantity_ml, pack_count: line.pack_count,
        packing_kit_id: line.packing_kit?.id || null, packaging_cost_amount: packagingCost,
        measurement_source_type: line.measurement_source_type, measurement_source_id: line.measurement_source_id,
        measurement_source_quantity: line.source_quantity || (line.measurement_source_type === 'bulk_stock' ? line.quantity : null)
      }, { transaction });
      if (consumedPackaging.length) await db.retailSaleItemPackaging.bulkCreate(consumedPackaging.map(pkg => ({
        retail_sale_item_id: saleItem.id, packing_kit_id: line.packing_kit?.id || null,
        packaging_material_id: pkg.id, material_name: pkg.material.name, quantity: pkg.quantity,
        unit_cost: pkg.quantity ? pkg.totalCost / pkg.quantity : 0, total_cost: pkg.totalCost
      })), { transaction });
    }
    rawInventoryCost = accounting.money(rawInventoryCost);
    packagingInventoryCost = accounting.money(packagingInventoryCost);
    finishedInventoryCost = accounting.money(finishedInventoryCost);
    cogs = accounting.money(rawInventoryCost + packagingInventoryCost + finishedInventoryCost);
    const accounts = await accounting.getAccountsByCode(req.tenantId, [
      ACCOUNT_CODES.SALES_REVENUE,
      ACCOUNT_CODES.COGS,
      ACCOUNT_CODES.FG_INVENTORY,
      ACCOUNT_CODES.RAW_INVENTORY,
      ACCOUNT_CODES.PKG_INVENTORY,
      ACCOUNT_CODES.TAX_PAYABLE,
      ...(discountAmount > 0 ? [ACCOUNT_CODES.DISCOUNT_ALLOWED] : [])
    ], transaction);
    const revenueJournal = await accounting.createAndPost(req.tenantId, { entry_date: sale_date, reference_type: 'retail_sale_revenue', reference_id: sale.id, narration: 'Retail sale revenue', lines: [
      ...paymentSplits.map(split => ({ account_id: split.method.account.id, debit_amount: split.amount, description: `${split.method.name} received for ${sale.sale_number}` })),
      ...(discountAmount ? [{ account_id: accounts[ACCOUNT_CODES.DISCOUNT_ALLOWED].id, debit_amount: discountAmount, description: `Discount allowed on ${sale.sale_number}` }] : []),
      { account_id: accounts[ACCOUNT_CODES.SALES_REVENUE].id, credit_amount: subtotal, description: `Retail sale ${sale.sale_number}` },
      ...(taxAmount ? [{ account_id: accounts[ACCOUNT_CODES.TAX_PAYABLE].id, credit_amount: taxAmount, description: `Tax on ${sale.sale_number}` }] : [])
    ] }, req.user.id, transaction);
    const cogsJournal = cogs ? await accounting.createAndPost(req.tenantId, { entry_date: sale_date, reference_type: 'retail_sale_cogs', reference_id: sale.id, narration: 'Retail sale cost of goods sold', lines: [
      { account_id: accounts[ACCOUNT_CODES.COGS].id, debit_amount: cogs, description: `COGS for ${sale.sale_number}` },
      ...(finishedInventoryCost ? [{ account_id: accounts[ACCOUNT_CODES.FG_INVENTORY].id, credit_amount: accounting.money(finishedInventoryCost), description: `Finished inventory sold on ${sale.sale_number}` }] : []),
      ...(rawInventoryCost ? [{ account_id: accounts[ACCOUNT_CODES.RAW_INVENTORY].id, credit_amount: accounting.money(rawInventoryCost), description: `Measured raw material sold on ${sale.sale_number}` }] : []),
      ...(packagingInventoryCost ? [{ account_id: accounts[ACCOUNT_CODES.PKG_INVENTORY].id, credit_amount: accounting.money(packagingInventoryCost), description: `Packing kit used on ${sale.sale_number}` }] : [])
    ] }, req.user.id, transaction) : null;
    if (db.sequelize.getDialect() === 'postgres') await db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: `${req.tenantId}:payment:incoming` }, transaction });
    const paymentSequence = await db.payment.count({ where: { tenant_id: req.tenantId, payment_type: 'incoming' }, transaction }) + 1;
    const paymentRecords = [];
    for (const [index, split] of paymentSplits.entries()) {
      paymentRecords.push(await db.payment.create({ tenant_id: req.tenantId, business_day_id: businessDay.id, payment_number: `PAY-IN-${new Date(sale_date).getFullYear()}-${String(paymentSequence + index).padStart(4, '0')}`, payment_type: 'incoming', party_type: 'customer', party_id: customer_id, payment_method_id: split.method.id, payment_mode: accounting.paymentModeForType(split.method.method_type), bank_account_id: split.method.account.id, amount: split.amount, payment_date: sale_date, notes: `Retail sale ${sale.sale_number}`, journal_entry_id: revenueJournal.id, created_by: req.user.id }, { transaction }));
    }
    await sale.update({ cogs_amount: cogs, journal_entry_id: revenueJournal.id, cogs_journal_id: cogsJournal?.id || null }, { transaction });
    await transaction.commit();
    // Send only after the database transaction succeeds; provider failures do
    // not undo a sale, inventory movement, payment, or journal entry.
    const [customer, tenant] = await Promise.all([
      customer_id ? db.customer.findOne({ where: { id: customer_id, tenant_id: req.tenantId } }) : null,
      db.tenant.findByPk(req.tenantId),
    ]);
    const whatsapp = isEdit ? { attempted: false, status: 'not_sent_for_update' } : await invoiceWhatsapp.sendInvoice({ sale: sale.toJSON(), customer, tenant });
    if (whatsapp.status === 'failed') console.error(`Invoice WhatsApp send failed for ${sale.sale_number}: ${whatsapp.reason}`);
    res.status(isEdit ? 200 : 201).json({ ...sale.toJSON(), payment_id: paymentRecords[0].id, payment_ids: paymentRecords.map(record => record.id), whatsapp });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
};

exports.create = (req, res, next) => saveSale(req, res, next, false);
exports.update = (req, res, next) => saveSale(req, res, next, true);

exports.buildPreview = buildPreview;
exports.fulfillmentModeForVariant = fulfillmentModeForVariant;
exports.addReturnSummary = addReturnSummary;
exports.mlToMaterialQuantity = mlToMaterialQuantity;
exports.packingKitSupportsFill = packingKitSupportsFill;
