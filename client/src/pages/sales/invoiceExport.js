import { reportData } from '../reports/reportDownloads.js';
import { GST_STATE_NAMES } from '../../utils/gstStateNames.js';

const number = value => Number(value || 0);
const rounded = value => Math.round(value * 100) / 100;
const rate = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export const invoiceTaxBreakup = (sale, item) => {
  if (sale.gst_enabled !== true) return { cgst: 0, sgst: 0, igst: 0 };
  const tax = number(item.tax_amount);
  const cgst = number(item.cgst_amount);
  const sgst = number(item.sgst_amount);
  const igst = number(item.igst_amount);
  if (cgst + sgst + igst || !tax) return { cgst, sgst, igst };
  if (sale.supply_type === 'INTER') return { cgst: 0, sgst: 0, igst: tax };
  const half = Math.round(tax * 50) / 100;
  return { cgst: half, sgst: rounded(tax - half), igst: 0 };
};

export const invoiceTaxRates = (sale, item) => {
  if (sale.gst_enabled !== true) return { cgst: '', sgst: '', igst: '' };
  const gst = number(item.tax_rate);
  return sale.supply_type === 'INTER'
    ? { cgst: '', sgst: '', igst: gst }
    : { cgst: gst / 2, sgst: gst / 2, igst: '' };
};

export const invoiceTaxTotals = sale => (sale.retailSaleItems || []).reduce((totals, item) => {
  const split = invoiceTaxBreakup(sale, item);
  totals.cgst = rounded(totals.cgst + split.cgst);
  totals.sgst = rounded(totals.sgst + split.sgst);
  totals.igst = rounded(totals.igst + split.igst);
  return totals;
}, { cgst: 0, sgst: 0, igst: 0 });

const productName = item => {
  const variant = item.finishedGood || {};
  const name = item.packagingMaterial?.name || variant.product?.name || variant.name || 'Product';
  return `${name}${variant.size_label ? ` - ${variant.size_label}` : ''}`;
};
const customerFor = sale => sale.customerDetails || (typeof sale.customer === 'object' ? sale.customer : { name: sale.customer });
const sku = item => item.packagingMaterial?.sku || item.finishedGood?.sku || '';
const taxable = item => rounded(number(item.total) - number(item.tax_amount));
const title = sale => sale.gst_scheme === 'COMPOSITION' ? 'Bill of Supply' : sale.gst_enabled === true ? 'Tax Invoice' : 'Invoice';
const sellerGstin = (sale, company) => sale.gst_enabled === true ? sale.seller_gstin || '' : sale.gst_scheme === 'COMPOSITION' ? company.tax_id || '' : '';
const customerGstin = sale => sale.gst_enabled === true ? sale.customer_gstin || '' : '';

export const invoiceSpreadsheet = (sale, company) => {
  const customer = sale.customer || {};
  const items = sale.retailSaleItems || [];
  if (sale.gst_enabled !== true && sale.gst_scheme !== 'COMPOSITION') return reportData(`invoice-${sale.sale_number || sale.id}`, [
    ['Invoice'],
    ['Seller', company.name || '', 'Seller address', company.address || '', 'Seller phone', company.phone || ''],
    ['Customer', customer.name || 'Walk-in customer', 'Customer address', customer.address || '', 'Customer phone', customer.phone || ''],
    ['Invoice no', sale.sale_number || '', 'Date', sale.sale_date || ''],
    [],
    ['#', 'Product', 'SKU', 'Quantity', 'Unit price', 'Line total'],
    ...items.map((item, index) => [index + 1, productName(item), sku(item), number(item.quantity), number(item.unit_price), number(item.total)]),
    ['TOTAL', '', '', '', '', number(sale.total_amount)],
    ['Invoice subtotal', number(sale.subtotal), 'Discount', number(sale.discount_amount), ...(number(sale.tax_amount) ? ['Tax', number(sale.tax_amount)] : []), 'Amount received', number(sale.paid_amount), 'Balance due', number(sale.balance_due)]
  ], 5);
  const totals = invoiceTaxTotals(sale);
  const hasInterstateGst = sale.gst_enabled === true && sale.supply_type === 'INTER';
  const place = sale.place_of_supply_state_code
    ? `${GST_STATE_NAMES[sale.place_of_supply_state_code] || ''} (${sale.place_of_supply_state_code})`
    : '';
  const rows = [
    [title(sale)],
    ['Seller', company.name || '', 'Seller GSTIN', sellerGstin(sale, company), 'Seller address', company.address || '', 'Seller phone', company.phone || ''],
    ['Customer', customer.name || 'Walk-in customer', 'Customer GSTIN', customerGstin(sale), 'Customer address', customer.address || '', 'Customer phone', customer.phone || ''],
    ['Invoice no', sale.sale_number || '', 'Date', sale.sale_date || '', 'Place of supply', place, 'Supply type', sale.supply_type || ''],
    [],
    ['#', 'Product', 'SKU', 'HSN', 'Quantity', 'Unit price', 'Taxable value', 'GST %', 'CGST %', 'CGST amount', 'SGST %', 'SGST amount', ...(hasInterstateGst ? ['IGST %', 'IGST amount'] : []), 'Line total'],
    ...items.map((item, index) => {
      const split = invoiceTaxBreakup(sale, item);
      const rates = invoiceTaxRates(sale, item);
      return [index + 1, productName(item), sku(item), sale.gst_enabled === true ? item.hsn_code || '' : '', number(item.quantity), number(item.unit_price), taxable(item), sale.gst_enabled === true ? number(item.tax_rate) : '', rates.cgst, split.cgst, rates.sgst, split.sgst, ...(hasInterstateGst ? [rates.igst, split.igst] : []), number(item.total)];
    }),
    ['TOTAL', '', '', '', '', '', rounded(items.reduce((sum, item) => sum + taxable(item), 0)), '', '', totals.cgst, '', totals.sgst, ...(hasInterstateGst ? ['', totals.igst] : []), number(sale.total_amount)],
    ['Invoice subtotal', number(sale.subtotal), 'Discount', number(sale.discount_amount), sale.gst_enabled === true ? 'Total GST' : 'Total tax', number(sale.tax_amount), 'Amount received', number(sale.paid_amount), 'Balance due', number(sale.balance_due)]
  ];
  return reportData(`${title(sale).toLowerCase().replace(/\s+/g, '-')}-${sale.sale_number || sale.id}`, rows, 5);
};

const listRows = sales => sales.flatMap(sale => {
  const items = sale.retailSaleItems || [];
  return (items.length ? items : [null]).map((item, index) => {
    const split = item ? invoiceTaxBreakup(sale, item) : { cgst: 0, sgst: 0, igst: 0 };
    const rates = item ? invoiceTaxRates(sale, item) : { cgst: '', sgst: '', igst: '' };
    return { sale, item, split, rates, first: index === 0 };
  });
});

export const salesSpreadsheet = (sales, company, rangeLabel) => {
  if (!sales.some(sale => sale.gst_enabled === true || sale.gst_scheme === 'COMPOSITION')) return reportData(`sales-invoices-${rangeLabel}`, [
    ['Sales invoices', rangeLabel],
    ['Seller', company.name || '', 'Seller address', company.address || '', 'Seller phone', company.phone || ''],
    [],
    ['Date', 'Invoice', 'Customer', 'Customer address', 'Product', 'SKU', 'Quantity', 'Unit price', 'Line total', 'Invoice total', 'Returned amount', 'Net total', 'Status'],
    ...listRows(sales).map(({ sale, item, first }) => [sale.sale_date || '', sale.sale_number || '', customerFor(sale)?.name || 'Walk-in customer', customerFor(sale)?.address || '', item ? productName(item) : '', item ? sku(item) : '', item ? number(item.quantity) : '', item ? number(item.unit_price) : '', item ? number(item.total) : '', first ? number(sale.total_amount) : '', first ? number(sale.returned_amount) : '', first ? rounded(number(sale.total_amount) - number(sale.returned_amount)) : '', sale.status || ''])
  ], 3);
  const hasInterstateGst = sales.some(sale => sale.gst_enabled === true && sale.supply_type === 'INTER');
  return reportData(`sales-invoices-${rangeLabel}`, [
  ['Sales invoices', rangeLabel],
  ['Seller', company.name || '', 'Seller GSTIN', company.tax_system === 'GST' ? company.tax_id || '' : '', 'Seller address', company.address || '', 'Seller phone', company.phone || ''],
  [],
  ['Date', 'Invoice', 'Invoice type', 'Customer', 'Customer GSTIN', 'Customer address', 'Product', 'SKU', 'HSN', 'Quantity', 'Unit price', 'Taxable value', 'GST %', 'CGST %', 'CGST amount', 'SGST %', 'SGST amount', ...(hasInterstateGst ? ['IGST %', 'IGST amount'] : []), 'Line total', 'Invoice total', 'Returned amount', 'Net total', 'Status'],
  ...listRows(sales).map(({ sale, item, split, rates, first }) => [
    sale.sale_date || '', sale.sale_number || '', title(sale), customerFor(sale)?.name || 'Walk-in customer', customerGstin(sale), customerFor(sale)?.address || '', item ? productName(item) : '', item ? sku(item) : '', sale.gst_enabled === true ? item?.hsn_code || '' : '', item ? number(item.quantity) : '', item ? number(item.unit_price) : '', item ? taxable(item) : '', sale.gst_enabled === true && item ? number(item.tax_rate) : '', rates.cgst, split.cgst, rates.sgst, split.sgst, ...(hasInterstateGst ? [rates.igst, split.igst] : []), item ? number(item.total) : '', first ? number(sale.total_amount) : '', first ? number(sale.returned_amount) : '', first ? rounded(number(sale.total_amount) - number(sale.returned_amount)) : '', sale.status || ''
  ])
], 3);
};

export const salesPdfReport = (sales, company, rangeLabel) => {
  if (!sales.some(sale => sale.gst_enabled === true || sale.gst_scheme === 'COMPOSITION')) return reportData(`sales-invoices-${rangeLabel}`, [
    ['Sales invoices', rangeLabel],
    [company.name || 'Company', company.address || '', company.phone || ''],
    ['Date', 'Invoice', 'Customer', 'Product', 'Qty', 'Unit price', 'Line total'],
    ...listRows(sales).map(({ sale, item }) => [sale.sale_date || '', sale.sale_number || '', customerFor(sale)?.name || 'Walk-in customer', item ? productName(item) : '', item ? number(item.quantity) : '', item ? number(item.unit_price) : '', item ? number(item.total) : ''])
  ], 2);
  const hasInterstateGst = sales.some(sale => sale.gst_enabled === true && sale.supply_type === 'INTER');
  return reportData(`sales-invoices-${rangeLabel}`, [
  ['Sales invoices', rangeLabel],
  [company.name || 'Company', `GSTIN: ${company.tax_system === 'GST' ? company.tax_id || '-' : '-'}`, company.address || '', company.phone || ''],
  ['Date', 'Invoice', 'Customer / GSTIN', 'Product', 'HSN', 'Qty', 'Taxable', 'GST %', 'CGST % / amt', 'SGST % / amt', ...(hasInterstateGst ? ['IGST % / amt'] : []), 'Line total'],
  ...listRows(sales).map(({ sale, item, split, rates }) => [
    sale.sale_date || '', sale.sale_number || '', `${customerFor(sale)?.name || 'Walk-in customer'}${customerGstin(sale) ? ` / ${customerGstin(sale)}` : ''}`, item ? productName(item) : '', sale.gst_enabled === true && item ? item.hsn_code || '-' : '', item ? number(item.quantity) : '', item ? taxable(item) : '', sale.gst_enabled === true && item ? `${rate(item.tax_rate)}%` : '', rates.cgst === '' ? '' : `${rate(rates.cgst)}% / ${split.cgst.toFixed(2)}`, rates.sgst === '' ? '' : `${rate(rates.sgst)}% / ${split.sgst.toFixed(2)}`, ...(hasInterstateGst ? [rates.igst === '' ? '' : `${rate(rates.igst)}% / ${split.igst.toFixed(2)}`] : []), item ? number(item.total) : ''
  ])
], 2);
};
