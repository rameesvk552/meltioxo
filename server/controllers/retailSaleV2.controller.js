const db = require('../models');
const { Op } = db.Sequelize;
const { AppError } = require('../middleware/errorHandler');
const accounting = require('../services/accounting.service');
const production = require('../services/production.service');
const businessDays = require('../services/businessDay.service');
const storeCredit = require('../services/storeCredit.service');
const saleNumbers = require('../services/saleNumber.service');
const invoiceWhatsapp = require('../services/invoiceWhatsapp.service');
const incentives = require('../services/incentive.service');
const compositionLevy = require('../services/compositionLevy.service');
const gst = require('../services/gst.service');
const { ACCOUNT_CODES } = require('../config/constants');

const number = value => Number(value || 0);


exports.getCompositionLevy = async (req, res, next) => {
  try {
    const indiaParts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
    const currentYear = Number(indiaParts.year), currentMonth = Number(indiaParts.month);
    const year = req.query.year === undefined ? currentYear : Number(req.query.year);
    const quarter = req.query.quarter === undefined ? Math.ceil(currentMonth / 3) : Number(req.query.quarter);
    if (!Number.isInteger(year) || year < 2017 || year > 2100 || !Number.isInteger(quarter) || quarter < 1 || quarter > 4) throw new AppError('Enter a valid year and quarter', 400);
    const tenantSettings = await db.tenant.findByPk(req.tenantId);
    if (!tenantSettings) throw new AppError('Company not found', 404);
    const { from, to } = compositionLevy.quarterDates(year, quarter);
    const [sales, returns] = await Promise.all([
      db.retailSale.findAll({ where: { tenant_id: req.tenantId, gst_scheme: 'COMPOSITION', sale_date: { [Op.between]: [from, to] } }, attributes: ['subtotal', 'discount_amount'] }),
      db.salesReturn.findAll({ where: { tenant_id: req.tenantId, return_date: { [Op.between]: [from, to] } }, attributes: ['subtotal', 'discount_amount'], include: [{ model: db.retailSale, required: true, attributes: [], where: { tenant_id: req.tenantId, gst_scheme: 'COMPOSITION' } }] })
    ]);
    res.json({ year, quarter, from, to, sale_count: sales.length, return_count: returns.length, ...compositionLevy.estimateLevy({ sales, returns, rate: tenantSettings.gst_composition_rate || 1 }), note: 'Estimate from POS composition sales and returns only. Reconcile other turnover, exempt sales, and GST portal figures before CMP-08.' });
  } catch (error) { next(error); }
};
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
        hsn_code: material.hsn_code || null,
        gst_rate: material.gst_rate,
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
      hsn_code: variant.product.hsn_code || null,
      gst_rate: variant.product.gst_rate,
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
      if (!selectedKit && settings.measured_packaging_required && matchingKits.length) {
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
  { model: db.user, as: 'salesperson', attributes: ['id', 'name', 'is_active'] },
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
  { model: db.user, as: 'salesperson', attributes: ['id', 'name', 'is_active'] },
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
  data.effective_incentive_amount = incentives.effectiveIncentive(data);
  return data;
};

const attachPayments = async (tenantId, sales) => {
  const data = sales.map(addReturnSummary);
  const journalIds = [...new Set(data.map(sale => sale.journal_entry_id).filter(Boolean))];
  if (!journalIds.length) return data;
  const payments = await db.payment.findAll({
    where: { tenant_id: tenantId, journal_entry_id: { [Op.in]: journalIds } },
    include: [db.paymentMethod],
    order: [['created_at', 'ASC']]
  });
  const paymentsByJournal = new Map();
  payments.forEach(payment => {
    const row = typeof payment.toJSON === 'function' ? payment.toJSON() : payment;
    const rows = paymentsByJournal.get(row.journal_entry_id) || [];
    rows.push(row);
    paymentsByJournal.set(row.journal_entry_id, rows);
  });
  return data.map(sale => ({ ...sale, payments: paymentsByJournal.get(sale.journal_entry_id) || [] }));
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
    res.json(await attachPayments(req.tenantId, sales));
  } catch (error) { next(error); }
};

exports.getSalespeople = async (req, res, next) => {
  try {
    const users = await db.user.findAll({ where: { tenant_id: req.tenantId, is_active: true }, attributes: ['id', 'name', 'role'], order: [['name', 'ASC']] });
    res.json(users);
  } catch (error) { next(error); }
};

exports.getIncentives = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) || (from && to && from > to)) throw new AppError('Enter a valid date range', 400);
    const where = { tenant_id: req.tenantId, salesperson_id: { [Op.ne]: null } };
    if (from || to) where.sale_date = { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lte]: to } : {}) };
    const sales = await db.retailSale.findAll({ where, include: [
      { model: db.user, as: 'salesperson', attributes: ['id', 'name'] },
      { model: db.salesReturn, as: 'salesReturns', attributes: ['subtotal', 'discount_amount', 'total_amount'] }
    ], order: [['sale_date', 'DESC'], ['created_at', 'DESC']] });
    const rows = sales.map(instance => {
      const sale = instance.toJSON();
      sale.returned_amount = accounting.money((sale.salesReturns || []).reduce((sum, row) => sum + number(row.total_amount), 0));
      sale.returned_revenue = accounting.money((sale.salesReturns || []).reduce((sum, row) => sum + number(row.subtotal) - number(row.discount_amount), 0));
      return { id: sale.id, sale_number: sale.sale_number, sale_date: sale.sale_date, salesperson_id: sale.salesperson_id, salesperson_name: sale.salesperson?.name || 'Inactive user', sale_amount: sale.total_amount, incentive_rate: sale.incentive_rate, incentive_amount: sale.incentive_amount, effective_incentive_amount: incentives.effectiveIncentive(sale) };
    });
    const byPerson = new Map();
    rows.forEach(row => {
      const current = byPerson.get(row.salesperson_id) || { salesperson_id: row.salesperson_id, salesperson_name: row.salesperson_name, sales: 0, incentive_amount: 0 };
      current.sales += 1;
      current.incentive_amount = accounting.money(current.incentive_amount + row.effective_incentive_amount);
      byPerson.set(row.salesperson_id, current);
    });
    res.json({ summary: [...byPerson.values()], sales: rows });
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
    const allocations = await db.paymentAllocation.findAll({ where: { invoice_type: 'retail_sale', invoice_id: sale.id } });
    const allocationTotal = allocations.reduce((sum, row) => sum + number(row.allocated_amount), 0);
    const originalPaymentTotal = data.payments.reduce((sum, row) => sum + number(row.amount), 0);
    data.paid_amount = accounting.money((allocations.length ? allocationTotal : originalPaymentTotal) + number(sale.store_credit_used));
    data.balance_due = accounting.money(Math.max(0, number(sale.total_amount) - number(data.returned_amount) - data.paid_amount));
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
  if (returnCount || sale.exchange_return_id || number(sale.store_credit_used) > 0) {
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
  const internal = Boolean(req.exchangeTransaction);
  const transaction = req.exchangeTransaction || await db.sequelize.transaction();
  try {
    const { items = [], customer_id = null, notes, allow_negative_materials = false, exchange_return_id = null, order_discount_amount } = req.body;
    if (exchange_return_id && !internal) throw new AppError('Post exchanges through the exchange action', 400);
    const storeCreditUsed = accounting.money(req.body.store_credit_used, 'Store credit used');
    if (storeCreditUsed < 0) throw new AppError('Store credit used cannot be negative', 400);
    if (isEdit && storeCreditUsed > 0) throw new AppError('Store credit cannot be added while editing a posted sale', 409);
    if (storeCreditUsed > 0 && !customer_id) throw new AppError('Select a customer to use store credit', 400);
    const creditSale = Boolean(req.body.credit_sale);
    const tenantSettings = await db.tenant.findByPk(req.tenantId, { transaction });
    const composition = tenantSettings?.tax_system === 'GST' && tenantSettings?.gst_scheme === 'COMPOSITION';
    if (creditSale && !tenantSettings?.credit_sales_enabled) throw new AppError('Credit sales are not enabled in Settings', 403);
    if (creditSale && !customer_id) throw new AppError('Select a customer for a credit sale', 400);
    const existingSale = isEdit ? await db.retailSale.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE }) : null;
    if (existingSale && (existingSale.gst_scheme || 'REGULAR') !== (composition ? 'COMPOSITION' : 'REGULAR')) throw new AppError('This sale was created under a different GST scheme and cannot be rebuilt. Issue a correction under the original scheme.', 409);
    if (isEdit && !existingSale) throw new AppError('Sale not found', 404);
    let salespersonId = null;
    let incentiveRate = 0;
    let incentiveBasis = null;
    if (tenantSettings?.incentive_enabled) {
      salespersonId = tenantSettings.incentive_salesperson_mode === 'SELECT'
        ? (req.body.salesperson_id || existingSale?.salesperson_id)
        : req.user.id;
      if (!salespersonId) throw new AppError('Select a salesperson for this sale', 400);
      const salesperson = await db.user.findOne({ where: { id: salespersonId, tenant_id: req.tenantId, is_active: true }, transaction });
      if (!salesperson) throw new AppError('Select an active salesperson from this company', 400);
      incentiveRate = number(tenantSettings.incentive_rate);
      incentiveBasis = tenantSettings.incentive_basis;
    } else if (existingSale?.salesperson_id) {
      salespersonId = existingSale.salesperson_id;
      incentiveRate = number(existingSale.incentive_rate);
      incentiveBasis = existingSale.incentive_basis;
    }
    if (isEdit) await removeSaleDataForRebuild(req.tenantId, existingSale, transaction);
    const businessDay = isEdit && existingSale.business_day_id
      ? await db.businessDay.findOne({ where: { id: existingSale.business_day_id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE })
      : await businessDays.requireOpen(req.tenantId, transaction);
    if (!businessDay) throw new AppError('The sale business day no longer exists', 409);
    const sale_date = isEdit ? existingSale.sale_date : businessDay.business_date;
    let selectedCustomer = null;
    if (customer_id) {
      const customer = await db.customer.findOne({ where: { id: customer_id, tenant_id: req.tenantId, ...(exchange_return_id ? {} : { is_active: true }) }, transaction });
      if (!customer) throw new AppError('Customer not found', 400);
      selectedCustomer = customer;
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
    const regularGst = tenantSettings?.tax_system === 'GST' && tenantSettings?.gst_scheme === 'REGULAR';
    const sellerState = gst.stateCodeFromGstin(tenantSettings?.tax_id);
    const customerState = gst.stateCodeFromGstin(selectedCustomer?.tax_id);
    if (regularGst && !sellerState) throw new AppError('Set a valid company GSTIN in Settings before issuing a tax invoice', 400);
    if (regularGst && selectedCustomer?.tax_id && !customerState) throw new AppError('The customer GSTIN is invalid. Correct it before issuing a tax invoice', 400);
    const placeOfSupply = regularGst ? (customerState || req.body.place_of_supply_state_code || sellerState) : null;
    if (regularGst && placeOfSupply && !/^\d{2}$/.test(String(placeOfSupply))) throw new AppError('Enter a valid two-digit place of supply state code', 400);
    if (regularGst && customerState && req.body.place_of_supply_state_code && customerState !== req.body.place_of_supply_state_code) throw new AppError('Place of supply does not match the customer GSTIN state code', 400);
    const supplyType = regularGst && sellerState && placeOfSupply && sellerState !== placeOfSupply ? 'INTER' : 'INTRA';
    if (preview.requires_negative_confirmation && !allow_negative_materials) {
      if (internal) {
        const error = new AppError('Confirm the material shortages to complete this sale', 409);
        error.preview = preview;
        throw error;
      }
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
      const quantity = number(row.quantity), price = number(row.unit_price), discountPct = number(row.discount_pct);
      const previewLine = preview.lines[index];
      if (regularGst && (!previewLine.hsn_code || previewLine.gst_rate === null || previewLine.gst_rate === undefined)) throw new AppError(`Set the HSN code and GST rate on ${previewLine.product_name} before selling`, 400);
      if (regularGst) try { gst.validateRate(previewLine.gst_rate); } catch (error) { throw new AppError(`${previewLine.product_name}: ${error.message}`, 400); }
      const taxRate = regularGst ? number(previewLine.gst_rate) : number(row.tax_rate);
      if (price < 0) throw new AppError('Sale price cannot be negative', 400);
      if (discountPct < 0 || discountPct > 100 || taxRate < 0 || taxRate > 100) throw new AppError('Discount and tax rates must be between 0 and 100', 400);
      if (composition && taxRate !== 0) throw new AppError('Composition sales cannot charge GST. Set every sale tax rate to 0%.', 400);
      const base = accounting.money(quantity * price), discount = hasFixedOrderDiscount ? fixedLineDiscounts[index] : accounting.money(base * discountPct / 100), taxable = accounting.money(base - discount), tax = accounting.money(taxable * taxRate / 100);
      subtotal += base; discountAmount += discount; taxAmount += tax;
      return { ...row, item_type: previewLine.item_type, hsn_code: regularGst ? previewLine.hsn_code : null, ...gst.splitTax(regularGst ? tax : 0, supplyType), line_number: index + 1, fulfillment_mode: previewLine.fulfillment_mode, measurement_source_type: previewLine.measurement_source_type, measurement_source_id: previewLine.measurement_source_id, source_quantity: previewLine.source_quantity, exclude_formula_packaging: previewLine.exclude_formula_packaging, fill_quantity_ml: previewLine.fill_quantity_ml, pack_count: previewLine.pack_count, packing_kit: previewLine.packing_kit, sale_packaging: previewLine.sale_packaging, quantity, unit_price: price, discount_pct: hasFixedOrderDiscount && base ? accounting.money(discount / base * 100) : discountPct, tax_rate: taxRate, tax_amount: tax, total: accounting.money(taxable + tax) };
    });
    subtotal = accounting.money(subtotal); discountAmount = accounting.money(discountAmount); taxAmount = accounting.money(taxAmount);
    const totalAmount = accounting.money(subtotal - discountAmount + taxAmount);
    const incentiveAmount = salespersonId ? incentives.calculateIncentive({ subtotal, discount_amount: discountAmount, total_amount: totalAmount }, incentiveRate, incentiveBasis, tenantSettings?.incentive_enabled ? tenantSettings.incentive_min_sale_amount : 0) : 0;
    if (storeCreditUsed > totalAmount) throw new AppError('Store credit cannot exceed the sale total', 400);
    if (storeCreditUsed > 0) {
      const availableCredit = await storeCredit.balance(req.tenantId, customer_id, transaction, true);
      if (storeCreditUsed > availableCredit + 0.001) throw new AppError(`Only ${availableCredit.toFixed(2)} of store credit is available`, 409);
    }
    const cashDue = accounting.money(totalAmount - storeCreditUsed);
    const paymentSplits = await accounting.resolvePaymentSplits(req.tenantId, cashDue === 0 ? { ...req.body, payments: [] } : req.body, cashDue, transaction, { allowPartial: creditSale || cashDue === 0 });
    const paidAmount = accounting.money(paymentSplits.reduce((sum, split) => sum + split.amount, 0));
    const balanceDue = accounting.money(totalAmount - paidAmount - storeCreditUsed);
    const customerLedger = creditSale ? await accounting.getCustomerLedger(req.tenantId, customer_id, transaction) : null;
    if (creditSale && balanceDue > 0) {
      const customer = await db.customer.findOne({ where: { id: customer_id, tenant_id: req.tenantId }, transaction });
      const creditLimit = number(customer?.credit_limit);
      if (creditLimit > 0 && number(customerLedger.balance) + balanceDue > creditLimit + 0.005) throw new AppError(`This sale exceeds the customer's available credit limit of ${creditLimit.toFixed(2)}`, 409);
    }
    const primaryPayment = paymentSplits[0] || null;
    const storeCreditAccount = storeCreditUsed > 0 ? await storeCredit.account(req.tenantId, transaction) : null;
    // The sale header requires an account even when a full discount leaves
    // nothing to collect. No cash entry or payment is posted in that case.
    const headerAccountId = primaryPayment?.method.account.id || customerLedger?.id || storeCreditAccount?.id
      || (totalAmount === 0 ? (await accounting.resolvePaymentMethod(req.tenantId, {}, transaction)).account.id : null);
    const sale = isEdit
      ? existingSale
      : await db.retailSale.create({ tenant_id: req.tenantId, business_day_id: businessDay.id, exchange_return_id, store_credit_used: storeCreditUsed, sale_number: saleNumber, sale_date, customer_id, payment_account_id: headerAccountId, payment_method_id: primaryPayment?.method.id || null, notes, subtotal, discount_amount: discountAmount, tax_amount: taxAmount, gst_scheme: composition ? 'COMPOSITION' : 'REGULAR', gst_enabled: regularGst, supply_type: regularGst ? supplyType : null, place_of_supply_state_code: placeOfSupply, seller_gstin: regularGst ? tenantSettings.tax_id : null, customer_gstin: regularGst ? selectedCustomer?.tax_id : null, total_amount: totalAmount, salesperson_id: salespersonId, incentive_rate: incentiveRate, incentive_basis: incentiveBasis, incentive_amount: incentiveAmount, created_by: req.user.id }, { transaction });
    if (isEdit) await sale.update({ customer_id, store_credit_used: 0, payment_account_id: primaryPayment?.method.account.id || customerLedger?.id || existingSale.payment_account_id, payment_method_id: primaryPayment?.method.id || null, notes, subtotal, discount_amount: discountAmount, tax_amount: taxAmount, gst_enabled: regularGst, supply_type: regularGst ? supplyType : null, place_of_supply_state_code: placeOfSupply, seller_gstin: regularGst ? tenantSettings.tax_id : null, customer_gstin: regularGst ? selectedCustomer?.tax_id : null, total_amount: totalAmount, salesperson_id: salespersonId, incentive_rate: incentiveRate, incentive_basis: incentiveBasis, incentive_amount: incentiveAmount, cogs_amount: 0, journal_entry_id: null, cogs_journal_id: null }, { transaction });
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
        discount_pct: line.discount_pct, tax_rate: line.tax_rate, hsn_code: line.hsn_code, tax_amount: line.tax_amount, cgst_amount: line.cgst_amount, sgst_amount: line.sgst_amount, igst_amount: line.igst_amount, total: line.total,
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
    const revenueJournal = await accounting.createAndPost(req.tenantId, { entry_date: sale_date, business_day_id: businessDay.id, reference_type: 'retail_sale_revenue', reference_id: sale.id, narration: 'Retail sale revenue', lines: [
      ...paymentSplits.map(split => ({ account_id: split.method.account.id, debit_amount: split.amount, description: `${split.method.name} received for ${sale.sale_number}` })),
      ...(storeCreditUsed ? [{ account_id: storeCreditAccount.id, debit_amount: storeCreditUsed, description: `Store credit redeemed on ${sale.sale_number}` }] : []),
      ...(balanceDue > 0 ? [{ account_id: customerLedger.id, debit_amount: balanceDue, description: `Credit balance for ${sale.sale_number}` }] : []),
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
      const paymentRecord = await db.payment.create({ tenant_id: req.tenantId, business_day_id: businessDay.id, payment_number: `PAY-IN-${new Date(sale_date).getFullYear()}-${String(paymentSequence + index).padStart(4, '0')}`, payment_type: 'incoming', party_type: 'customer', party_id: customer_id, payment_method_id: split.method.id, payment_mode: accounting.paymentModeForType(split.method.method_type), bank_account_id: split.method.account.id, amount: split.amount, payment_date: sale_date, notes: `Retail sale ${sale.sale_number}`, journal_entry_id: revenueJournal.id, created_by: req.user.id }, { transaction });
      paymentRecords.push(paymentRecord);
      if (creditSale) await db.paymentAllocation.create({ payment_id: paymentRecord.id, invoice_type: 'retail_sale', invoice_id: sale.id, allocated_amount: split.amount }, { transaction });
    }
    await sale.update({ cogs_amount: cogs, journal_entry_id: revenueJournal.id, cogs_journal_id: cogsJournal?.id || null }, { transaction });
    if (internal) return { ...sale.toJSON(), paid_amount: accounting.money(paidAmount + storeCreditUsed), balance_due: balanceDue, payment_id: paymentRecords[0]?.id || null, payment_ids: paymentRecords.map(record => record.id) };
    await transaction.commit();
    // Send only after the database transaction succeeds; provider failures do
    // not undo a sale, inventory movement, payment, or journal entry.
    const [customer, tenant] = await Promise.all([
      customer_id ? db.customer.findOne({ where: { id: customer_id, tenant_id: req.tenantId } }) : null,
      db.tenant.findByPk(req.tenantId),
    ]);
    const whatsapp = isEdit ? { attempted: false, status: 'not_sent_for_update' } : await invoiceWhatsapp.sendInvoice({ sale: sale.toJSON(), customer, tenant });
    if (!isEdit) await invoiceWhatsapp.recordDeliveryAttempt({ sale: sale.toJSON(), customer, tenant, result: whatsapp });
    if (whatsapp.status === 'failed') console.error(`Invoice WhatsApp send failed for ${sale.sale_number}: ${whatsapp.reason}`);
    res.status(isEdit ? 200 : 201).json({ ...sale.toJSON(), paid_amount: accounting.money(paidAmount + storeCreditUsed), balance_due: balanceDue, payment_id: paymentRecords[0]?.id || null, payment_ids: paymentRecords.map(record => record.id), whatsapp });
  } catch (error) {
    if (internal) throw error;
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
};

exports.create = (req, res, next) => saveSale(req, res, next, false);
exports.update = (req, res, next) => saveSale(req, res, next, true);

// Return and replacement post together, so a failed replacement leaves no
// refund, stock movement, or credit transaction behind.
exports.exchange = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const returnRequest = req.body.return || {};
    const replacement = req.body.replacement || {};
    const paymentMethodId = req.body.payment_method_id;
    if (!Array.isArray(replacement.items) || !replacement.items.length) throw new AppError('Add at least one replacement item', 400);
    const returnController = require('./salesReturn.controller');
    const postedReturn = await returnController.create({ ...req, body: {
      items: returnRequest.items,
      reason: 'Exchange',
      notes: returnRequest.notes,
      settlement_type: 'exchange',
      refund_payment_method_id: paymentMethodId
    }, exchangeTransaction: transaction }, null, null);
    const originalSale = await db.retailSale.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, transaction });
    const replacementBases = replacement.items.map(row => accounting.money(number(row.quantity) * number(row.unit_price)));
    if (replacement.items.some((row, index) => {
      const quantity = number(row.quantity), price = number(row.unit_price), discountPct = number(row.discount_pct), taxRate = number(row.tax_rate);
      return !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0
        || !Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100
        || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 || !Number.isFinite(replacementBases[index]);
    })) throw new AppError('Check replacement quantity, price, discount, and tax', 400);
    const replacementSubtotal = accounting.money(replacementBases.reduce((sum, base) => sum + base, 0));
    const hasFixedReplacementDiscount = replacement.order_discount_amount !== undefined && replacement.order_discount_amount !== null;
    const fixedReplacementDiscount = number(replacement.order_discount_amount);
    if (hasFixedReplacementDiscount && (!Number.isFinite(fixedReplacementDiscount) || fixedReplacementDiscount < 0 || fixedReplacementDiscount > replacementSubtotal)) {
      throw new AppError('The fixed replacement discount must be between zero and the replacement subtotal', 400);
    }
    const fixedReplacementDiscounts = hasFixedReplacementDiscount
      ? allocateFixedDiscount(replacementBases, fixedReplacementDiscount)
      : null;
    const replacementTotal = accounting.money(replacement.items.reduce((sum, row, index) => {
      const quantity = number(row.quantity), price = number(row.unit_price);
      const discountPct = number(row.discount_pct), taxRate = number(row.tax_rate);
      const base = accounting.money(quantity * price);
      const discount = hasFixedReplacementDiscount ? fixedReplacementDiscounts[index] : accounting.money(base * discountPct / 100);
      const taxable = accounting.money(base - discount);
      return sum + accounting.money(taxable + accounting.money(taxable * taxRate / 100));
    }, 0));
    if (replacementTotal <= 0) throw new AppError('The replacement total must be greater than zero', 400);
    const creditUsed = Math.min(replacementTotal, number(postedReturn.store_credit_amount));
    const cashDue = accounting.money(replacementTotal - creditUsed);
    const postedSale = await saveSale({ ...req, body: {
      customer_id: originalSale.customer_id,
      exchange_return_id: postedReturn.id,
      store_credit_used: creditUsed,
      notes: `Exchange against ${originalSale.sale_number} via ${postedReturn.return_number}`,
      allow_negative_materials: replacement.allow_negative_materials === true,
      order_discount_amount: replacement.order_discount_amount,
      payments: cashDue > 0 ? [{ payment_method_id: paymentMethodId, amount: cashDue }] : [],
      items: replacement.items
    }, exchangeTransaction: transaction }, null, null, false);
    await transaction.commit();
    let whatsapp = { attempted: false, status: 'not_sent' };
    try {
      const [customer, tenant] = await Promise.all([
        originalSale.customer_id ? db.customer.findOne({ where: { id: originalSale.customer_id, tenant_id: req.tenantId } }) : null,
        db.tenant.findByPk(req.tenantId)
      ]);
      whatsapp = await invoiceWhatsapp.sendInvoice({ sale: postedSale, customer, tenant });
      await invoiceWhatsapp.recordDeliveryAttempt({ sale: postedSale, customer, tenant, result: whatsapp });
    } catch (deliveryError) {
      console.error(`Exchange invoice WhatsApp delivery failed for ${postedSale.sale_number}: ${deliveryError.message}`);
      whatsapp = { attempted: true, status: 'failed', reason: deliveryError.message };
    }
    res.status(201).json({ salesReturn: postedReturn, sale: { ...postedSale, whatsapp }, net_cash_due: accounting.money(cashDue - number(postedReturn.refund_amount)) });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    if (error.preview) return res.status(409).json({ success: false, code: 'NEGATIVE_STOCK_CONFIRMATION_REQUIRED', message: error.message, preview: error.preview, shortages: error.preview.shortages });
    next(error);
  }
};

exports.buildPreview = buildPreview;
exports.fulfillmentModeForVariant = fulfillmentModeForVariant;
exports.addReturnSummary = addReturnSummary;
exports.mlToMaterialQuantity = mlToMaterialQuantity;
exports.packingKitSupportsFill = packingKitSupportsFill;
