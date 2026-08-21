const test = require('node:test');
const assert = require('node:assert/strict');
const retailSales = require('../controllers/retailSaleV2.controller');

test('ready-made variants are always sold from finished stock', () => {
  assert.equal(retailSales.fulfillmentModeForVariant({ source_type: 'ready_made' }), 'stock');
});

test('live-making and legacy variants are always made at sale time', () => {
  assert.equal(retailSales.fulfillmentModeForVariant({ source_type: 'live_make' }), 'make_now');
  assert.equal(retailSales.fulfillmentModeForVariant({}), 'make_now');
});
