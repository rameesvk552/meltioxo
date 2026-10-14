import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceSpreadsheet, invoiceTaxBreakup, invoiceTaxRates, salesPdfReport, salesSpreadsheet } from '../src/pages/sales/invoiceExport.js';
import { makeXlsx } from '../src/pages/reports/reportDownloads.js';

const company = { name: 'Seller Co', tax_system: 'GST', tax_id: '27ABCDE1234F1Z5', address: 'Seller Street', phone: '9876543210' };
const item = { quantity: 1, unit_price: 100, total: 118, tax_amount: 18, tax_rate: 18, hsn_code: '330300', cgst_amount: 9, sgst_amount: 9, finishedGood: { product: { name: 'Perfume' }, sku: 'P-1' } };
const sale = { id: 'sale-1', sale_number: 'INV-1', sale_date: '2026-10-14', gst_enabled: true, gst_scheme: 'REGULAR', supply_type: 'INTRA', seller_gstin: company.tax_id, customer_gstin: '27PQRSX1234A1Z5', customer: { name: 'Buyer Co', address: 'Buyer Street' }, subtotal: 100, tax_amount: 18, total_amount: 118, retailSaleItems: [item] };

test('invoice spreadsheet exports the saved buyer, seller, HSN, and both 9% tax amounts', () => {
  const spec = invoiceSpreadsheet(sale, company);
  assert.equal(spec.headerRowIndex, 5);
  assert.deepEqual(spec.rows[1].slice(0, 4), ['Seller', 'Seller Co', 'Seller GSTIN', company.tax_id]);
  assert.deepEqual(spec.rows[2].slice(0, 4), ['Customer', 'Buyer Co', 'Customer GSTIN', sale.customer_gstin]);
  assert.deepEqual(spec.rows[6].slice(3, 14), ['330300', 1, 100, 100, 18, 9, 9, 9, 9, '', 0]);
});

test('sales exports include GST amounts once per item and invoice totals once per sale', () => {
  const twoItems = { ...sale, retailSaleItems: [item, { ...item, hsn_code: '330301' }], subtotal: 200, tax_amount: 36, total_amount: 236, status: 'Posted' };
  const sheet = salesSpreadsheet([twoItems], company, '2026-10-14');
  assert.equal(sheet.rows[4][8], '330300');
  assert.equal(sheet.rows[4][14], 9);
  assert.equal(sheet.rows[4][16], 9);
  assert.equal(sheet.rows[4][18], 236);
  assert.equal(sheet.rows[5][18], '');
  assert.ok(!sheet.rows[3].some(heading => String(heading).includes('IGST')));
  const pdf = salesPdfReport([sale], company, '2026-10-14');
  assert.match(pdf.rows[1].join(' '), /Seller Co.*27ABCDE1234F1Z5/);
  assert.deepEqual(pdf.rows[2].slice(3, 6), ['Product', 'HSN', 'Qty']);
  assert.deepEqual(pdf.rows[3].slice(3, 6), ['Perfume', '330300', 1]);
  assert.ok(!pdf.rows[2].some(heading => String(heading).includes('IGST')));
  assert.match(pdf.rows[3].join(' '), /9% \/ 9\.00.*9% \/ 9\.00/);
});

test('interstate sales retain the IGST column and amount', () => {
  const interstate = { ...sale, supply_type: 'INTER', retailSaleItems: [{ ...item, cgst_amount: 0, sgst_amount: 0, igst_amount: 18 }] };
  const pdf = salesPdfReport([interstate], company, '2026-10-14');
  assert.ok(pdf.rows[2].includes('IGST % / amt'));
  assert.ok(pdf.rows[3].includes('18% / 18.00'));
  const sheet = salesSpreadsheet([interstate], company, '2026-10-14');
  assert.ok(sheet.rows[3].includes('IGST amount'));
  assert.equal(sheet.rows[4][18], 18);
});

test('a non-GST invoice does not inherit customer GST details or show a GST breakup', () => {
  const legacy = { ...sale, gst_enabled: null, seller_gstin: null, customer_gstin: null, customer: { name: 'Buyer Co', tax_id: '27PQRSX1234A1Z5' } };
  const spec = invoiceSpreadsheet(legacy, company);
  assert.doesNotMatch(spec.rows.flat().join(' '), /GSTIN|HSN|CGST|SGST|IGST|GST %/);
  assert.deepEqual(invoiceTaxBreakup(legacy, item), { cgst: 0, sgst: 0, igst: 0 });
  assert.deepEqual(invoiceTaxRates(legacy, item), { cgst: '', sgst: '', igst: '' });
  const noGstCompany = { name: 'Plain Seller', tax_system: 'NONE', address: 'Market Road' };
  assert.doesNotMatch(salesSpreadsheet([legacy], noGstCompany, 'all').rows.flat().join(' '), /GSTIN|HSN|CGST|SGST|IGST|GST %/);
  assert.doesNotMatch(salesPdfReport([legacy], noGstCompany, 'all').rows.flat().join(' '), /GSTIN|HSN|CGST|SGST|IGST|GST %/);
});

test('generated Excel keeps the metadata header and GST values as spreadsheet cells', async () => {
  const file = new TextDecoder().decode(await makeXlsx(invoiceSpreadsheet(sale, company)).arrayBuffer());
  assert.match(file, /topLeftCell="A7"/);
  assert.match(file, /Seller GSTIN/);
  assert.match(file, /Customer GSTIN/);
  assert.match(file, /330300/);
  assert.match(file, /<v>9<\/v>/);
});
