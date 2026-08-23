const db = require('../models');
const { purchaseReceipt, purchaseReceiptItem, purchaseInvoice, payment, paymentAllocation } = db;
const { AppError } = require('../middleware/errorHandler');
const accounting = require('../services/accounting.service');
const inventoryReceipt = require('../services/inventoryReceipt.service');
const { ACCOUNT_CODES } = require('../config/constants');
const { Op } = require('sequelize');

const directPurchaseWhere = req => ({ id: req.params.id, tenant_id: req.tenantId, purchase_order_id: null });
const invoiceIncludes = [db.supplier, { model: purchaseReceipt, include: [purchaseReceiptItem] }];

const prepareDraft = async (tenantId, payload, transaction) => {
  const { supplier_id, invoice_date, due_date, notes, items = [], paid_immediately = false, payments = [] } = payload;
  if (!items.length) throw new AppError('Direct purchase must contain at least one item', 400);
  const supplier = await db.supplier.findOne({ where: { id: supplier_id, tenant_id: tenantId, is_active: true }, transaction });
  if (!supplier) throw new AppError('Select an active supplier', 400);

  const effectiveInvoiceDate = invoice_date || new Date().toISOString().slice(0, 10);
  if (String(effectiveInvoiceDate).slice(0, 10) > new Date().toISOString().slice(0, 10)) {
    throw new AppError('Future-dated purchases are not allowed', 400);
  }

  let subtotal = 0;
  let taxAmount = 0;
  const calculatedItems = items.map((row, index) => {
    const quantity = Number(row.quantity);
    const unitPrice = accounting.money(row.unit_price, `Item ${index + 1} unit price`);
    const taxRate = Number(row.tax_rate || 0);
    if (!['raw', 'packaging', 'finished'].includes(row.material_type)) throw new AppError('Invalid purchase item type', 400);
    if (!row.material_id) throw new AppError(`Select a material for item ${index + 1}`, 400);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new AppError('Purchase quantity must be greater than zero', 400);
    if (unitPrice < 0) throw new AppError('Unit price cannot be negative', 400);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new AppError('Tax rate must be between 0 and 100', 400);
    const itemSubtotal = accounting.money(quantity * unitPrice);
    const itemTax = accounting.money(itemSubtotal * taxRate / 100);
    subtotal += itemSubtotal;
    taxAmount += itemTax;
    return { material_type: row.material_type, material_id: row.material_id, quantity, unit_price: unitPrice, tax_rate: taxRate };
  });

  const totalAmount = accounting.money(accounting.money(subtotal) + accounting.money(taxAmount));
  const paymentSplits = paid_immediately ? accounting.normalizePaymentSplits({ payments }, totalAmount) : null;
  return {
    supplier_id,
    invoice_date: effectiveInvoiceDate,
    due_date: due_date || effectiveInvoiceDate,
    notes: notes || null,
    items: calculatedItems,
    total_amount: totalAmount,
    paid_immediately: Boolean(paid_immediately),
    payment_splits: paymentSplits
  };
};

const replaceDraftItems = async (receiptId, items, transaction) => {
  await purchaseReceiptItem.destroy({ where: { receipt_id: receiptId }, transaction });
  await purchaseReceiptItem.bulkCreate(items.map(row => ({ receipt_id: receiptId, po_item_id: null, ...row, batch_number: null })), { transaction });
};

exports.getAll = async (req, res, next) => {
  try {
    const invoices = await purchaseInvoice.findAll({
      where: { tenant_id: req.tenantId, purchase_order_id: null },
      include: invoiceIncludes,
      order: [['created_at', 'DESC']]
    });
    res.status(200).json(invoices);
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const invoice = await purchaseInvoice.findOne({ where: directPurchaseWhere(req), include: invoiceIncludes });
    if (!invoice) throw new AppError('Purchase not found', 404);
    res.status(200).json(invoice);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const draft = await prepareDraft(req.tenantId, req.body, transaction);
    const receiptSequence = await purchaseReceipt.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    const receipt = await purchaseReceipt.create({
      tenant_id: req.tenantId,
      receipt_number: `GRN-DIR-${new Date().getFullYear()}-${String(receiptSequence).padStart(4, '0')}`,
      purchase_order_id: null,
      received_date: draft.invoice_date,
      notes: draft.notes,
      created_by: req.user.id
    }, { transaction });
    await replaceDraftItems(receipt.id, draft.items, transaction);

    const invoiceSequence = await purchaseInvoice.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    const invoice = await purchaseInvoice.create({
      tenant_id: req.tenantId,
      invoice_number: `PINV-DIR-${new Date().getFullYear()}-${String(invoiceSequence).padStart(4, '0')}`,
      purchase_order_id: null,
      receipt_id: receipt.id,
      supplier_id: draft.supplier_id,
      invoice_date: draft.invoice_date,
      due_date: draft.due_date,
      total_amount: draft.total_amount,
      paid_amount: 0,
      status: 'draft',
      paid_immediately: draft.paid_immediately,
      payment_splits: draft.payment_splits
    }, { transaction });

    await transaction.commit();
    res.status(201).json(invoice);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.update = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const invoice = await purchaseInvoice.findOne({
      where: directPurchaseWhere(req),
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!invoice) throw new AppError('Purchase not found', 404);
    if (invoice.status !== 'draft') throw new AppError('Only draft purchases can be edited', 400);
    const receipt = await purchaseReceipt.findOne({ where: { id: invoice.receipt_id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!receipt) throw new AppError('Purchase draft is missing its receipt', 409);

    const draft = await prepareDraft(req.tenantId, req.body, transaction);
    await receipt.update({ received_date: draft.invoice_date, notes: draft.notes }, { transaction });
    await replaceDraftItems(receipt.id, draft.items, transaction);
    await invoice.update({
      supplier_id: draft.supplier_id,
      invoice_date: draft.invoice_date,
      due_date: draft.due_date,
      total_amount: draft.total_amount,
      paid_immediately: draft.paid_immediately,
      payment_splits: draft.payment_splits
    }, { transaction });

    await transaction.commit();
    res.status(200).json(invoice);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.post = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const invoice = await purchaseInvoice.findOne({
      where: directPurchaseWhere(req),
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!invoice) throw new AppError('Purchase not found', 404);
    if (invoice.status !== 'draft') throw new AppError('Only draft purchases can be posted', 400);
    const receipt = await purchaseReceipt.findOne({ where: { id: invoice.receipt_id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE });
    const items = receipt ? await purchaseReceiptItem.findAll({ where: { receipt_id: receipt.id }, order: [['created_at', 'ASC']], transaction, lock: transaction.LOCK.UPDATE }) : [];
    if (!receipt || !items.length) throw new AppError('Purchase draft has no items', 400);

    const supplier = await db.supplier.findOne({ where: { id: invoice.supplier_id, tenant_id: req.tenantId, is_active: true }, transaction });
    if (!supplier) throw new AppError('The selected supplier is no longer active', 400);
    if (String(invoice.invoice_date || '').slice(0, 10) > new Date().toISOString().slice(0, 10)) {
      throw new AppError('Future-dated purchases are not allowed', 400);
    }

    let taxAmount = 0;
    const deficitVariances = [];
    for (const [index, row] of items.entries()) {
      const quantity = Number(row.quantity);
      const unitPrice = accounting.money(row.unit_price, `Item ${index + 1} unit price`);
      const taxRate = Number(row.tax_rate || 0);
      taxAmount += accounting.money(quantity * unitPrice * taxRate / 100);
      const received = await inventoryReceipt.receiveMaterial({
        tenantId: req.tenantId,
        materialType: row.material_type,
        materialId: row.material_id,
        quantity,
        unitCost: unitPrice,
        batchNumber: `${receipt.receipt_number}-${index + 1}`,
        supplierId: invoice.supplier_id,
        purchaseId: invoice.id,
        receivedDate: invoice.invoice_date,
        referenceId: receipt.id,
        createdBy: req.user.id,
        transaction
      });
      const batch = received.batch;
      if (Math.abs(received.cost_variance) > 0.0001) {
        deficitVariances.push({ material_type: row.material_type, amount: accounting.money(received.cost_variance), description: `Negative stock cost reconciliation for ${batch.batch_number}` });
      }
      await row.update({ batch_number: batch.batch_number }, { transaction });
    }

    taxAmount = accounting.money(taxAmount);
    const totalAmount = accounting.money(invoice.total_amount);
    const codes = ACCOUNT_CODES;
    const accounts = await accounting.getAccountsByCode(req.tenantId, [codes.RAW_INVENTORY, codes.PKG_INVENTORY, codes.FG_INVENTORY, codes.INPUT_TAX, codes.AP, codes.PURCHASE_VARIANCE], transaction);
    const inventoryAccountFor = materialType => accounts[materialType === 'raw' ? codes.RAW_INVENTORY : materialType === 'packaging' ? codes.PKG_INVENTORY : codes.FG_INVENTORY];
    const inventoryLines = items.map(row => ({
      account_id: inventoryAccountFor(row.material_type).id,
      debit_amount: accounting.money(Number(row.quantity) * Number(row.unit_price || 0)),
      description: `Received on ${receipt.receipt_number}`
    })).filter(line => line.debit_amount > 0);
    deficitVariances.forEach(variance => {
      const inventoryAccount = inventoryAccountFor(variance.material_type);
      if (variance.amount > 0) {
        inventoryLines.push({ account_id: accounts[codes.PURCHASE_VARIANCE].id, debit_amount: variance.amount, description: variance.description });
        inventoryLines.push({ account_id: inventoryAccount.id, credit_amount: variance.amount, description: variance.description });
      } else {
        inventoryLines.push({ account_id: inventoryAccount.id, debit_amount: Math.abs(variance.amount), description: variance.description });
        inventoryLines.push({ account_id: accounts[codes.PURCHASE_VARIANCE].id, credit_amount: Math.abs(variance.amount), description: variance.description });
      }
    });
    if (taxAmount) inventoryLines.push({ account_id: accounts[codes.INPUT_TAX].id, debit_amount: taxAmount, description: `Input tax on ${invoice.invoice_number}` });
    inventoryLines.push({ account_id: accounts[codes.AP].id, credit_amount: totalAmount, description: `Supplier invoice ${invoice.invoice_number}` });

    let purchaseJournal = null;
    if (totalAmount > 0) {
      purchaseJournal = await accounting.createAndPost(req.tenantId, {
        entry_date: invoice.invoice_date,
        reference_type: 'purchase_invoice',
        reference_id: invoice.id,
        narration: 'Direct purchase receipt and supplier invoice',
        lines: inventoryLines
      }, req.user.id, transaction);
      await receipt.update({ journal_entry_id: purchaseJournal.id }, { transaction });
    }

    let finalStatus = 'unpaid';
    let paidAmount = 0;
    if (invoice.paid_immediately) {
      const paymentSplits = await accounting.resolvePaymentSplits(req.tenantId, { payments: invoice.payment_splits || [] }, totalAmount, transaction);
      const paymentSequence = await payment.count({ where: { tenant_id: req.tenantId, payment_type: 'outgoing' }, transaction }) + 1;
      const paymentRecords = [];
      for (const [index, split] of paymentSplits.entries()) {
        const paymentRecord = await payment.create({
          tenant_id: req.tenantId,
          payment_number: `PAY-OUT-${new Date().getFullYear()}-${String(paymentSequence + index).padStart(4, '0')}`,
          payment_type: 'outgoing',
          party_type: 'supplier',
          party_id: invoice.supplier_id,
          payment_method_id: split.method.id,
          payment_mode: accounting.paymentModeForType(split.method.method_type),
          bank_account_id: split.method.account.id,
          amount: split.amount,
          payment_date: invoice.invoice_date,
          created_by: req.user.id
        }, { transaction });
        paymentRecords.push(paymentRecord);
        await paymentAllocation.create({ payment_id: paymentRecord.id, invoice_type: 'purchase', invoice_id: invoice.id, allocated_amount: split.amount }, { transaction });
      }
      const paymentJournal = await accounting.createAndPost(req.tenantId, {
        entry_date: invoice.invoice_date,
        reference_type: 'purchase_payment',
        reference_id: invoice.id,
        narration: `Supplier payment for ${invoice.invoice_number}`,
        lines: [
          { account_id: accounts[codes.AP].id, debit_amount: totalAmount, description: `Payment for ${invoice.invoice_number}` },
          ...paymentSplits.map(split => ({ account_id: split.method.account.id, credit_amount: split.amount, description: `${split.method.name} payment for ${invoice.invoice_number}` }))
        ]
      }, req.user.id, transaction);
      await Promise.all(paymentRecords.map(record => record.update({ journal_entry_id: paymentJournal.id }, { transaction })));
      finalStatus = 'paid';
      paidAmount = totalAmount;
    }

    await invoice.update({ status: finalStatus, paid_amount: paidAmount, journal_entry_id: purchaseJournal?.id || null }, { transaction });
    await transaction.commit();
    res.status(200).json({ message: 'Purchase posted successfully', id: invoice.id, status: finalStatus });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Return the stock impact before deleting a purchase. The client uses this
// response to show the user exactly what will be removed from inventory.
exports.delete = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const invoice = await purchaseInvoice.findOne({
      where: directPurchaseWhere(req),
      include: [{ model: purchaseReceipt, include: [purchaseReceiptItem] }],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!invoice) throw new AppError('Purchase not found', 404);

    const receiptId = invoice.receipt_id;
    const batches = await db.stockBatch.findAll({
      where: { tenant_id: req.tenantId, purchase_id: invoice.id },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    // Older posted purchases did not populate purchase_id. The receipt
    // movement is still an exact and safe fallback for those records.
    const fallbackMovements = batches.length ? [] : await db.stockMovement.findAll({
      where: { tenant_id: req.tenantId, reference_type: 'purchase_receipt', reference_id: receiptId, movement_type: 'purchase', direction: 'in' },
      transaction
    });
    const batchIds = [...new Set([...batches.map(row => row.id), ...fallbackMovements.map(row => row.batch_id).filter(Boolean)])];
    const allMovements = batchIds.length ? await db.stockMovement.findAll({ where: { tenant_id: req.tenantId, batch_id: { [Op.in]: batchIds } }, transaction }) : [];
    const outbound = allMovements.filter(row => row.direction === 'out' && Number(row.quantity || 0) > 0);
    const stockLines = (batches.length ? batches : fallbackMovements.map(movement => ({ material_type: movement.material_type, material_id: movement.material_id, quantity: movement.quantity, remaining_qty: movement.quantity, batch_number: movement.batch_id || 'purchase lot' }))).map(row => ({
      material_type: row.material_type,
      material_id: row.material_id,
      quantity: Number(row.quantity || 0),
      remaining_qty: Number(row.remaining_qty || 0),
      batch_number: row.batch_number
    }));

    if (req.query.confirm !== 'true' && stockLines.length) {
      await transaction.rollback();
      return res.status(409).json({
        code: 'PURCHASE_DELETE_CONFIRMATION_REQUIRED',
        message: 'This purchase added stock. Deleting it will also remove that stock.',
        stock: stockLines,
        sold_or_consumed: outbound.map(row => ({ quantity: Number(row.quantity || 0), reference_type: row.reference_type }))
      });
    }

    const allocations = await paymentAllocation.findAll({ where: { invoice_type: 'purchase', invoice_id: invoice.id }, transaction });
    const paymentIds = allocations.map(row => row.payment_id);
    const payments = paymentIds.length ? await payment.findAll({ where: { id: { [Op.in]: paymentIds }, tenant_id: req.tenantId }, transaction }) : [];
    for (const item of payments) {
      if (item.journal_entry_id) await accounting.reverseJournal(req.tenantId, item.journal_entry_id, req.user.id, new Date().toISOString().slice(0, 10), `Deleted purchase ${invoice.invoice_number} payment`, transaction);
    }
    if (invoice.journal_entry_id) await accounting.reverseJournal(req.tenantId, invoice.journal_entry_id, req.user.id, new Date().toISOString().slice(0, 10), `Deleted purchase ${invoice.invoice_number}`, transaction);

    for (const row of stockLines) {
      const model = row.material_type === 'raw' ? db.rawMaterial : row.material_type === 'packaging' ? db.packagingMaterial : db.finishedGood;
      const material = await model.findOne({ where: { id: row.material_id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE });
      if (material) await material.update({ current_stock: Number(material.current_stock || 0) - row.quantity }, { transaction });
    }
    if (batchIds.length) await db.stockMovement.destroy({ where: { tenant_id: req.tenantId, batch_id: { [Op.in]: batchIds }, movement_type: 'purchase', direction: 'in' }, transaction });
    if (batches.length) await db.stockBatch.destroy({ where: { tenant_id: req.tenantId, id: { [Op.in]: batches.map(row => row.id) } }, transaction });
    await paymentAllocation.destroy({ where: { invoice_type: 'purchase', invoice_id: invoice.id }, transaction });
    if (paymentIds.length) await payment.destroy({ where: { id: { [Op.in]: paymentIds }, tenant_id: req.tenantId }, transaction });
    if (invoice.receipt_id) {
      await purchaseReceiptItem.destroy({ where: { receipt_id: invoice.receipt_id }, transaction });
      await purchaseReceipt.destroy({ where: { id: invoice.receipt_id, tenant_id: req.tenantId }, transaction });
    }
    await invoice.destroy({ transaction });
    await transaction.commit();
    res.status(200).json({ message: 'Purchase deleted successfully', sold_or_consumed: outbound.length });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
