import test from 'node:test';
import assert from 'node:assert/strict';
import { salesItemReport } from '../src/pages/reports/salesItemReport.js';
import { makeXlsx } from '../src/pages/reports/reportDownloads.js';

const company = { name: 'Example Store', tax_system: 'GST', tax_id: '32ABCDE1234F1Z5' };
const item = (id, total, tax, hsn, cgst, sgst, igst = 0) => ({
  id, quantity: 1, unit_price: total - tax, total, tax_amount: tax, tax_rate: 18,
  hsn_code: hsn, cgst_amount: cgst, sgst_amount: sgst, igst_amount: igst,
  finishedGood: { sku: `SKU-${id}`, size_label: 'Standard', product: { name: 'Perfume', code: 'PERFUME' } }
});
const firstSale = {
  id: 'sale-1', sale_number: 'INV-001', sale_date: '2026-10-14', gst_enabled: true,
  customer_gstin: '32PQRSX1234A1Z5', place_of_supply_state_code: '32', supply_type: 'INTRA',
  customer: { name: 'ABC Traders' }, total_amount: 177,
  retailSaleItems: [item('a', 118, 18, '330300', 9, 9), item('b', 59, 9, '330301', 4.5, 4.5)]
};

test('sales report uses one row per item and sums taxable value and tax once', async () => {
  const report = salesItemReport([firstSale], company, '2026-10-14');
  assert.equal(report.itemRows.length, 2);
  assert.deepEqual(report.rows[2], ['Invoice No.', 'Date', 'Customer GSTIN', 'Customer', 'Place of Supply', 'Item Code', 'HSN/SAC', 'Item Description', 'Qty', 'Unit Price', 'Taxable Value', 'Rate', 'IGST', 'CGST', 'SGST', 'Line Total']);
  assert.deepEqual(report.rows[3].slice(0, 8), ['INV-001', '14-10-2026', firstSale.customer_gstin, 'ABC Traders', 'Kerala', 'PERFUME', '330300', 'Perfume - Standard']);
  assert.deepEqual(report.totals, { taxableValue: 150, igst: 0, cgst: 13.5, sgst: 13.5, lineTotal: 177 });
  assert.deepEqual(report.rows.at(-1).slice(10), [150, '', 0, 13.5, 13.5, 177]);
  const workbook = new TextDecoder().decode(await makeXlsx(report).arrayBuffer());
  assert.match(workbook, /Customer GSTIN/);
  assert.match(workbook, /HSN\/SAC/);
  assert.match(workbook, /<v>13\.5<\/v>/);
});

test('interstate item reports retain IGST in the correct column', () => {
  const interstate = { ...firstSale, id: 'sale-2', sale_number: 'INV-002', supply_type: 'INTER', place_of_supply_state_code: '27', retailSaleItems: [item('c', 236, 36, '330300', 0, 0, 36)] };
  const report = salesItemReport([firstSale, interstate], company, '2026-10-14');
  assert.equal(report.rows[5][12], 36);
  assert.deepEqual(report.totals, { taxableValue: 350, igst: 36, cgst: 13.5, sgst: 13.5, lineTotal: 413 });
});

test('a company without GST gets a plain item-level sales report', async () => {
  const plain = { ...firstSale, gst_enabled: false, customer_gstin: null, retailSaleItems: [{ ...item('a', 100, 0, null, 0, 0), tax_rate: 0 }] };
  const report = salesItemReport([plain], { name: 'Plain Store', tax_system: 'NONE' }, '2026-10-14');
  assert.equal(report.gst, false);
  assert.deepEqual(report.rows[2], ['Invoice No.', 'Date', 'Customer', 'Item Code', 'Item Description', 'Qty', 'Unit Price', 'Line Total']);
  assert.equal(report.rows.at(-1).at(-1), 100);
  const workbook = new TextDecoder().decode(await makeXlsx(report).arrayBuffer());
  assert.doesNotMatch(workbook, /GSTIN|HSN|IGST|CGST|SGST/);
});
