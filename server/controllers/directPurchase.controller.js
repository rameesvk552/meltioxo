const db = require('../models');
const { purchaseReceipt, purchaseReceiptItem, purchaseInvoice, payment, paymentAllocation, stockMovement } = db;
const { AppError } = require('../middleware/errorHandler');
const accounting = require('../services/accounting.service');
const inventoryReceipt = require('../services/inventoryReceipt.service');
const { ACCOUNT_CODES } = require('../config/constants');

exports.getAll = async (req, res, next) => {
  try {
    const invoices = await purchaseInvoice.findAll({
      where: { 
        tenant_id: req.tenantId,
        purchase_order_id: null
      },
      include: [
        db.supplier,
        {
          model: purchaseReceipt,
          include: [purchaseReceiptItem]
        }
      ],
      order: [['created_at', 'DESC']]
    });
    res.status(200).json(invoices);
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const invoice = await purchaseInvoice.findOne({
      where: { 
        id: req.params.id,
        tenant_id: req.tenantId,
        purchase_order_id: null
      },
      include: [
        db.supplier,
        {
          model: purchaseReceipt,
          include: [purchaseReceiptItem]
        }
      ]
    });
    if (!invoice) throw new AppError('Not found', 404);
    res.status(200).json(invoice);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { supplier_id, invoice_date, due_date, notes, items = [], paid_immediately } = req.body;

    if (!items.length) {
      throw new AppError('Direct purchase must contain at least one item', 400);
    }
    const supplier = await db.supplier.findOne({ where: { id: supplier_id, tenant_id: req.tenantId, is_active: true }, transaction });
    if (!supplier) throw new AppError('Select an active supplier', 400);
    if (String(invoice_date || '').slice(0, 10) > new Date().toISOString().slice(0, 10)) throw new AppError('Future-dated purchases are not allowed', 400);

    // 1. Create Purchase Receipt (GRN)
    const receiptSequence = await purchaseReceipt.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    const receiptNumber = `GRN-DIR-${new Date().getFullYear()}-${String(receiptSequence).padStart(4, '0')}`;
    
    const receipt = await purchaseReceipt.create({
      tenant_id: req.tenantId,
      receipt_number: receiptNumber,
      purchase_order_id: null,
      received_date: invoice_date || new Date(),
      notes,
      created_by: req.user.id
    }, { transaction });

    // Calculate totals and process inventory changes for each item
    let subtotal = 0;
    let taxAmount = 0;
    const deficitVariances = [];
    
    for (const [index, row] of items.entries()) {
      const qty = Number(row.quantity);
      const unitPrice = accounting.money(row.unit_price, 'Unit price');
      const taxRate = Number(row.tax_rate || 0);
      if (!['raw', 'packaging', 'finished'].includes(row.material_type)) throw new AppError('Invalid purchase item type', 400);
      if (!Number.isFinite(qty) || qty <= 0) throw new AppError('Purchase quantity must be greater than zero', 400);
      if (unitPrice < 0) throw new AppError('Unit price cannot be negative', 400);
      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new AppError('Tax rate must be between 0 and 100', 400);
      
      const itemSubtotal = accounting.money(qty * unitPrice);
      const itemTax = accounting.money(itemSubtotal * (taxRate / 100));
      
      subtotal += itemSubtotal;
      taxAmount += itemTax;

      const received = await inventoryReceipt.receiveMaterial({ tenantId: req.tenantId, materialType: row.material_type, materialId: row.material_id, quantity: qty, unitCost: unitPrice, batchNumber: `${receipt.receipt_number}-${index + 1}`, supplierId: supplier_id, purchaseId: null, receivedDate: invoice_date || new Date(), referenceId: receipt.id, createdBy: req.user.id, transaction });
      const batch = received.batch;
      if (Math.abs(received.cost_variance) > 0.0001) deficitVariances.push({ material_type: row.material_type, amount: accounting.money(received.cost_variance), description: `Negative stock cost reconciliation for ${batch.batch_number}` });

      // Create Purchase Receipt Item
      await purchaseReceiptItem.create({
        receipt_id: receipt.id,
        po_item_id: null,
        material_type: row.material_type,
        material_id: row.material_id,
        quantity: qty,
        batch_number: batch.batch_number
      }, { transaction });
    }

    subtotal = accounting.money(subtotal);
    taxAmount = accounting.money(taxAmount);
    const totalAmount = accounting.money(subtotal + taxAmount);

    // 2. Create Purchase Invoice
    const invoiceSequence = await purchaseInvoice.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    const invoiceNumber = `PINV-DIR-${new Date().getFullYear()}-${String(invoiceSequence).padStart(4, '0')}`;

    const invoice = await purchaseInvoice.create({
      tenant_id: req.tenantId,
      invoice_number: invoiceNumber,
      purchase_order_id: null,
      receipt_id: receipt.id,
      supplier_id,
      invoice_date: invoice_date || new Date(),
      due_date: due_date || invoice_date || new Date(),
      total_amount: totalAmount,
      paid_amount: 0,
      status: 'unpaid'
    }, { transaction });

    // Inventory is recognized at the actual receipt cost; supplier credit is the
    // matching liability. Tax is kept separately as recoverable input tax.
    const codes = ACCOUNT_CODES;
    const accounts = await accounting.getAccountsByCode(req.tenantId, [codes.RAW_INVENTORY, codes.PKG_INVENTORY, codes.FG_INVENTORY, codes.INPUT_TAX, codes.AP, codes.PURCHASE_VARIANCE], transaction);
    const inventoryAccountFor = materialType => accounts[materialType === 'raw' ? codes.RAW_INVENTORY : materialType === 'packaging' ? codes.PKG_INVENTORY : codes.FG_INVENTORY];
    const inventoryLines = items.map(row => ({
      account_id: inventoryAccountFor(row.material_type).id,
      debit_amount: accounting.money(Number(row.quantity) * Number(row.unit_price || 0)),
      description: `Received on ${receipt.receipt_number}`
    }));
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
    if (taxAmount) inventoryLines.push({ account_id: accounts[codes.INPUT_TAX].id, debit_amount: taxAmount, description: `Input tax on ${invoiceNumber}` });
    inventoryLines.push({ account_id: accounts[codes.AP].id, credit_amount: totalAmount, description: `Supplier invoice ${invoiceNumber}` });
    const purchaseJournal = await accounting.createAndPost(req.tenantId, {
      entry_date: invoice_date || new Date(), reference_type: 'purchase_invoice', reference_id: invoice.id,
      narration: 'Direct purchase receipt and supplier invoice', lines: inventoryLines
    }, req.user.id, transaction);
    await receipt.update({ journal_entry_id: purchaseJournal.id }, { transaction });
    await invoice.update({ journal_entry_id: purchaseJournal.id }, { transaction });

    // 3. Handle Immediate Payment if checked
    if (paid_immediately) {
      const paymentSplits = await accounting.resolvePaymentSplits(req.tenantId, req.body, totalAmount, transaction);
      const paymentSequence = await payment.count({ 
        where: { tenant_id: req.tenantId, payment_type: 'outgoing' }, 
        transaction 
      }) + 1;
      const paymentRecords = [];
      for (const [index, split] of paymentSplits.entries()) {
        const paymentNumber = `PAY-OUT-${new Date().getFullYear()}-${String(paymentSequence + index).padStart(4, '0')}`;
        const paymentRecord = await payment.create({
          tenant_id: req.tenantId,
          payment_number: paymentNumber,
          payment_type: 'outgoing',
          party_type: 'supplier',
          party_id: supplier_id,
          payment_method_id: split.method.id,
          payment_mode: accounting.paymentModeForType(split.method.method_type),
          bank_account_id: split.method.account.id,
          amount: split.amount,
          payment_date: invoice_date || new Date(),
          created_by: req.user.id
        }, { transaction });
        paymentRecords.push(paymentRecord);
        await paymentAllocation.create({
          payment_id: paymentRecord.id,
          invoice_type: 'purchase',
          invoice_id: invoice.id,
          allocated_amount: split.amount
        }, { transaction });
      }

      await invoice.update({
        paid_amount: totalAmount,
        status: 'paid'
      }, { transaction });
      const paymentJournal = await accounting.createAndPost(req.tenantId, {
        entry_date: invoice_date || new Date(), reference_type: 'purchase_payment', reference_id: invoice.id,
        narration: `Supplier payment for ${invoiceNumber}`,
        lines: [
          { account_id: accounts[codes.AP].id, debit_amount: totalAmount, description: `Payment for ${invoiceNumber}` },
          ...paymentSplits.map(split => ({ account_id: split.method.account.id, credit_amount: split.amount, description: `${split.method.name} payment for ${invoiceNumber}` }))
        ]
      }, req.user.id, transaction);
      await Promise.all(paymentRecords.map(record => record.update({ journal_entry_id: paymentJournal.id }, { transaction })));
    }

    await transaction.commit();
    res.status(201).json(invoice);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
