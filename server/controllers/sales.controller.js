const db = require('../models');
const { customer, salesOrder, salesOrderItem, salesInvoice } = db;
const { AppError } = require('../middleware/errorHandler');
const accounting = require('../services/accounting.service');
const storeCredit = require('../services/storeCredit.service');
const { Op } = require('sequelize');

exports.getCustomers = async (req, res, next) => {
  try {
    const customers = await customer.findAll({ where: { tenant_id: req.tenantId } });
    const ledgers = customers.length ? await db.account.findAll({ where: { tenant_id: req.tenantId, customer_id: customers.map(row => row.id) } }) : [];
    const ledgerByCustomer = new Map(ledgers.map(row => [row.customer_id, row]));
    const [creditsIssued, creditsUsed] = customers.length ? await Promise.all([
      db.salesReturn.findAll({ where: { tenant_id: req.tenantId, store_credit_amount: { [Op.gt]: 0 } }, include: [{ model: db.retailSale, required: true, attributes: ['customer_id'] }], attributes: ['store_credit_amount'] }),
      db.retailSale.findAll({ where: { tenant_id: req.tenantId, store_credit_used: { [Op.gt]: 0 } }, attributes: ['customer_id', 'store_credit_used'] })
    ]) : [[], []];
    const creditByCustomer = new Map();
    creditsIssued.forEach(row => creditByCustomer.set(row.retailSale.customer_id, (creditByCustomer.get(row.retailSale.customer_id) || 0) + Number(row.store_credit_amount)));
    creditsUsed.forEach(row => creditByCustomer.set(row.customer_id, (creditByCustomer.get(row.customer_id) || 0) - Number(row.store_credit_used)));
    res.status(200).json(customers.map(row => ({ ...row.toJSON(), ledger: ledgerByCustomer.get(row.id) || null, outstanding: Number(ledgerByCustomer.get(row.id)?.balance || 0), store_credit_balance: accounting.money(creditByCustomer.get(row.id) || 0) })));
  } catch (error) { next(error); }
};
exports.getCustomerLedger = async (req, res, next) => {
  try {
    const ledger = await accounting.getCustomerLedger(req.tenantId, req.params.id);
    const lines = await db.journalEntryLine.findAll({ where: { account_id: ledger.id }, include: [{ model: db.journalEntry, where: { tenant_id: req.tenantId, status: 'posted' } }], order: [[db.journalEntry, 'entry_date', 'ASC'], ['created_at', 'ASC']] });
    let balance = 0;
    const entries = lines.map(line => { balance += Number(line.debit || 0) - Number(line.credit || 0); return { id: line.id, date: line.journalEntry.entry_date, entry_number: line.journalEntry.entry_number, reference_type: line.journalEntry.reference_type, reference_id: line.journalEntry.reference_id, description: line.description || line.journalEntry.narration, debit: Number(line.debit || 0), credit: Number(line.credit || 0), balance }; });
    res.json({ ledger, entries });
  } catch (error) { next(error); }
};
exports.getCustomerStoreCredit = async (req, res, next) => {
  try {
    const balance = await storeCredit.balance(req.tenantId, req.params.id);
    const entries = req.query.include_history === '1' ? await storeCredit.history(req.tenantId, req.params.id) : undefined;
    res.json({ customer_id: req.params.id, balance, ...(entries ? { entries } : {}) });
  }
  catch (error) { next(error); }
};
exports.getCustomerById = async (req, res, next) => {
  try { res.status(200).json(await customer.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } })); } catch (error) { next(error); }
};
exports.createCustomer = async (req, res, next) => {
  try { res.status(201).json(await customer.create({ ...req.body, tenant_id: req.tenantId })); } catch (error) { next(error); }
};
exports.updateCustomer = async (req, res, next) => {
  try {
    const [updated] = await customer.update(req.body, {
      where: { id: req.params.id, tenant_id: req.tenantId }
    });
    if (!updated) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Updated' });
  } catch (error) { next(error); }
};

exports.getSalesOrders = async (req, res, next) => {
  try {
    res.status(200).json(await salesOrder.findAll({
      where: { tenant_id: req.tenantId },
      include: [customer, salesOrderItem]
    }));
  } catch (error) { next(error); }
};
exports.getSalesOrderById = async (req, res, next) => {
  try {
    res.status(200).json(await salesOrder.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      include: [
        customer,
        { model: salesOrderItem, include: [db.finishedGood] }
      ]
    }));
  } catch (error) { next(error); }
};
exports.createSalesOrder = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { items = [], ...header } = req.body;
    const tenantSettings = await db.tenant.findByPk(req.tenantId, { transaction });
    const composition = tenantSettings?.tax_system === 'GST' && tenantSettings?.gst_scheme === 'COMPOSITION';
    const calculated = items.map(row => {
      if (composition && Number(row.tax_rate || 0) !== 0) throw new AppError('Composition sales cannot charge GST. Set every order tax rate to 0%.', 400);
      const base = Number(row.quantity) * Number(row.unit_price);
      const discounted = base * (1 - Number(row.discount_pct || 0) / 100);
      const tax = discounted * Number(row.tax_rate || 0) / 100;
      return { ...row, tax_amount: tax, total: discounted + tax };
    });
    const subtotal = items.reduce((sum, row) => sum + Number(row.quantity) * Number(row.unit_price), 0);
    const discountAmount = items.reduce((sum, row) =>
      sum + Number(row.quantity) * Number(row.unit_price) * Number(row.discount_pct || 0) / 100, 0);
    const taxAmount = calculated.reduce((sum, row) => sum + row.tax_amount, 0);
    const sequence = await salesOrder.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    const order = await salesOrder.create({
      ...header,
      tenant_id: req.tenantId,
      order_number: header.order_number || `SO-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: subtotal - discountAmount + taxAmount
    }, { transaction });
    if (calculated.length) {
      await salesOrderItem.bulkCreate(calculated.map(row => ({
        ...row, sales_order_id: order.id
      })), { transaction });
    }
    await transaction.commit();
    res.status(201).json(order);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
exports.updateSalesOrder = async (req, res, next) => {
  try { res.status(200).json({ message: 'Updated' }); } catch (error) { next(error); }
};
exports.confirmSalesOrder = async (req, res, next) => {
  try {
    const [updated] = await salesOrder.update(
      { status: 'confirmed' },
      { where: { id: req.params.id, tenant_id: req.tenantId, status: 'draft' } }
    );
    if (!updated) throw new AppError('Sales order cannot be confirmed', 400);
    res.json({ message: 'Confirmed' });
  } catch (error) { next(error); }
};
exports.deliverSalesOrder = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const order = await salesOrder.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      include: [salesOrderItem],
      transaction
    });
    if (!order) throw new AppError('Not found', 404);
    if (order.status === 'delivered') throw new AppError('Sales order is already delivered', 400);
    if (order.status === 'cancelled') throw new AppError('Cancelled sales order cannot be delivered', 400);
    for (const row of order.salesOrderItems) {
      const product = await db.finishedGood.findOne({
        where: { id: row.finished_good_id, tenant_id: req.tenantId },
        transaction
      });
      const quantity = Number(row.quantity);
      if (!product || Number(product.current_stock) < quantity) {
        throw new AppError('Insufficient finished goods stock', 400);
      }
      await product.update({ current_stock: Number(product.current_stock) - quantity }, { transaction });
      await db.stockMovement.create({
        tenant_id: req.tenantId,
        material_type: 'finished',
        material_id: product.id,
        movement_type: 'sale',
        direction: 'out',
        quantity,
        reference_type: 'sales_order',
        reference_id: order.id,
        created_by: req.user.id
      }, { transaction });
    }
    await order.update({ status: 'delivered' }, { transaction });
    await transaction.commit();
    res.json(order);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.generateInvoice = async (req, res, next) => {
  try {
    const order = await salesOrder.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!order) throw new AppError('Not found', 404);
    const existing = await salesInvoice.findOne({ where: { sales_order_id: order.id, tenant_id: req.tenantId } });
    if (existing) return res.json(existing);
    const sequence = await salesInvoice.count({ where: { tenant_id: req.tenantId } }) + 1;
    const invoice = await salesInvoice.create({
      tenant_id: req.tenantId,
      invoice_number: `INV-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`,
      sales_order_id: order.id,
      customer_id: order.customer_id,
      invoice_date: new Date(),
      due_date: order.delivery_date || new Date(),
      subtotal: order.subtotal,
      discount_amount: order.discount_amount,
      tax_amount: order.tax_amount,
      total_amount: order.total_amount
    });
    await order.update({ status: 'invoiced' });
    res.status(201).json(invoice);
  } catch (error) { next(error); }
};
exports.getInvoice = async (req, res, next) => {
  try { res.status(200).json(await salesInvoice.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } })); } catch (error) { next(error); }
};
