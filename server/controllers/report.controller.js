const reportService = require('../services/report.service');

exports.trialBalance = async (req, res, next) => {
  try { res.json(await reportService.trialBalance(req.tenantId, req.query.as_of)); } catch (error) { next(error); }
};
exports.profitLoss = async (req, res, next) => {
  try {
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const from = req.query.from || `${new Date().getUTCFullYear()}-01-01`;
    const groupBy = req.query.group_by || 'month';
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(from) || !datePattern.test(to) || from > to) {
      return res.status(400).json({ message: 'Choose a valid date range.' });
    }
    if (!['day', 'month', 'year'].includes(groupBy)) {
      return res.status(400).json({ message: 'group_by must be day, month, or year.' });
    }
    res.json(await reportService.profitAndLoss(req.tenantId, from, to, groupBy));
  } catch (error) { next(error); }
};
exports.profitLossStatement = async (req, res, next) => {
  try {
    const now = new Date();
    const to = req.query.to || now.toISOString().slice(0, 10);
    const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    const from = req.query.from || `${fyStartYear}-04-01`;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(from) || !datePattern.test(to) || from > to) {
      return res.status(400).json({ message: 'Choose a valid date range.' });
    }
    res.json(await reportService.profitAndLossStatement(req.tenantId, from, to));
  } catch (error) { next(error); }
};
exports.purchaseReport = async (req, res, next) => {
  try {
    const db = require('../models');
    const { Op } = require('sequelize');
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const from = req.query.from || to;
    if (!datePattern.test(from) || !datePattern.test(to) || from > to) return res.status(400).json({ message: 'Choose a valid date range.' });
    const invoices = await db.purchaseInvoice.findAll({
      where: { tenant_id: req.tenantId, invoice_date: { [Op.between]: [from, to] } },
      include: [db.supplier, { model: db.purchaseReceipt, include: [db.purchaseReceiptItem] }],
      order: [['invoice_date', 'DESC'], ['created_at', 'DESC']]
    });
    const ids = { raw: new Set(), packaging: new Set(), finished: new Set() };
    invoices.forEach(invoice => (invoice.purchaseReceipt?.purchaseReceiptItems || []).forEach(item => ids[item.material_type]?.add(item.material_id)));
    const [raw, packaging, finished] = await Promise.all([
      ids.raw.size ? db.rawMaterial.findAll({ where: { tenant_id: req.tenantId, id: [...ids.raw] }, attributes: ['id', 'name', 'unit'] }) : [],
      ids.packaging.size ? db.packagingMaterial.findAll({ where: { tenant_id: req.tenantId, id: [...ids.packaging] }, attributes: ['id', 'name'] }) : [],
      ids.finished.size ? db.finishedGood.findAll({ where: { tenant_id: req.tenantId, id: [...ids.finished] }, include: [db.product], attributes: ['id', 'name', 'sku', 'size_label'] }) : []
    ]);
    const names = new Map([
      ...raw.map(item => [item.id, { name: item.name, unit: item.unit || 'units' }]),
      ...packaging.map(item => [item.id, { name: item.name, unit: 'pcs' }]),
      ...finished.map(item => [item.id, { name: `${item.product?.name || item.name}${item.size_label ? ` · ${item.size_label}` : ''}`, unit: 'units', sku: item.sku }])
    ]);
    const rows = [];
    invoices.forEach(invoice => (invoice.purchaseReceipt?.purchaseReceiptItems || []).forEach(item => {
      const detail = names.get(item.material_id) || { name: 'Item not found', unit: 'units' };
      const unitPrice = Number(item.unit_price || 0), taxRate = Number(item.tax_rate || 0);
      const subtotal = Number(item.quantity || 0) * unitPrice;
      rows.push({ id: item.id, invoice_id: invoice.id, invoice_number: invoice.invoice_number, invoice_date: invoice.invoice_date, supplier: invoice.supplier?.name || '—', receipt_number: invoice.purchaseReceipt?.receipt_number || '—', material_type: item.material_type, item_name: detail.name, sku: detail.sku || null, unit: detail.unit, quantity: Number(item.quantity || 0), unit_price: unitPrice, tax_rate: taxRate, tax_amount: subtotal * taxRate / 100, line_total: subtotal * (1 + taxRate / 100), status: invoice.status, total_amount: Number(invoice.total_amount || 0), paid_amount: Number(invoice.paid_amount || 0) });
    }));
    res.json({ summary: { invoices: invoices.length, total: invoices.reduce((sum, item) => sum + Number(item.total_amount || 0), 0), paid: invoices.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0), due: invoices.reduce((sum, item) => sum + Number(item.total_amount || 0) - Number(item.paid_amount || 0), 0) }, rows });
  } catch (error) { next(error); }
};
exports.balanceSheet = async (req, res, next) => {
  try { res.json(await reportService.balanceSheet(req.tenantId, req.query.as_of)); } catch (error) { next(error); }
};
exports.cashFlow = async (req, res, next) => {
  try { res.status(200).json(await reportService.cashFlow(req.tenantId, req.query.from, req.query.to)); } catch (error) { next(error); }
};
exports.agingPayables = async (req, res, next) => {
  try { res.json(await reportService.agingReport(req.tenantId, 'payable')); } catch (error) { next(error); }
};
exports.agingReceivables = async (req, res, next) => {
  try { res.json(await reportService.agingReport(req.tenantId, 'receivable')); } catch (error) { next(error); }
};
exports.stockReport = async (req, res, next) => {
  try {
    const db = require('../models');
    const [batches, deficits] = await Promise.all([
      db.stockBatch.findAll({ where: { tenant_id: req.tenantId } }),
      db.inventoryDeficit.findAll({ where: { tenant_id: req.tenantId, status: 'open' } })
    ]);
    const valuation = batches.reduce((result, batch) => {
      const type = batch.material_type;
      result[type] = (result[type] || 0) + Number(batch.remaining_qty || 0) * Number(batch.cost_per_unit || 0);
      return result;
    }, { raw: 0, packaging: 0, finished: 0 });
    const deficitValuation = deficits.reduce((result, row) => {
      result[row.material_type] += Number(row.remaining_qty || 0) * Number(row.estimated_unit_cost || 0);
      return result;
    }, { raw: 0, packaging: 0 });
    valuation.raw -= deficitValuation.raw;
    valuation.packaging -= deficitValuation.packaging;
    res.json({ valuation, deficit_valuation: deficitValuation, open_deficits: deficits, total: Object.values(valuation).reduce((sum, value) => sum + value, 0) });
  } catch (error) { next(error); }
};
exports.productionReport = async (req, res, next) => {
  try {
    const db = require('../models');
    const orders = await db.productionOrder.findAll({
      where: { tenant_id: req.tenantId },
      include: [
        db.formula,
        { model: db.productionOutput, include: [{ model: db.finishedGood, include: [db.product] }] },
        db.productionMaterial
      ],
      order: [['created_at', 'DESC']]
    });
    const rawIds = new Set();
    const packagingIds = new Set();
    orders.forEach(order => order.productionMaterials.forEach(material => {
      if (material.material_type === 'raw') rawIds.add(material.material_id);
      else packagingIds.add(material.material_id);
    }));
    const [rawMaterials, packagingMaterials] = await Promise.all([
      rawIds.size ? db.rawMaterial.findAll({ where: { id: [...rawIds], tenant_id: req.tenantId }, attributes: ['id', 'name', 'unit', 'current_stock', 'avg_cost'] }) : [],
      packagingIds.size ? db.packagingMaterial.findAll({ where: { id: [...packagingIds], tenant_id: req.tenantId }, attributes: ['id', 'name', 'current_stock', 'avg_cost'] }) : []
    ]);
    const materialsById = new Map([
      ...rawMaterials.map(item => [item.id, { name: item.name, unit: item.unit || 'units', stock: Number(item.current_stock), cost: Number(item.avg_cost) }]),
      ...packagingMaterials.map(item => [item.id, { name: item.name, unit: 'pcs', stock: Number(item.current_stock), cost: Number(item.avg_cost) }])
    ]);

    const batches = orders.map(order => {
      const outputs = order.productionOutputs.map(output => {
        const variant = output.finishedGood;
        const fillMl = Number(variant?.fill_quantity_ml || 0);
        const planned = Number(output.planned_qty || 0);
        const actual = output.actual_qty == null ? null : Number(output.actual_qty);
        return {
          id: output.id,
          variant: `${variant?.product?.name || variant?.name || 'Variant'} ${variant?.size_label || ''}`.trim(),
          sku: variant?.sku || '—', fill_ml: fillMl, planned_qty: planned, actual_qty: actual,
          planned_ml: planned * fillMl, actual_ml: actual == null ? null : actual * fillMl
        };
      });
      const materialRows = order.productionMaterials.map(material => {
        const details = materialsById.get(material.material_id) || { name: 'Material not found', unit: material.material_type === 'raw' ? 'units' : 'pcs', stock: 0, cost: 0 };
        const required = Number(material.required_qty || 0);
        const consumedCost = Number(material.consumed_cost || 0);
        return {
          id: material.id, type: material.material_type, name: details.name, unit: details.unit,
          required_qty: required, available_qty: details.stock,
          is_available: details.stock >= required,
          estimated_cost: consumedCost || required * details.cost,
          actual_cost: consumedCost || null
        };
      });
      const plannedMl = outputs.reduce((sum, item) => sum + item.planned_ml, 0);
      const actualKnown = outputs.every(item => item.actual_ml != null);
      const actualMl = actualKnown ? outputs.reduce((sum, item) => sum + item.actual_ml, 0) : null;
      const totalCost = materialRows.reduce((sum, item) => sum + item.estimated_cost, 0);
      return {
        id: order.id, order_number: order.order_number, batch_number: order.batch_number || '—',
        status: order.status, planned_date: order.planned_date, formula: order.formula?.name || 'Formula',
        formula_output: Number(order.formula?.output_quantity || 0), formula_unit: order.formula?.output_unit || 'L',
        outputs, materials: materialRows, planned_ml: plannedMl, actual_ml: actualMl,
        yield_percent: actualMl != null && plannedMl ? (actualMl / plannedMl) * 100 : null,
        waste_ml: actualMl != null ? Math.max(0, plannedMl - actualMl) : null,
        estimated_cost: totalCost,
        shortages: materialRows.filter(item => !item.is_available).length
      };
    });
    res.json({ batches });
  } catch (error) { next(error); }
};
