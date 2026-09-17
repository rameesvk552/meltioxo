const db = require('../models');
const { createInvoicePdf } = require('../services/invoicePdf.service');
const { verifyInvoiceLink } = require('../services/invoiceWhatsapp.service');

exports.download = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tenant, expires, signature } = req.query;
    if (!verifyInvoiceLink({ saleId: id, tenantId: tenant, expiresAt: expires, signature })) return res.status(403).json({ message: 'This invoice link is invalid or has expired.' });
    const sale = await db.retailSale.findOne({ where: { id, tenant_id: tenant }, include: [db.customer, { model: db.retailSaleItem, include: [{ model: db.finishedGood, include: [db.product] }, db.packagingMaterial] }] });
    if (!sale) return res.status(404).json({ message: 'Invoice not found.' });
    const company = await db.tenant.findByPk(tenant);
    const filename = String(sale.sale_number || 'invoice').replace(/[^a-zA-Z0-9._-]/g, '_');
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}.pdf"`, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    res.send(createInvoicePdf({ sale: sale.toJSON(), company: company?.toJSON() }));
  } catch (error) { next(error); }
};
