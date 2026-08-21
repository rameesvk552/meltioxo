const db = require('../models');
const { AppError } = require('../middleware/errorHandler');
const accounting = require('../services/accounting.service');
const { ACCOUNT_CODES } = require('../config/constants');

const number = value => Number(value || 0);

exports.getAll = async (req, res, next) => {
  try {
    const sales = await db.retailSale.findAll({ where: { tenant_id: req.tenantId }, include: [db.customer, db.retailSaleItem, db.paymentMethod, { model: db.account, as: 'paymentAccount' }], order: [['sale_date', 'DESC'], ['created_at', 'DESC']] });
    res.json(sales);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { items = [], customer_id = null, sale_date = new Date(), notes } = req.body;
    if (!items.length) throw new AppError('A retail sale needs at least one item', 400);
    if (String(sale_date).slice(0, 10) > new Date().toISOString().slice(0, 10)) throw new AppError('Future-dated sales are not allowed', 400);
    if (customer_id) {
      const customer = await db.customer.findOne({ where: { id: customer_id, tenant_id: req.tenantId, is_active: true }, transaction });
      if (!customer) throw new AppError('Customer not found', 400);
    }
    const method = await accounting.resolvePaymentMethod(req.tenantId, req.body, transaction);
    const paymentAccount = method.account;

    const sequence = await db.retailSale.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    let subtotal = 0, discountAmount = 0, taxAmount = 0;
    const calculated = items.map(row => {
      const qty = number(row.quantity), price = number(row.unit_price), discountPct = number(row.discount_pct), taxRate = number(row.tax_rate);
      if (!row.finished_good_id || qty <= 0 || price < 0) throw new AppError('Each sale line requires a product, positive quantity, and price', 400);
      if (discountPct < 0 || discountPct > 100 || taxRate < 0 || taxRate > 100) throw new AppError('Discount and tax rates must be between 0 and 100', 400);
      const base = accounting.money(qty * price), discount = accounting.money(base * discountPct / 100), taxable = accounting.money(base - discount), tax = accounting.money(taxable * taxRate / 100);
      subtotal += base; discountAmount += discount; taxAmount += tax;
      return { ...row, quantity: qty, unit_price: price, discount_pct: discountPct, tax_rate: taxRate, tax_amount: tax, total: accounting.money(taxable + tax) };
    });
    subtotal = accounting.money(subtotal); discountAmount = accounting.money(discountAmount); taxAmount = accounting.money(taxAmount);
    const sale = await db.retailSale.create({ tenant_id: req.tenantId, sale_number: `RS-${new Date(sale_date).getFullYear()}-${String(sequence).padStart(4, '0')}`,
      sale_date, customer_id, payment_account_id: paymentAccount.id, payment_method_id: method.id, notes, subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total_amount: accounting.money(subtotal - discountAmount + taxAmount), created_by: req.user.id }, { transaction });

    let cogs = 0;
    for (const line of calculated) {
      const product = await db.finishedGood.findOne({ where: { id: line.finished_good_id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!product || number(product.current_stock) < line.quantity) throw new AppError('Insufficient finished-goods stock', 400);
      let remaining = line.quantity, lineCost = 0;
      const batches = await db.stockBatch.findAll({ where: { tenant_id: req.tenantId, material_type: 'finished', material_id: product.id }, order: [['received_date', 'ASC'], ['created_at', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
      for (const batch of batches) {
        if (remaining <= 0) break;
        const taken = Math.min(remaining, number(batch.remaining_qty));
        if (!taken) continue;
        const cost = taken * number(batch.cost_per_unit);
        await batch.update({ remaining_qty: number(batch.remaining_qty) - taken }, { transaction });
        await db.stockMovement.create({ tenant_id: req.tenantId, material_type: 'finished', material_id: product.id, movement_type: 'sale', direction: 'out',
          quantity: taken, batch_id: batch.id, unit_cost: batch.cost_per_unit, total_cost: cost, reference_type: 'retail_sale', reference_id: sale.id, created_by: req.user.id }, { transaction });
        remaining -= taken; lineCost += cost;
      }
      if (remaining > 0.0001) throw new AppError(`No costed production batches available for ${product.name}`, 400);
      await product.update({ current_stock: number(product.current_stock) - line.quantity }, { transaction });
      await db.retailSaleItem.create({ retail_sale_id: sale.id, ...line, cost_amount: lineCost }, { transaction });
      cogs += accounting.money(lineCost);
    }
    cogs = accounting.money(cogs);

    const accounts = await accounting.getAccountsByCode(req.tenantId, [ACCOUNT_CODES.SALES_REVENUE, ACCOUNT_CODES.COGS, ACCOUNT_CODES.FG_INVENTORY, ACCOUNT_CODES.TAX_PAYABLE], transaction);
    const revenueJournal = await accounting.createAndPost(req.tenantId, { entry_date: sale_date, reference_type: 'retail_sale_revenue', reference_id: sale.id,
      narration: 'Retail sale revenue', lines: [
        { account_id: paymentAccount.id, debit_amount: number(sale.total_amount), description: `Retail sale ${sale.sale_number}` },
        { account_id: accounts[ACCOUNT_CODES.SALES_REVENUE].id, credit_amount: subtotal - discountAmount, description: `Retail sale ${sale.sale_number}` },
        ...(taxAmount ? [{ account_id: accounts[ACCOUNT_CODES.TAX_PAYABLE].id, credit_amount: taxAmount, description: `Tax on ${sale.sale_number}` }] : [])
      ] }, req.user.id, transaction);
    const cogsJournal = cogs ? await accounting.createAndPost(req.tenantId, { entry_date: sale_date, reference_type: 'retail_sale_cogs', reference_id: sale.id,
      narration: 'Retail sale cost of goods sold', lines: [
        { account_id: accounts[ACCOUNT_CODES.COGS].id, debit_amount: cogs, description: `COGS for ${sale.sale_number}` },
        { account_id: accounts[ACCOUNT_CODES.FG_INVENTORY].id, credit_amount: cogs, description: `COGS for ${sale.sale_number}` }
      ] }, req.user.id, transaction) : null;
    if (db.sequelize.getDialect() === 'postgres') await db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: `${req.tenantId}:payment:incoming` }, transaction });
    const paymentSequence = await db.payment.count({ where: { tenant_id: req.tenantId, payment_type: 'incoming' }, transaction }) + 1;
    const paymentRecord = await db.payment.create({
      tenant_id: req.tenantId,
      payment_number: `PAY-IN-${new Date(sale_date).getFullYear()}-${String(paymentSequence).padStart(4, '0')}`,
      payment_type: 'incoming', party_type: 'customer', party_id: customer_id,
      payment_method_id: method.id, payment_mode: accounting.paymentModeForType(method.method_type),
      bank_account_id: paymentAccount.id, amount: sale.total_amount, payment_date: sale_date,
      notes: `Retail sale ${sale.sale_number}`, journal_entry_id: revenueJournal.id, created_by: req.user.id
    }, { transaction });
    await sale.update({ cogs_amount: cogs, journal_entry_id: revenueJournal.id, cogs_journal_id: cogsJournal?.id || null }, { transaction });
    await transaction.commit();
    res.status(201).json({ ...sale.toJSON(), payment_id: paymentRecord.id });
  } catch (error) { await transaction.rollback(); next(error); }
};
