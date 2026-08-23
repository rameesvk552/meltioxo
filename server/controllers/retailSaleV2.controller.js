const db = require('../models');
const { AppError } = require('../middleware/errorHandler');
const accounting = require('../services/accounting.service');
const production = require('../services/production.service');
const businessDays = require('../services/businessDay.service');
const { ACCOUNT_CODES } = require('../config/constants');

const number = value => Number(value || 0);
const fulfillmentModeForVariant = variant => variant?.source_type === 'ready_made' ? 'stock' : 'make_now';

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
  const lines = [];
  const combined = new Map();
  for (const [index, row] of items.entries()) {
    const quantity = number(row.quantity);
    if (!row.finished_good_id || quantity <= 0) throw new AppError(`Sale item ${index + 1} requires a product and positive quantity`, 400);
    const variant = await loadVariant(tenantId, row.finished_good_id, transaction);
    if (!variant || !variant.product || !variant.product.is_active) throw new AppError('Select an active product variant', 400);
    if (variant.product.sell_by_measurement) {
      const minimum = number(variant.product.measurement_min_qty || 1);
      const step = number(variant.product.measurement_step || 1);
      const steps = (quantity - minimum) / step;
      if (quantity < minimum || Math.abs(steps - Math.round(steps)) > 0.000001) {
        throw new AppError(`${variant.product.name} must be sold from ${minimum} ml in steps of ${step} ml`, 400);
      }
    }
    const fulfillmentMode = fulfillmentModeForVariant(variant);
    const line = {
      index,
      finished_good_id: variant.id,
      product_name: variant.product.name,
      variant_name: variant.size_label || variant.name,
      sku: variant.sku,
      fill_quantity_ml: number(variant.fill_quantity_ml),
      quantity,
      fulfillment_mode: fulfillmentMode,
      finished_stock: number(variant.current_stock),
      formula: null,
      packaging: [],
      materials: []
    };
    if (fulfillmentMode === 'stock') {
      line.is_available = number(variant.current_stock) >= quantity;
      if (!line.is_available) line.finished_shortage = quantity - number(variant.current_stock);
      lines.push(line);
      continue;
    }
    const formulaId = production.resolveVariantFormulaId(variant);
    const formula = formulaId ? await db.formula.findOne({ where: { id: formulaId, tenant_id: tenantId, is_active: true }, include: [db.formulaIngredient], transaction }) : null;
    if (!formula || !formula.formulaIngredients.length) throw new AppError(`${variant.name} is missing an active formula with ingredients`, 400);
    if (!variant.product.sell_by_measurement && !variant.variantPackagings.length) throw new AppError(`${variant.name} is missing its packaging BOM`, 400);
    line.formula = { id: formula.id, name: formula.name, inherited: !variant.formula_id || variant.formula_id === variant.product.formula_id };
    line.packaging = variant.variantPackagings.map(pkg => ({ id: pkg.packaging_material_id, name: pkg.packagingMaterial?.name || 'Packaging', quantity: number(pkg.quantity) * quantity }));
    const requirements = production.combineMaterialRequirements(await production.calculateMaterialRequirements(tenantId, formula.id, quantity, variant.id, transaction));
    requirements.forEach(req => {
      const key = `${req.material_type}:${req.material_id}`;
      const current = combined.get(key) || { ...req, required_qty: 0 };
      current.required_qty += number(req.required_qty);
      combined.set(key, current);
    });
    line.materials = requirements;
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
  const stockShortages = lines.filter(line => line.fulfillment_mode === 'stock' && !line.is_available).map(line => ({ finished_good_id: line.finished_good_id, name: `${line.product_name} ${line.variant_name}`, shortage_qty: line.finished_shortage }));
  return { lines, materials, shortages: materials.filter(row => row.shortage_qty > 0), stock_shortages: stockShortages, requires_negative_confirmation: materials.some(row => row.shortage_qty > 0) };
};

const saleInclude = [
  db.customer,
  db.paymentMethod,
  { model: db.account, as: 'paymentAccount' },
  { model: db.retailSaleItem, include: [
    { model: db.finishedGood, include: [db.product] },
    { model: db.productionOrder, include: [db.formula, db.productionMaterial, db.inventoryDeficit] }
  ] }
];
const saleListInclude = [db.customer, db.retailSaleItem, db.paymentMethod, { model: db.account, as: 'paymentAccount' }];

const enrichSaleMaterials = async (tenantId, sale) => {
  const data = sale.toJSON();
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
  try { res.json(await db.retailSale.findAll({ where: { tenant_id: req.tenantId }, include: saleListInclude, order: [['sale_date', 'DESC'], ['created_at', 'DESC']] })); } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const sale = await db.retailSale.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, include: saleInclude });
    if (!sale) throw new AppError('Sale not found', 404);
    res.json(await enrichSaleMaterials(req.tenantId, sale));
  } catch (error) { next(error); }
};

exports.preview = async (req, res, next) => {
  try { res.json(await buildPreview(req.tenantId, req.body.items)); } catch (error) { next(error); }
};

const consumeStockLine = async ({ tenantId, saleId, variant, line, createdBy, transaction }) => {
  if (number(variant.current_stock) < line.quantity) throw new AppError('Insufficient finished-goods stock', 400);
  let remaining = line.quantity, lineCost = 0;
  const batches = await db.stockBatch.findAll({ where: { tenant_id: tenantId, material_type: 'finished', material_id: variant.id }, order: [['received_date', 'ASC'], ['created_at', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
  for (const batch of batches) {
    if (remaining <= 0) break;
    const taken = Math.min(remaining, number(batch.remaining_qty));
    if (!taken) continue;
    const cost = taken * number(batch.cost_per_unit);
    await batch.update({ remaining_qty: number(batch.remaining_qty) - taken }, { transaction });
    await db.stockMovement.create({ tenant_id: tenantId, material_type: 'finished', material_id: variant.id, movement_type: 'sale', direction: 'out', quantity: taken, batch_id: batch.id, unit_cost: batch.cost_per_unit, total_cost: cost, reference_type: 'retail_sale', reference_id: saleId, created_by: createdBy }, { transaction });
    remaining -= taken; lineCost += cost;
  }
  if (remaining > 0.0001) throw new AppError(`No costed stock batches available for ${variant.name}`, 400);
  await variant.update({ current_stock: number(variant.current_stock) - line.quantity }, { transaction });
  return lineCost;
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { items = [], customer_id = null, notes, allow_negative_materials = false } = req.body;
    const businessDay = await businessDays.requireOpen(req.tenantId, transaction);
    const sale_date = businessDay.business_date;
    if (customer_id) {
      const customer = await db.customer.findOne({ where: { id: customer_id, tenant_id: req.tenantId, is_active: true }, transaction });
      if (!customer) throw new AppError('Customer not found', 400);
    }
    const preview = await buildPreview(req.tenantId, items, transaction);
    if (preview.stock_shortages.length) throw new AppError(`Insufficient finished stock for ${preview.stock_shortages.map(row => row.name).join(', ')}`, 400);
    if (preview.requires_negative_confirmation && !allow_negative_materials) {
      await transaction.rollback();
      return res.status(409).json({ success: false, code: 'NEGATIVE_STOCK_CONFIRMATION_REQUIRED', message: 'Confirm the material shortages to complete this sale', preview, shortages: preview.shortages });
    }
    const sequence = await db.retailSale.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    let subtotal = 0, discountAmount = 0, taxAmount = 0;
    const calculated = items.map((row, index) => {
      const quantity = number(row.quantity), price = number(row.unit_price), discountPct = number(row.discount_pct), taxRate = number(row.tax_rate);
      if (price < 0) throw new AppError('Sale price cannot be negative', 400);
      if (discountPct < 0 || discountPct > 100 || taxRate < 0 || taxRate > 100) throw new AppError('Discount and tax rates must be between 0 and 100', 400);
      const base = accounting.money(quantity * price), discount = accounting.money(base * discountPct / 100), taxable = accounting.money(base - discount), tax = accounting.money(taxable * taxRate / 100);
      subtotal += base; discountAmount += discount; taxAmount += tax;
      return { ...row, line_number: index + 1, fulfillment_mode: preview.lines[index].fulfillment_mode, quantity, unit_price: price, discount_pct: discountPct, tax_rate: taxRate, tax_amount: tax, total: accounting.money(taxable + tax) };
    });
    subtotal = accounting.money(subtotal); discountAmount = accounting.money(discountAmount); taxAmount = accounting.money(taxAmount);
    const totalAmount = accounting.money(subtotal - discountAmount + taxAmount);
    const paymentSplits = await accounting.resolvePaymentSplits(req.tenantId, req.body, totalAmount, transaction);
    const primaryPayment = paymentSplits[0];
    const sale = await db.retailSale.create({ tenant_id: req.tenantId, business_day_id: businessDay.id, sale_number: `RS-${new Date(sale_date).getFullYear()}-${String(sequence).padStart(4, '0')}`, sale_date, customer_id, payment_account_id: primaryPayment.method.account.id, payment_method_id: primaryPayment.method.id, notes, subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total_amount: totalAmount, created_by: req.user.id }, { transaction });
    let cogs = 0;
    for (const line of calculated) {
      const variant = await loadVariant(req.tenantId, line.finished_good_id, transaction);
      let lineCost = 0, productionOrderId = null;
      if (line.fulfillment_mode === 'make_now') {
        const made = await production.createInstantProduction({ tenantId: req.tenantId, retailSaleId: sale.id, variant, quantity: line.quantity, saleDate: sale_date, lineNumber: line.line_number, createdBy: req.user.id, transaction });
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
      await db.retailSaleItem.create({ retail_sale_id: sale.id, finished_good_id: line.finished_good_id, fulfillment_mode: line.fulfillment_mode, production_order_id: productionOrderId, quantity: line.quantity, unit_price: line.unit_price, discount_pct: line.discount_pct, tax_rate: line.tax_rate, tax_amount: line.tax_amount, total: line.total, cost_amount: lineCost }, { transaction });
      cogs += accounting.money(lineCost);
    }
    cogs = accounting.money(cogs);
    const accounts = await accounting.getAccountsByCode(req.tenantId, [ACCOUNT_CODES.SALES_REVENUE, ACCOUNT_CODES.COGS, ACCOUNT_CODES.FG_INVENTORY, ACCOUNT_CODES.TAX_PAYABLE], transaction);
    const revenueJournal = await accounting.createAndPost(req.tenantId, { entry_date: sale_date, reference_type: 'retail_sale_revenue', reference_id: sale.id, narration: 'Retail sale revenue', lines: [
      ...paymentSplits.map(split => ({ account_id: split.method.account.id, debit_amount: split.amount, description: `${split.method.name} received for ${sale.sale_number}` })),
      { account_id: accounts[ACCOUNT_CODES.SALES_REVENUE].id, credit_amount: subtotal - discountAmount, description: `Retail sale ${sale.sale_number}` },
      ...(taxAmount ? [{ account_id: accounts[ACCOUNT_CODES.TAX_PAYABLE].id, credit_amount: taxAmount, description: `Tax on ${sale.sale_number}` }] : [])
    ] }, req.user.id, transaction);
    const cogsJournal = cogs ? await accounting.createAndPost(req.tenantId, { entry_date: sale_date, reference_type: 'retail_sale_cogs', reference_id: sale.id, narration: 'Retail sale cost of goods sold', lines: [
      { account_id: accounts[ACCOUNT_CODES.COGS].id, debit_amount: cogs, description: `COGS for ${sale.sale_number}` },
      { account_id: accounts[ACCOUNT_CODES.FG_INVENTORY].id, credit_amount: cogs, description: `COGS for ${sale.sale_number}` }
    ] }, req.user.id, transaction) : null;
    if (db.sequelize.getDialect() === 'postgres') await db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: `${req.tenantId}:payment:incoming` }, transaction });
    const paymentSequence = await db.payment.count({ where: { tenant_id: req.tenantId, payment_type: 'incoming' }, transaction }) + 1;
    const paymentRecords = [];
    for (const [index, split] of paymentSplits.entries()) {
      paymentRecords.push(await db.payment.create({ tenant_id: req.tenantId, business_day_id: businessDay.id, payment_number: `PAY-IN-${new Date(sale_date).getFullYear()}-${String(paymentSequence + index).padStart(4, '0')}`, payment_type: 'incoming', party_type: 'customer', party_id: customer_id, payment_method_id: split.method.id, payment_mode: accounting.paymentModeForType(split.method.method_type), bank_account_id: split.method.account.id, amount: split.amount, payment_date: sale_date, notes: `Retail sale ${sale.sale_number}`, journal_entry_id: revenueJournal.id, created_by: req.user.id }, { transaction }));
    }
    await sale.update({ cogs_amount: cogs, journal_entry_id: revenueJournal.id, cogs_journal_id: cogsJournal?.id || null }, { transaction });
    await transaction.commit();
    res.status(201).json({ ...sale.toJSON(), payment_id: paymentRecords[0].id, payment_ids: paymentRecords.map(record => record.id) });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
};

exports.buildPreview = buildPreview;
exports.fulfillmentModeForVariant = fulfillmentModeForVariant;
