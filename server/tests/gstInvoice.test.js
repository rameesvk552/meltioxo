const test = require('node:test');
const assert = require('node:assert/strict');
const gst = require('../services/gst.service');
const { createInvoicePdf } = require('../services/invoicePdf.service');

test('splits odd-paisa intrastate tax without losing or inventing tax', () => {
  assert.deepEqual(gst.splitTax(0.01, 'INTRA'), { cgst_amount: 0.01, sgst_amount: 0, igst_amount: 0 });
  assert.deepEqual(gst.splitTax(1.01, 'INTER'), { cgst_amount: 0, sgst_amount: 0, igst_amount: 1.01 });
});

test('regular GST invoice PDF includes seller and buyer GSTIN, HSN, and 9% CGST/SGST', () => {
  const pdf = createInvoicePdf({
    company: { name: 'Test Seller', address: 'Seller Street, Mumbai', phone: '9876543210', tax_system: 'GST', tax_id: '27ABCDE1234F1Z5' },
    sale: { sale_number: 'INV-1', sale_date: '2026-10-13', gst_scheme: 'REGULAR', gst_enabled: true, seller_gstin: '27ABCDE1234F1Z5', customer_gstin: '27PQRSX1234A1Z5', customer: { name: 'Test Buyer', address: 'Buyer Street, Mumbai' }, supply_type: 'INTRA', place_of_supply_state_code: '27', subtotal: 100, tax_amount: 18, total_amount: 118, retailSaleItems: [{ quantity: 1, unit_price: 100, total: 118, tax_rate: 18, tax_amount: 18, hsn_code: '330300', cgst_amount: 9, sgst_amount: 9, igst_amount: 0, finishedGood: { product: { name: 'Perfume' } } }] }
  }).toString('latin1');
  assert.match(pdf, /Tax Invoice/);
  assert.match(pdf, /27ABCDE1234F1Z5/);
  assert.match(pdf, /27PQRSX1234A1Z5/);
  assert.match(pdf, /Seller Street, Mumbai/);
  assert.match(pdf, /Buyer Street, Mumbai/);
  assert.match(pdf, /HSN 330300/);
  assert.match(pdf, /CGST 9%: INR 9\.00  \|  SGST 9%: INR 9\.00/);
  assert.match(pdf, /\(CGST\)/);
  assert.match(pdf, /\(SGST\)/);
  assert.match(pdf, /\(Total GST\)/);
});

test('non-GST invoice PDF never adds a customer GSTIN from the current customer record', () => {
  const pdf = createInvoicePdf({
    company: { name: 'Test Seller', tax_id: '27ABCDE1234F1Z5' },
    sale: { sale_number: 'OLD-1', sale_date: '2026-10-13', gst_enabled: null, customer: { name: 'Test Buyer', tax_id: '27PQRSX1234A1Z5' }, subtotal: 100, tax_amount: 0, total_amount: 100, retailSaleItems: [] }
  }).toString('latin1');
  assert.doesNotMatch(pdf, /27PQRSX1234A1Z5|27ABCDE1234F1Z5|Tax Invoice/);
});

test('regular GST seller shows tax without a buyer GSTIN for an unregistered customer', () => {
  const pdf = createInvoicePdf({
    company: { name: 'Registered Seller', tax_id: '27ABCDE1234F1Z5' },
    sale: { sale_number: 'B2C-1', sale_date: '2026-10-14', gst_enabled: true, seller_gstin: '27ABCDE1234F1Z5', customer: { name: 'Walk-in buyer' }, supply_type: 'INTRA', place_of_supply_state_code: '27', subtotal: 100, tax_amount: 18, total_amount: 118, retailSaleItems: [{ quantity: 1, unit_price: 100, total: 118, tax_rate: 18, tax_amount: 18, hsn_code: '330300', cgst_amount: 9, sgst_amount: 9, finishedGood: { product: { name: 'Perfume' } } }] }
  }).toString('latin1');
  assert.match(pdf, /27ABCDE1234F1Z5/);
  assert.match(pdf, /CGST 9%: INR 9\.00/);
  assert.doesNotMatch(pdf, /Walk-in buyer[^]*GSTIN: -/);
});

test('shared tax invoice PDF includes every item across pages', () => {
  const items = Array.from({ length: 13 }, (_, index) => ({ quantity: 1, unit_price: 10, total: 11.8, tax_rate: 18, tax_amount: 1.8, hsn_code: String(330300 + index), cgst_amount: 0.9, sgst_amount: 0.9, finishedGood: { product: { name: `Perfume ${index + 1}` } } }));
  const pdf = createInvoicePdf({ company: { name: 'Seller', tax_system: 'GST', tax_id: '27ABCDE1234F1Z5' }, sale: { sale_number: 'INV-2', sale_date: '2026-10-13', gst_enabled: true, supply_type: 'INTRA', place_of_supply_state_code: '27', subtotal: 130, tax_amount: 23.4, total_amount: 153.4, retailSaleItems: items } }).toString('latin1');
  assert.match(pdf, /\/Count 2 >>/);
  assert.match(pdf, /HSN 330312/);
  assert.match(pdf, /\(13\) Tj/);
});
