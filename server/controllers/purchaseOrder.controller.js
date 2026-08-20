const db = require('../models');
const { purchaseOrder, purchaseOrderItem, purchaseReceipt, purchaseReceiptItem, journalEntry, stockMovement } = db;
const { AppError } = require('../middleware/errorHandler');
const inventoryReceipt = require('../services/inventoryReceipt.service');

exports.getAll = async (req, res, next) => {
  try {
    const pos = await purchaseOrder.findAll({
      where: { tenant_id: req.tenantId },
      include: [db.supplier, purchaseOrderItem]
    });
    res.status(200).json(pos);
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const po = await purchaseOrder.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, include: [purchaseOrderItem] });
    if (!po) throw new AppError('Not found', 404);
    res.status(200).json(po);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { items = [], ...header } = req.body;
    const calculated = items.map(row => {
      const base = Number(row.quantity) * Number(row.unit_price);
      const tax = base * Number(row.tax_rate || 0) / 100;
      return { ...row, tax_amount: tax, total: base + tax };
    });
    const subtotal = calculated.reduce((sum, row) => sum + Number(row.quantity) * Number(row.unit_price), 0);
    const taxAmount = calculated.reduce((sum, row) => sum + row.tax_amount, 0);
    const sequence = await purchaseOrder.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    const po = await purchaseOrder.create({
      ...header,
      tenant_id: req.tenantId,
      po_number: header.po_number || `PO-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`,
      subtotal,
      tax_amount: taxAmount,
      total_amount: subtotal + taxAmount
    }, { transaction });
    if (calculated.length) {
      await purchaseOrderItem.bulkCreate(calculated.map(row => ({
        ...row, purchase_order_id: po.id
      })), { transaction });
    }
    await transaction.commit();
    res.status(201).json(po);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const [updated] = await purchaseOrder.update(req.body, { where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!updated) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) { next(error); }
};

exports.approve = async (req, res, next) => {
  try {
    const [updated] = await purchaseOrder.update(
      { status: 'approved', approved_by: req.user.id },
      { where: { id: req.params.id, tenant_id: req.tenantId, status: 'draft' } }
    );
    if (!updated) throw new AppError('Purchase order cannot be approved', 400);
    res.status(200).json({ message: 'Approved' });
  } catch (error) { next(error); }
};

exports.cancel = async (req, res, next) => {
  try {
    const [updated] = await purchaseOrder.update(
      { status: 'cancelled' },
      { where: { id: req.params.id, tenant_id: req.tenantId } }
    );
    if (!updated) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Cancelled' });
  } catch (error) { next(error); }
};

exports.receive = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const po = await purchaseOrder.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      include: [purchaseOrderItem],
      transaction
    });
    if (!po) throw new AppError('Not found', 404);
    if (!['approved', 'sent', 'partial'].includes(po.status)) {
      throw new AppError('Only an approved purchase order can be received', 400);
    }

    const receiptSequence = await purchaseReceipt.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    const receipt = await purchaseReceipt.create({
      tenant_id: req.tenantId,
      receipt_number: `GRN-${new Date().getFullYear()}-${String(receiptSequence).padStart(4, '0')}`,
      purchase_order_id: po.id,
      received_date: new Date(),
      created_by: req.user.id
    }, { transaction });

    for (const [index, row] of po.purchaseOrderItems.entries()) {
      const quantity = Number(row.quantity) - Number(row.received_qty || 0);
      if (quantity <= 0) continue;
      const unitCost = Number(row.unit_price || 0);
      const received = await inventoryReceipt.receiveMaterial({ tenantId: req.tenantId, materialType: row.material_type, materialId: row.material_id, quantity, unitCost, batchNumber: `${po.po_number}-${index + 1}`, supplierId: po.supplier_id, purchaseId: po.id, receivedDate: new Date(), referenceId: receipt.id, createdBy: req.user.id, transaction });
      const batch = received.batch;
      await purchaseReceiptItem.create({
        receipt_id: receipt.id,
        po_item_id: row.id,
        material_type: row.material_type,
        material_id: row.material_id,
        quantity,
        batch_number: batch.batch_number
      }, { transaction });
      await row.update({ received_qty: Number(row.quantity) }, { transaction });
    }

    await po.update({ status: 'completed' }, { transaction });
    await transaction.commit();
    res.status(200).json(receipt);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
