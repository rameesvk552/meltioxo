const { Op } = require('sequelize');
const db = require('../models');
const { AppError } = require('../middleware/errorHandler');
const accounting = require('../services/accounting.service');
const businessDays = require('../services/businessDay.service');
const { ACCOUNT_CODES } = require('../config/constants');

const number = value => Number(value || 0);
const closeEnough = (left, right) => Math.abs(number(left) - number(right)) < 0.00005;
const quantityNumber = (value, field = 'Return quantity') => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new AppError(`${field} must be a valid number`, 400);
  const rounded = Math.round(numeric * 10000) / 10000;
  if (Math.abs(numeric - rounded) > 0.0000001) throw new AppError(`${field} cannot have more than four decimal places`, 400);
  return rounded;
};

const originalAmounts = saleItem => {
  const subtotal = accounting.money(number(saleItem.quantity) * number(saleItem.unit_price));
  const tax = accounting.money(saleItem.tax_amount);
  const total = accounting.money(saleItem.total);
  return {
    subtotal,
    discount: accounting.money(subtotal + tax - total),
    tax,
    total,
    cost: accounting.money(saleItem.cost_amount)
  };
};

// Proportional allocations keep partial returns predictable. The final return
// receives the exact remaining cents, so cumulative returns always equal the
// original posted line even after multiple partial transactions.
const allocateReturnAmounts = (saleItem, quantity, prior = {}) => {
  const soldQuantity = number(saleItem.quantity);
  const returnedQuantity = number(prior.quantity);
  const requestedQuantity = quantityNumber(quantity);
  const remainingQuantity = soldQuantity - returnedQuantity;
  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) throw new AppError('Return quantity must be greater than zero', 400);
  if (requestedQuantity > remainingQuantity + 0.00005) throw new AppError('Return quantity exceeds the quantity still available to return', 409);

  const original = originalAmounts(saleItem);
  const isFinal = closeEnough(requestedQuantity, remainingQuantity);
  const allocate = (field, originalValue) => isFinal
    ? accounting.money(originalValue - number(prior[field]))
    : Math.min(accounting.money(originalValue * requestedQuantity / soldQuantity), accounting.money(originalValue - number(prior[field])));

  const subtotal = allocate('subtotal', original.subtotal);
  const discount = allocate('discount', original.discount);
  const tax = allocate('tax', original.tax);
  return {
    quantity: requestedQuantity,
    subtotal,
    discount,
    tax,
    total: accounting.money(subtotal - discount + tax),
    remainingQuantity
  };
};

const returnInclude = [
  db.paymentMethod,
  { model: db.account, as: 'refundAccount' },
  { model: db.salesReturnItem, include: [{ model: db.finishedGood, include: [db.product] }, db.packagingMaterial] }
];

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (!requestedItems.length) throw new AppError('Select at least one item to return', 400);
    const reason = String(req.body.reason || '').trim();
    if (!reason) throw new AppError('Return reason is required', 400);
    if (reason.length > 250) throw new AppError('Return reason must be 250 characters or fewer', 400);
    const notes = String(req.body.notes || '').trim() || null;
    if (notes && notes.length > 2000) throw new AppError('Return notes must be 2,000 characters or fewer', 400);

    const businessDay = await businessDays.requireOpen(req.tenantId, transaction);
    const sale = await db.retailSale.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!sale) throw new AppError('Sale not found', 404);
    if (!sale.journal_entry_id) throw new AppError('Only posted sales can be returned', 409);

    const saleItems = await db.retailSaleItem.findAll({
      where: { retail_sale_id: sale.id },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    const saleItemById = new Map(saleItems.map(item => [item.id, item]));
    const requestIds = new Set();
    for (const [index, item] of requestedItems.entries()) {
      if (!item.retail_sale_item_id || !saleItemById.has(item.retail_sale_item_id)) throw new AppError(`Return item ${index + 1} does not belong to this sale`, 400);
      if (requestIds.has(item.retail_sale_item_id)) throw new AppError('Each sale item can appear only once in a return', 400);
      requestIds.add(item.retail_sale_item_id);
    }

    const saleItemIds = saleItems.map(item => item.id);
    const previousItems = saleItemIds.length ? await db.salesReturnItem.findAll({
      where: { retail_sale_item_id: { [Op.in]: saleItemIds } },
      transaction,
      lock: transaction.LOCK.UPDATE
    }) : [];
    const priorByItem = new Map();
    for (const item of previousItems) {
      const prior = priorByItem.get(item.retail_sale_item_id) || { quantity: 0, restock_quantity: 0, subtotal: 0, discount: 0, tax: 0, total: 0, cost: 0 };
      prior.quantity += number(item.quantity);
      prior.restock_quantity += number(item.restock_quantity);
      prior.subtotal += number(item.subtotal);
      prior.discount += number(item.discount_amount);
      prior.tax += number(item.tax_amount);
      prior.total += number(item.total);
      prior.cost += number(item.cost_amount);
      priorByItem.set(item.retail_sale_item_id, prior);
    }

    const calculated = requestedItems.map(item => {
      const saleItem = saleItemById.get(item.retail_sale_item_id);
      const prior = priorByItem.get(saleItem.id) || {};
      const allocation = allocateReturnAmounts(saleItem, item.quantity, prior);
      const restockQuantity = item.restock_quantity === undefined
        ? (item.restock ? allocation.quantity : 0)
        : quantityNumber(item.restock_quantity, 'Restock quantity');
      if (!Number.isFinite(restockQuantity) || restockQuantity < 0 || restockQuantity > allocation.quantity + 0.00005) {
        throw new AppError('Restock quantity must be between zero and the returned quantity', 400);
      }
      const soldQuantity = number(saleItem.quantity);
      // Packing kits are normally opened/used and are not put back into stock.
      // Restock only the perfume source portion of a measured line's cost.
      const isPackagingMaterial = saleItem.item_type === 'packaging_material';
      const originalCost = isPackagingMaterial
        ? accounting.money(saleItem.cost_amount)
        : accounting.money(number(saleItem.cost_amount) - number(saleItem.packaging_cost_amount));
      const cumulativeRestockQuantity = number(prior.restock_quantity) + restockQuantity;
      const cost = closeEnough(cumulativeRestockQuantity, soldQuantity)
        ? accounting.money(originalCost - number(prior.cost))
        : accounting.money(originalCost * restockQuantity / soldQuantity);
      const restockMaterialType = isPackagingMaterial ? 'packaging' : saleItem.measurement_source_type === 'raw_material' ? 'raw' : 'finished';
      const restockMaterialId = restockMaterialType === 'packaging' ? saleItem.packaging_material_id : restockMaterialType === 'raw' ? saleItem.measurement_source_id : saleItem.finished_good_id;
      const sourceSoldQuantity = restockMaterialType === 'raw' ? number(saleItem.measurement_source_quantity || soldQuantity) : soldQuantity;
      const restockMaterialQuantity = soldQuantity ? sourceSoldQuantity * restockQuantity / soldQuantity : 0;
      return { saleItem, ...allocation, restockQuantity, cost, restockMaterialType, restockMaterialId, restockMaterialQuantity };
    });

    const totals = calculated.reduce((sum, item) => ({
      subtotal: accounting.money(sum.subtotal + item.subtotal),
      discount: accounting.money(sum.discount + item.discount),
      tax: accounting.money(sum.tax + item.tax),
      total: accounting.money(sum.total + item.total),
      cost: accounting.money(sum.cost + item.cost),
      rawCost: accounting.money(sum.rawCost + (item.restockMaterialType === 'raw' ? item.cost : 0)),
      finishedCost: accounting.money(sum.finishedCost + (item.restockMaterialType === 'finished' ? item.cost : 0)),
      packagingCost: accounting.money(sum.packagingCost + (item.restockMaterialType === 'packaging' ? item.cost : 0))
    }), { subtotal: 0, discount: 0, tax: 0, total: 0, cost: 0, rawCost: 0, finishedCost: 0, packagingCost: 0 });

    const paymentMethod = await accounting.getPaymentMethod(
      req.tenantId,
      req.body.refund_payment_method_id || sale.payment_method_id,
      transaction
    );

    if (db.sequelize.getDialect() === 'postgres') {
      await db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: `${req.tenantId}:sales-return` }, transaction });
    }
    const sequence = await db.salesReturn.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    const returnNumber = `SR-${new Date(businessDay.business_date).getFullYear()}-${String(sequence).padStart(4, '0')}`;
    const salesReturn = await db.salesReturn.create({
      tenant_id: req.tenantId,
      business_day_id: businessDay.id,
      retail_sale_id: sale.id,
      return_number: returnNumber,
      return_date: businessDay.business_date,
      refund_payment_method_id: paymentMethod.id,
      refund_account_id: paymentMethod.account.id,
      subtotal: totals.subtotal,
      discount_amount: totals.discount,
      tax_amount: totals.tax,
      total_amount: totals.total,
      restocked_cost: totals.cost,
      reason,
      notes,
      created_by: req.user.id
    }, { transaction });

    for (const [index, item] of calculated.entries()) {
      await db.salesReturnItem.create({
        sales_return_id: salesReturn.id,
        retail_sale_item_id: item.saleItem.id,
        finished_good_id: item.saleItem.finished_good_id,
        packaging_material_id: item.saleItem.packaging_material_id,
        quantity: item.quantity,
        restock_quantity: item.restockQuantity,
        subtotal: item.subtotal,
        discount_amount: item.discount,
        tax_amount: item.tax,
        total: item.total,
        cost_amount: item.cost
      }, { transaction });
      if (item.restockQuantity <= 0) continue;

      const Model = item.restockMaterialType === 'raw' ? db.rawMaterial : item.restockMaterialType === 'packaging' ? db.packagingMaterial : db.finishedGood;
      const restockItem = await Model.findOne({
        where: { id: item.restockMaterialId, tenant_id: req.tenantId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!restockItem) throw new AppError('Returned inventory source no longer exists', 409);
      const unitCost = item.restockMaterialQuantity ? number(item.cost) / item.restockMaterialQuantity : 0;
      const batch = await db.stockBatch.create({
        tenant_id: req.tenantId,
        material_type: item.restockMaterialType,
        material_id: restockItem.id,
        batch_number: `${returnNumber}-${String(index + 1).padStart(2, '0')}`,
        quantity: item.restockMaterialQuantity,
        remaining_qty: item.restockMaterialQuantity,
        cost_per_unit: unitCost,
        received_date: businessDay.business_date
      }, { transaction });
      await restockItem.update({ current_stock: number(restockItem.current_stock) + item.restockMaterialQuantity }, { transaction });
      await db.stockMovement.create({
        tenant_id: req.tenantId,
        material_type: item.restockMaterialType,
        material_id: restockItem.id,
        movement_type: 'return',
        direction: 'in',
        quantity: item.restockMaterialQuantity,
        batch_id: batch.id,
        unit_cost: unitCost,
        total_cost: item.cost,
        reference_type: 'sales_return',
        reference_id: salesReturn.id,
        notes: `Restocked from ${returnNumber} for sale ${sale.sale_number}`,
        created_by: req.user.id
      }, { transaction });
    }

    const codes = [];
    const grossRevenue = accounting.money(totals.subtotal);
    if (grossRevenue > 0) codes.push(ACCOUNT_CODES.SALES_REVENUE);
    if (totals.discount > 0) codes.push(ACCOUNT_CODES.DISCOUNT_ALLOWED);
    if (totals.tax > 0) codes.push(ACCOUNT_CODES.TAX_PAYABLE);
    if (totals.cost > 0) codes.push(ACCOUNT_CODES.COGS);
    if (totals.finishedCost > 0) codes.push(ACCOUNT_CODES.FG_INVENTORY);
    if (totals.rawCost > 0) codes.push(ACCOUNT_CODES.RAW_INVENTORY);
    if (totals.packagingCost > 0) codes.push(ACCOUNT_CODES.PKG_INVENTORY);
    const accounts = codes.length ? await accounting.getAccountsByCode(req.tenantId, [...new Set(codes)], transaction) : {};
    const revenueJournal = totals.total > 0 ? await accounting.createAndPost(req.tenantId, {
      entry_date: businessDay.business_date,
      reference_type: 'sales_return_revenue',
      reference_id: salesReturn.id,
      narration: `Sales return ${returnNumber} against ${sale.sale_number}`,
      lines: [
        ...(grossRevenue ? [{ account_id: accounts[ACCOUNT_CODES.SALES_REVENUE].id, debit_amount: grossRevenue, description: `Revenue returned on ${returnNumber}` }] : []),
        ...(totals.tax ? [{ account_id: accounts[ACCOUNT_CODES.TAX_PAYABLE].id, debit_amount: totals.tax, description: `Tax reversed on ${returnNumber}` }] : []),
        ...(totals.discount ? [{ account_id: accounts[ACCOUNT_CODES.DISCOUNT_ALLOWED].id, credit_amount: totals.discount, description: `Discount allowed reversed on ${returnNumber}` }] : []),
        { account_id: paymentMethod.account.id, credit_amount: totals.total, description: `${paymentMethod.name} refund for ${returnNumber}` }
      ]
    }, req.user.id, transaction) : null;
    const cogsJournal = totals.cost > 0 ? await accounting.createAndPost(req.tenantId, {
      entry_date: businessDay.business_date,
      reference_type: 'sales_return_cogs',
      reference_id: salesReturn.id,
      narration: `Restocked goods from ${returnNumber}`,
      lines: [
        ...(totals.finishedCost ? [{ account_id: accounts[ACCOUNT_CODES.FG_INVENTORY].id, debit_amount: totals.finishedCost, description: `Finished inventory restored from ${returnNumber}` }] : []),
        ...(totals.rawCost ? [{ account_id: accounts[ACCOUNT_CODES.RAW_INVENTORY].id, debit_amount: totals.rawCost, description: `Raw material restored from ${returnNumber}` }] : []),
        ...(totals.packagingCost ? [{ account_id: accounts[ACCOUNT_CODES.PKG_INVENTORY].id, debit_amount: totals.packagingCost, description: `Packing-material inventory restored from ${returnNumber}` }] : []),
        { account_id: accounts[ACCOUNT_CODES.COGS].id, credit_amount: totals.cost, description: `COGS reversed on ${returnNumber}` }
      ]
    }, req.user.id, transaction) : null;

    let refundPayment = null;
    if (totals.total > 0) {
      if (db.sequelize.getDialect() === 'postgres') {
        await db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: `${req.tenantId}:payment:outgoing` }, transaction });
      }
      const paymentSequence = await db.payment.count({ where: { tenant_id: req.tenantId, payment_type: 'outgoing' }, transaction }) + 1;
      refundPayment = await db.payment.create({
        tenant_id: req.tenantId,
        business_day_id: businessDay.id,
        payment_number: `PAY-OUT-${new Date(businessDay.business_date).getFullYear()}-${String(paymentSequence).padStart(4, '0')}`,
        payment_type: 'outgoing',
        party_type: 'customer',
        party_id: sale.customer_id,
        payment_method_id: paymentMethod.id,
        payment_mode: accounting.paymentModeForType(paymentMethod.method_type),
        bank_account_id: paymentMethod.account.id,
        amount: totals.total,
        payment_date: businessDay.business_date,
        notes: `Refund ${returnNumber} against retail sale ${sale.sale_number}`,
        journal_entry_id: revenueJournal.id,
        created_by: req.user.id
      }, { transaction });
    }
    await salesReturn.update({
      journal_entry_id: revenueJournal?.id || null,
      cogs_journal_id: cogsJournal?.id || null,
      payment_id: refundPayment?.id || null
    }, { transaction });

    await transaction.commit();
    res.status(201).json(await db.salesReturn.findOne({ where: { id: salesReturn.id, tenant_id: req.tenantId }, include: returnInclude }));
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
};

exports.allocateReturnAmounts = allocateReturnAmounts;
exports.originalAmounts = originalAmounts;
exports.quantityNumber = quantityNumber;
