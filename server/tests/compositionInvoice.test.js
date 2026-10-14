const test = require('node:test');
const assert = require('node:assert/strict');
const { createInvoicePdf } = require('../services/invoicePdf.service');

test('composition sale PDF is a bill of supply with the mandatory notice', () => {
  const pdf = createInvoicePdf({
    sale: { sale_number: 'SALE-1', sale_date: '2026-10-12', gst_scheme: 'COMPOSITION', subtotal: 100, tax_amount: 0, total_amount: 100, retailSaleItems: [] },
    company: { name: 'Example Perfumes', tax_system: 'GST', tax_id: '27AAAAA0000A1Z5' }
  }).toString('latin1');
  assert.match(pdf, /Bill of Supply/);
  assert.match(pdf, /Composition taxable person, not eligible to collect tax on supplies/);
  assert.doesNotMatch(pdf, /Tax Invoice/);
});
