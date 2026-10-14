import { GST_STATE_NAMES } from '../../utils/gstStateNames.js';
import { invoiceTaxBreakup } from '../sales/invoiceExport.js';
import { reportData } from './reportDownloads.js';

const amount = value => Number(value || 0);
const money = value => Math.round((amount(value) + Number.EPSILON) * 100) / 100;
const reportDate = value => {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(8, 10)}-${date.slice(5, 7)}-${date.slice(0, 4)}` : date;
};

export const salesItemRows = sales => sales.flatMap(sale => (sale.retailSaleItems || []).map((item, index) => {
  const variant = item.finishedGood || {};
  const product = variant.product || {};
  const material = item.packagingMaterial || {};
  const gst = sale.gst_enabled === true;
  const split = invoiceTaxBreakup(sale, item);
  const name = material.name || product.name || variant.name || 'Product';
  const variantName = material.name ? '' : variant.size_label || '';
  return {
    key: item.id || `${sale.id || sale.sale_number}-${index}`,
    invoiceId: sale.id,
    invoice: sale.sale_number || '',
    date: reportDate(sale.sale_date),
    customerGstin: gst ? sale.customer_gstin || '' : '',
    customer: sale.customer?.name || 'Walk-in customer',
    placeOfSupply: gst ? GST_STATE_NAMES[sale.place_of_supply_state_code] || sale.place_of_supply_state_code || '' : '',
    itemCode: material.sku || product.code || variant.sku || '',
    hsn: gst ? item.hsn_code || '' : '',
    description: `${name}${variantName ? ` - ${variantName}` : ''}`,
    qty: amount(item.quantity),
    unitPrice: amount(item.unit_price),
    taxableValue: money(amount(item.total) - amount(item.tax_amount)),
    rate: gst ? amount(item.tax_rate) : null,
    igst: split.igst,
    cgst: split.cgst,
    sgst: split.sgst,
    lineTotal: amount(item.total)
  };
}));

export const salesItemTotals = rows => rows.reduce((totals, row) => {
  for (const key of ['taxableValue', 'igst', 'cgst', 'sgst', 'lineTotal']) totals[key] = money(totals[key] + row[key]);
  return totals;
}, { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, lineTotal: 0 });

export const salesItemReport = (sales, company, rangeLabel) => {
  const rows = salesItemRows(sales);
  const totals = salesItemTotals(rows);
  const gst = sales.some(sale => sale.gst_enabled === true);
  const filename = `sales-item-report-${rangeLabel}`;
  if (!gst) return {
    ...reportData(filename, [
      ['Item-level sales report', rangeLabel],
      [company?.name || 'Company', company?.address || '', company?.phone || ''],
      ['Invoice No.', 'Date', 'Customer', 'Item Code', 'Item Description', 'Qty', 'Unit Price', 'Line Total'],
      ...rows.map(row => [row.invoice, row.date, row.customer, row.itemCode, row.description, row.qty, row.unitPrice, row.lineTotal]),
      ['TOTAL', '', '', '', '', '', '', totals.lineTotal]
    ], 2),
    itemRows: rows,
    totals,
    gst: false
  };
  return {
    ...reportData(filename, [
      ['Item-level sales report', rangeLabel],
      [company?.name || 'Company', 'GSTIN', company?.tax_system === 'GST' ? company?.tax_id || '' : ''],
      ['Invoice No.', 'Date', 'Customer GSTIN', 'Customer', 'Place of Supply', 'Item Code', 'HSN/SAC', 'Item Description', 'Qty', 'Unit Price', 'Taxable Value', 'Rate', 'IGST', 'CGST', 'SGST', 'Line Total'],
      ...rows.map(row => [row.invoice, row.date, row.customerGstin, row.customer, row.placeOfSupply, row.itemCode, row.hsn, row.description, row.qty, row.unitPrice, row.taxableValue, row.rate === null ? '' : `${row.rate}%`, row.igst, row.cgst, row.sgst, row.lineTotal]),
      ['TOTAL', '', '', '', '', '', '', '', '', '', totals.taxableValue, '', totals.igst, totals.cgst, totals.sgst, totals.lineTotal]
    ], 2),
    columnWeights: [1.15, 1, 1.6, 1.35, 1.2, 1, 0.9, 1.8, 0.6, 0.9, 1.1, 0.6, 0.85, 0.85, 0.85, 1.1],
    itemRows: rows,
    totals,
    gst: true
  };
};
