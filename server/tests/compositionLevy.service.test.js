const test = require('node:test');
const assert = require('node:assert/strict');
const { quarterDates, estimateLevy } = require('../services/compositionLevy.service');

test('estimates the separate 1% levy on net POS turnover, including returns', () => {
  assert.deepEqual(quarterDates(2026, 2), { from: '2026-04-01', to: '2026-06-30' });
  assert.deepEqual(estimateLevy({
    sales: [{ subtotal: 100000, discount_amount: 0 }],
    returns: [{ subtotal: 10000, discount_amount: 0 }],
    rate: 1
  }), { sales_turnover: 100000, returned_turnover: 10000, net_turnover: 90000, rate: 1, estimated_levy: 900, estimated_cgst: 450, estimated_sgst: 450 });
});
