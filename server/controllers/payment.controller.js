const { Op } = require('sequelize');
const db = require('../models');
const { payment, paymentAllocation } = db;
const { AppError } = require('../middleware/errorHandler');
const accounting = require('../services/accounting.service');
const { ACCOUNT_CODES } = require('../config/constants');

// Fetch unpaid / partially-paid invoices for a given party (supplier or customer)
exports.getUnpaidInvoices = async (req, res, next) => {
  try {
    const { party_type, party_id } = req.query;
    if (!party_type || !party_id) throw new AppError('party_type and party_id are required', 400);
    if (!['supplier', 'customer'].includes(party_type)) throw new AppError('Invalid party type', 400);

    let invoices;
    if (party_type === 'supplier') {
      invoices = await db.purchaseInvoice.findAll({
        where: {
          tenant_id: req.tenantId,
          supplier_id: party_id,
          status: { [Op.in]: ['unpaid', 'partial', 'overdue'] }
        },
        order: [['invoice_date', 'ASC']]
      });
    } else {
      invoices = await db.salesInvoice.findAll({
        where: {
          tenant_id: req.tenantId,
          customer_id: party_id,
          status: { [Op.in]: ['unpaid', 'partial', 'overdue'] }
        },
        order: [['invoice_date', 'ASC']]
      });
    }

    // Normalise shape for the frontend
    const result = invoices.map(inv => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      date: inv.invoice_date,
      amount: Number(inv.total_amount),
      due: Number(inv.total_amount) - Number(inv.paid_amount || 0),
      invoice_type: party_type === 'supplier' ? 'purchase' : 'sale'
    }));

    res.status(200).json(result);
  } catch (error) { next(error); }
};

exports.getAll = async (req, res, next) => {
  try {
    const items = await payment.findAll({ where: { tenant_id: req.tenantId }, include: [db.paymentMethod], order: [['payment_date', 'DESC'], ['created_at', 'DESC']] });
    const [customers, suppliers] = await Promise.all([
      db.customer.findAll({ where: { tenant_id: req.tenantId }, attributes: ['id', 'name'] }),
      db.supplier.findAll({ where: { tenant_id: req.tenantId }, attributes: ['id', 'name'] })
    ]);
    const names = new Map([...customers, ...suppliers].map(item => [item.id, item.name]));
    res.status(200).json(items.map(item => ({ ...item.toJSON(), party_name: names.get(item.party_id) || null })));
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await payment.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, include: [paymentAllocation, db.paymentMethod] });
    if (!item) throw new AppError('Not found', 404);
    res.status(200).json(item);
  } catch (error) { next(error); }
};

const createPayment = async (req, res, next, paymentType) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { allocations = [], amount, payment_date = new Date() } = req.body;
    const partyType = paymentType === 'incoming' ? 'customer' : 'supplier';
    if (req.body.party_type && req.body.party_type !== partyType) throw new AppError(`${paymentType === 'incoming' ? 'Incoming receipts require a customer' : 'Outgoing payments require a supplier'}`, 400);
    if (!req.body.party_id) throw new AppError(`Select a ${partyType}`, 400);
    const Party = partyType === 'customer' ? db.customer : db.supplier;
    const party = await Party.findOne({ where: { id: req.body.party_id, tenant_id: req.tenantId, is_active: true }, transaction });
    if (!party) throw new AppError(`${partyType === 'customer' ? 'Customer' : 'Supplier'} not found`, 404);
    const paymentAmount = accounting.money(amount, 'Payment amount');
    if (paymentAmount <= 0) throw new AppError('Payment amount must be greater than zero', 400);
    const allocated = allocations.reduce((sum, allocation) => sum + accounting.money(allocation.allocated_amount, 'Allocated amount'), 0);
    if (allocated > paymentAmount + 0.001) throw new AppError('Allocated amount cannot exceed payment amount', 400);
    const method = await accounting.resolvePaymentMethod(req.tenantId, req.body, transaction);
    const bankLedger = method.account;
    if (String(payment_date).slice(0, 10) > new Date().toISOString().slice(0, 10)) throw new AppError('Future-dated payments are not allowed', 400);
    if (db.sequelize.getDialect() === 'postgres') await db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: `${req.tenantId}:payment:${paymentType}` }, transaction });
    const sequence = await payment.count({ where: { tenant_id: req.tenantId, payment_type: paymentType }, transaction }) + 1;
    const item = await payment.create({ ...req.body, party_type: partyType, payment_type: paymentType, tenant_id: req.tenantId, amount: paymentAmount, payment_date,
      payment_method_id: method.id, bank_account_id: bankLedger.id, payment_mode: accounting.paymentModeForType(method.method_type),
      payment_number: req.body.payment_number || `PAY-${paymentType === 'incoming' ? 'IN' : 'OUT'}-${new Date(payment_date).getFullYear()}-${String(sequence).padStart(4, '0')}`, created_by: req.user.id }, { transaction });
    const controlCode = paymentType === 'incoming' ? ACCOUNT_CODES.AR : ACCOUNT_CODES.AP;
    const accounts = await accounting.getAccountsByCode(req.tenantId, [controlCode], transaction);
    const controlAccount = partyType === 'supplier' ? await accounting.getSupplierLedger(req.tenantId, party.id, transaction) : accounts[controlCode];
    const journal = await accounting.createAndPost(req.tenantId, { entry_date: payment_date, reference_type: 'payment', reference_id: item.id,
      narration: `${paymentType === 'incoming' ? 'Customer receipt' : 'Supplier payment'} ${item.payment_number}`,
      lines: paymentType === 'incoming'
        ? [{ account_id: bankLedger.id, debit_amount: paymentAmount }, { account_id: controlAccount.id, credit_amount: paymentAmount }]
        : [{ account_id: controlAccount.id, debit_amount: paymentAmount }, { account_id: bankLedger.id, credit_amount: paymentAmount }]
    }, req.user.id, transaction);
    for (const allocation of allocations) {
      const amountAllocated = accounting.money(allocation.allocated_amount, 'Allocated amount');
      if (amountAllocated <= 0) continue;
      const expectedInvoiceType = paymentType === 'incoming' ? 'sale' : 'purchase';
      if (allocation.invoice_type !== expectedInvoiceType) throw new AppError(`This payment can only be allocated to ${expectedInvoiceType} invoices`, 400);
      const Model = expectedInvoiceType === 'purchase' ? db.purchaseInvoice : db.salesInvoice;
      const invoice = await Model.findOne({ where: { id: allocation.invoice_id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!invoice) throw new AppError('Allocated invoice not found', 400);
      const invoicePartyId = expectedInvoiceType === 'purchase' ? invoice.supplier_id : invoice.customer_id;
      if (invoicePartyId !== party.id) throw new AppError('Allocated invoice belongs to a different party', 400);
      const due = Number(invoice.total_amount) - Number(invoice.paid_amount || 0);
      if (amountAllocated > due + 0.001) throw new AppError('Allocation exceeds invoice balance', 400);
      await paymentAllocation.create({ payment_id: item.id, invoice_type: expectedInvoiceType, invoice_id: invoice.id, allocated_amount: amountAllocated }, { transaction });
      const paid = Number(invoice.paid_amount || 0) + amountAllocated;
      await invoice.update({ paid_amount: paid, status: paid >= Number(invoice.total_amount) - 0.001 ? 'paid' : 'partial' }, { transaction });
    }
    await item.update({ journal_entry_id: journal.id }, { transaction });
    await transaction.commit();
    res.status(201).json(await payment.findOne({ where: { id: item.id }, include: [paymentAllocation, db.paymentMethod] }));
  } catch (error) { await transaction.rollback(); next(error); }
};
exports.createOutgoing = (req, res, next) => createPayment(req, res, next, 'outgoing');
exports.createIncoming = (req, res, next) => createPayment(req, res, next, 'incoming');
