const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'invoice-whatsapp-test-secret';
process.env.INVOICE_PUBLIC_BASE_URL = 'https://erp.example.test';
const whatsapp = require('../services/invoiceWhatsapp.service');

test('creates a signed, time-limited invoice link', () => {
  const link = new URL(whatsapp.createInvoiceLink({ saleId: 'sale-1', tenantId: 'tenant-1' }));
  assert.equal(link.origin, 'https://erp.example.test');
  assert.equal(whatsapp.verifyInvoiceLink({
    saleId: 'sale-1', tenantId: 'tenant-1',
    expiresAt: link.searchParams.get('expires'), signature: link.searchParams.get('signature'),
  }), true);
  assert.equal(whatsapp.verifyInvoiceLink({
    saleId: 'sale-2', tenantId: 'tenant-1',
    expiresAt: link.searchParams.get('expires'), signature: link.searchParams.get('signature'),
  }), false);
});

test('normalizes Indian local customer numbers for WhatsApp', () => {
  assert.equal(whatsapp.normalizePhone('98765 43210'), '+919876543210');
  assert.equal(whatsapp.normalizePhone('+91 98765 43210'), '+919876543210');
  assert.equal(whatsapp.normalizePhone(''), null);
});
