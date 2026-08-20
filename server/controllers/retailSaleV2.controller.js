const db = require('../models');
const { AppError } = require('../middleware/errorHandler');
const accounting = require('../services/accounting.service');
const production = require('../services/production.service');

const number = value => Number(value || 0);
const today = () => new Date().toISOString().slice(0, 10);
const modeOf = row => row.fulfillment_mode === 'make_now' ? 'make_now' : 'stock';

const loadVariant = (tenantId, id, transaction) => db.finishedGood.findOne({
  where: { id, tenant_id: tenantId, is_active: true },
  include: [
    { model: db.product, include: [db.formula] },
    db.formula,
    { model: db.variantPackaging, include: [db.packagingMaterial] }
  ],
  transaction,
  ...(transaction ? { lock: transaction.LOCK.UPDATE } : {})
});

const buildPreview = async (tenantId, items, transaction) => {
  if (!Array.isArray(items) || !items.length) throw new AppError('A retail sale needs at least one item', 400);
  const lines = [];
  const combined = new Map();
  for (const [index, row] of items.entries()) {
    const quantity = number(row.quantity);
    if (!row.finished_good_id || quantity <= 0) throw new AppError(`Sale item ${index + 1} requires a product and positive quantity`, 400);
    if (row.fulfillment_mode && !['stock', 'make_now'].includes(row.fulfillment_mode)) throw new AppError('Invalid fulfillment mode', 400);
    const variant = await loadVariant(tenantId, row.finished_good_id, transaction);
    if (!variant || !variant.product || !variant.product.is_active) throw new AppError('Select an active product variant', 400);
    const fulfillmentMode = modeOf(row);
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
    if (!variant.variantPackagings.length) throw new AppError(`${variant.name} is missing its packaging BOM`, 400);
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
  if (remaining > 0.0001) throw new AppError(`No costed production batches available for ${variant.name}`, 400);
  await variant.update({ current_stock: number(variant.current_stock) - line.quantity }, { transaction });
  return lineCost;
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { items = [], customer_id = null, sale_date = today(), notes, allow_negative_materials = false } = req.body;
    if (String(sale_date).slice(0, 10) > today()) throw new AppError('Future-dated sales are not allowed', 400);
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
    const method = await accounting.resolvePaymentMethod(req.tenantId, req.body, transaction);
    const paymentAccount = method.account;
    const sequence = await db.retailSale.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    let subtotal = 0, discountAmount = 0, taxAmount = 0;
    const calculated = items.map((row, index) => {
      const quantity = number(row.quantity), price = number(row.unit_price), discountPct = number(row.discount_pct), taxRate = number(row.tax_rate);
      if (price < 0) throw new AppError('Sale price cannot be negative', 400);
      if (discountPct < 0 || discountPct > 100 || taxRate < 0 || taxRate > 100) throw new AppError('Discount and tax rates must be between 0 and 100', 400);
      const base = accounting.money(quantity * price), discount = accounting.money(base * discountPct / 100), taxable = accounting.money(base - discount), tax = accounting.money(taxable * taxRate / 100);
      subtotal += base; discountAmount += discount; taxAmount += tax;
      return { ...row, line_number: index + 1, fulfillment_mode: modeOf(row), quantity, unit_price: price, discount_pct: discountPct, tax_rate: taxRate, tax_amount: tax, total: accounting.money(taxable + tax) };
    });
    subtotal = accounting.money(subtotal); discountAmount = accounting.money(discountAmount); taxAmount = accounting.money(taxAmount);
    const sale = await db.retailSale.create({ tenant_id: req.tenantId, sale_number: `RS-${new Date(sale_date).getFullYear()}-${String(sequence).padStart(4, '0')}`, sale_date, customer_id, payment_account_id: paymentAccount.id, payment_method_id: method.id, notes, subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total_amount: accounting.money(subtotal - discountAmount + taxAmount), created_by: req.user.id }, { transaction });
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
        await variant.reload({ transaction, lock: transaction.LOCK.UPDATE });
        await variant.update({ current_stock: number(variant.current_stock) - line.quantity }, { transaction });
        await db.stockMovement.create({ tenant_id: req.tenantId, material_type: 'finished', material_id: variant.id, movement_type: 'sale', direction: 'out', quantity: line.quantity, batch_id: made.batch.id, unit_cost: made.batch.cost_per_unit, total_cost: lineCost, reference_type: 'retail_sale', reference_id: sale.id, notes: 'Create Now batch sold immediately', created_by: req.user.id }, { transaction });
      } else {
        lineCost = await consumeStockLine({ tenantId: req.tenantId, saleId: sale.id, variant, line, createdBy: req.user.id, transaction });
      }
      await db.retailSaleItem.create({ retail_sale_id: sale.id, finished_good_id: line.finished_good_id, fulfillment_mode: line.fulfillment_mode, production_order_id: productionOrderId, quantity: line.quantity, unit_price: line.unit_price, discount_pct: line.discount_pct, tax_rate: line.tax_rate, tax_amount: line.tax_amount, total: line.total, cost_amount: lineCost }, { transaction });
      cogs += accounting.money(lineCost);
    }
    cogs = accounting.money(cogs);
    const accounts = await accounting.getAccountsByCode(req.tenantId, ['4000', '5000', '1300', '2100'], transaction);
    const revenueJournal = await accounting.createAndPost(req.tenantId, { entry_date: sale_date, reference_type: 'retail_sale_revenue', reference_id: sale.id, narration: 'Retail sale revenue', lines: [
      { account_id: paymentAccount.id, debit_amount: number(sale.total_amount), description: `Retail sale ${sale.sale_number}` },
      { account_id: accounts['4000'].id, credit_amount: subtotal - discountAmount, description: `Retail sale ${sale.sale_number}` },
      ...(taxAmount ? [{ account_id: accounts['2100'].id, credit_amount: taxAmount, description: `Tax on ${sale.sale_number}` }] : [])
    ] }, req.user.id, transaction);
    const cogsJournal = cogs ? await accounting.createAndPost(req.tenantId, { entry_date: sale_date, reference_type: 'retail_sale_cogs', reference_id: sale.id, narration: 'Retail sale cost of goods sold', lines: [
      { account_id: accounts['5000'].id, debit_amount: cogs, description: `COGS for ${sale.sale_number}` },
      { account_id: accounts['1300'].id, credit_amount: cogs, description: `COGS for ${sale.sale_number}` }
    ] }, req.user.id, transaction) : null;
    if (db.sequelize.getDialect() === 'postgres') await db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: `${req.tenantId}:payment:incoming` }, transaction });
    const paymentSequence = await db.payment.count({ where: { tenant_id: req.tenantId, payment_type: 'incoming' }, transaction }) + 1;
    const paymentRecord = await db.payment.create({ tenant_id: req.tenantId, payment_number: `PAY-IN-${new Date(sale_date).getFullYear()}-${String(paymentSequence).padStart(4, '0')}`, payment_type: 'incoming', party_type: 'customer', party_id: customer_id, payment_method_id: method.id, payment_mode: accounting.paymentModeForType(method.method_type), bank_account_id: paymentAccount.id, amount: sale.total_amount, payment_date: sale_date, notes: `Retail sale ${sale.sale_number}`, journal_entry_id: revenueJournal.id, created_by: req.user.id }, { transaction });
    await sale.update({ cogs_amount: cogs, journal_entry_id: revenueJournal.id, cogs_journal_id: cogsJournal?.id || null }, { transaction });
    await transaction.commit();
    res.status(201).json({ ...sale.toJSON(), payment_id: paymentRecord.id });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
};

exports.buildPreview = buildPreview;
