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
      const salesInvoices = await db.salesInvoice.findAll({
        where: {
          tenant_id: req.tenantId,
          customer_id: party_id,
          status: { [Op.in]: ['unpaid', 'partial', 'overdue'] }
        },
        order: [['invoice_date', 'ASC']]
      });
      const retailSales = await db.retailSale.findAll({ where: { tenant_id: req.tenantId, customer_id: party_id }, order: [['sale_date', 'ASC']] });
      const allocations = await db.paymentAllocation.findAll({ where: { invoice_type: 'retail_sale', invoice_id: retailSales.map(row => row.id) } });
      const paidBySale = new Map();
      allocations.forEach(row => paidBySale.set(row.invoice_id, (paidBySale.get(row.invoice_id) || 0) + Number(row.allocated_amount || 0)));
      const unallocatedSales = retailSales.filter(row => !paidBySale.has(row.id));
      const originalPayments = unallocatedSales.length ? await db.payment.findAll({ where: { tenant_id: req.tenantId, journal_entry_id: unallocatedSales.map(row => row.journal_entry_id).filter(Boolean) } }) : [];
      const originalPaidByJournal = new Map();
      originalPayments.forEach(row => originalPaidByJournal.set(row.journal_entry_id, (originalPaidByJournal.get(row.journal_entry_id) || 0) + Number(row.amount || 0)));
      const returns = retailSales.length ? await db.salesReturn.findAll({ where: { tenant_id: req.tenantId, retail_sale_id: retailSales.map(row => row.id) } }) : [];
      const returnedBySale = new Map();
      returns.forEach(row => returnedBySale.set(row.retail_sale_id, (returnedBySale.get(row.retail_sale_id) || 0) + Number(row.total_amount || 0)));
      invoices = [...salesInvoices, ...retailSales.filter(row => Number(row.total_amount) - (returnedBySale.get(row.id) || 0) - (paidBySale.has(row.id) ? paidBySale.get(row.id) : originalPaidByJournal.get(row.journal_entry_id) || 0) - Number(row.store_credit_used || 0) > 0.005).map(row => ({
        id: row.id, invoice_number: row.sale_number, invoice_date: row.sale_date, total_amount: Number(row.total_amount) - (returnedBySale.get(row.id) || 0),
        paid_amount: (paidBySale.has(row.id) ? paidBySale.get(row.id) : originalPaidByJournal.get(row.journal_entry_id) || 0) + Number(row.store_credit_used || 0), status: 'partial', invoice_type: 'retail_sale'
      }))];
    }

    // Normalise shape for the frontend
    const result = invoices.map(inv => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      date: inv.invoice_date,
      amount: Number(inv.total_amount),
      due: Number(inv.total_amount) - Number(inv.paid_amount || 0),
      invoice_type: inv.invoice_type || (party_type === 'supplier' ? 'purchase' : 'sale')
    })).filter(row => row.due > 0.005);

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
    const controlAccount = partyType === 'supplier' ? await accounting.getSupplierLedger(req.tenantId, party.id, transaction) : await accounting.getCustomerLedger(req.tenantId, party.id, transaction);
    const journal = await accounting.createAndPost(req.tenantId, { entry_date: payment_date, reference_type: 'payment', reference_id: item.id,
      narration: `${paymentType === 'incoming' ? 'Customer receipt' : 'Supplier payment'} ${item.payment_number}`,
      lines: paymentType === 'incoming'
        ? [{ account_id: bankLedger.id, debit_amount: paymentAmount }, { account_id: controlAccount.id, credit_amount: paymentAmount }]
        : [{ account_id: controlAccount.id, debit_amount: paymentAmount }, { account_id: bankLedger.id, credit_amount: paymentAmount }]
    }, req.user.id, transaction);
    for (const allocation of allocations) {
      const amountAllocated = accounting.money(allocation.allocated_amount, 'Allocated amount');
      if (amountAllocated <= 0) continue;
      const expectedInvoiceTypes = paymentType === 'incoming' ? ['sale', 'retail_sale'] : ['purchase'];
      const invoiceType = allocation.invoice_type || expectedInvoiceTypes[0];
      if (!expectedInvoiceTypes.includes(invoiceType)) throw new AppError(`This payment can only be allocated to ${expectedInvoiceTypes.join(' or ')} invoices`, 400);
      const Model = invoiceType === 'purchase' ? db.purchaseInvoice : invoiceType === 'retail_sale' ? db.retailSale : db.salesInvoice;
      const invoice = await Model.findOne({ where: { id: allocation.invoice_id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!invoice) throw new AppError('Allocated invoice not found', 400);
      const invoicePartyId = invoiceType === 'purchase' ? invoice.supplier_id : invoice.customer_id;
      if (invoicePartyId !== party.id) throw new AppError('Allocated invoice belongs to a different party', 400);
      let alreadyPaid = Number(invoice.paid_amount || 0);
      if (invoiceType === 'retail_sale') {
        const priorAllocations = await db.paymentAllocation.findAll({ where: { invoice_type: 'retail_sale', invoice_id: invoice.id }, transaction });
        alreadyPaid = priorAllocations.reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0);
        if (!priorAllocations.length && invoice.journal_entry_id) {
          const originalReceipts = await db.payment.findAll({ where: { tenant_id: req.tenantId, journal_entry_id: invoice.journal_entry_id }, transaction });
          alreadyPaid = originalReceipts.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        }
        alreadyPaid += Number(invoice.store_credit_used || 0);
      }
      const returned = invoiceType === 'retail_sale'
        ? (await db.salesReturn.findAll({ where: { tenant_id: req.tenantId, retail_sale_id: invoice.id }, transaction })).reduce((sum, row) => sum + Number(row.total_amount || 0), 0)
        : 0;
      const due = Number(invoice.total_amount) - returned - alreadyPaid;
      if (amountAllocated > due + 0.001) throw new AppError('Allocation exceeds invoice balance', 400);
      await paymentAllocation.create({ payment_id: item.id, invoice_type: invoiceType, invoice_id: invoice.id, allocated_amount: amountAllocated }, { transaction });
      if (invoiceType !== 'retail_sale') {
        const paid = Number(invoice.paid_amount || 0) + amountAllocated;
        await invoice.update({ paid_amount: paid, status: paid >= Number(invoice.total_amount) - 0.001 ? 'paid' : 'partial' }, { transaction });
      }
    }
    await item.update({ journal_entry_id: journal.id, business_day_id: journal.business_day_id || null }, { transaction });
    await transaction.commit();
    res.status(201).json(await payment.findOne({ where: { id: item.id }, include: [paymentAllocation, db.paymentMethod] }));
  } catch (error) { await transaction.rollback(); next(error); }
};
exports.createOutgoing = (req, res, next) => createPayment(req, res, next, 'outgoing');
exports.createIncoming = (req, res, next) => createPayment(req, res, next, 'incoming');
