const test = require('node:test');
const assert = require('node:assert/strict');
const gst = require('../services/gst.service');
const { createInvoicePdf } = require('../services/invoicePdf.service');

test('splits odd-paisa intrastate tax without losing or inventing tax', () => {
  assert.deepEqual(gst.splitTax(0.01, 'INTRA'), { cgst_amount: 0.01, sgst_amount: 0, igst_amount: 0 });
  assert.deepEqual(gst.splitTax(1.01, 'INTER'), { cgst_amount: 0, sgst_amount: 0, igst_amount: 1.01 });
});

test('regular GST invoice PDF includes saved HSN and item and invoice CGST/SGST', () => {
  const pdf = createInvoicePdf({
    company: { name: 'Test Seller', tax_system: 'GST', tax_id: '27ABCDE1234F1Z5' },
    sale: { sale_number: 'INV-1', sale_date: '2026-10-13', gst_scheme: 'REGULAR', gst_enabled: true, seller_gstin: '27ABCDE1234F1Z5', supply_type: 'INTRA', place_of_supply_state_code: '27', subtotal: 100, tax_amount: 18, total_amount: 118, retailSaleItems: [{ quantity: 1, unit_price: 100, total: 118, tax_rate: 18, tax_amount: 18, hsn_code: '330300', cgst_amount: 9, sgst_amount: 9, igst_amount: 0, finishedGood: { product: { name: 'Perfume' } } }] }
  }).toString('latin1');
  assert.match(pdf, /Tax Invoice/);
  assert.match(pdf, /HSN 330300/);
  assert.match(pdf, /CGST INR 9\.00 SGST INR 9\.00/);
  assert.match(pdf, /\(CGST\)/);
  assert.match(pdf, /\(SGST\)/);
});

test('shared tax invoice PDF includes every item across pages', () => {
  const items = Array.from({ length: 13 }, (_, index) => ({ quantity: 1, unit_price: 10, total: 11.8, tax_rate: 18, tax_amount: 1.8, hsn_code: String(330300 + index), cgst_amount: 0.9, sgst_amount: 0.9, finishedGood: { product: { name: `Perfume ${index + 1}` } } }));
  const pdf = createInvoicePdf({ company: { name: 'Seller', tax_system: 'GST', tax_id: '27ABCDE1234F1Z5' }, sale: { sale_number: 'INV-2', sale_date: '2026-10-13', gst_enabled: true, supply_type: 'INTRA', place_of_supply_state_code: '27', subtotal: 130, tax_amount: 23.4, total_amount: 153.4, retailSaleItems: items } }).toString('latin1');
  assert.match(pdf, /\/Count 2 >>/);
  assert.match(pdf, /HSN 330312/);
  assert.match(pdf, /\(13\) Tj/);
});
