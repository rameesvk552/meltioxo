const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateIncentive, effectiveIncentive } = require('../services/incentive.service');

test('calculates incentive on the configured base and minimum sale total', () => {
  const sale = { subtotal: 1000, discount_amount: 100, total_amount: 1062 };
  assert.equal(calculateIncentive(sale, 5, 'NET_EX_TAX', 1000), 45);
  assert.equal(calculateIncentive(sale, 5, 'TOTAL_INCL_TAX', 1000), 53.1);
  assert.equal(calculateIncentive(sale, 5, 'NET_EX_TAX', 1100), 0);
});

test('returns reduce earned incentive without changing its original snapshot', () => {
  const sale = { salesperson_id: 'person-1', subtotal: 1000, discount_amount: 100, total_amount: 1062, incentive_rate: 5, incentive_basis: 'NET_EX_TAX', incentive_amount: 45, returned_revenue: 300 };
  assert.equal(effectiveIncentive(sale), 30);
  assert.equal(sale.incentive_amount, 45);
  assert.equal(effectiveIncentive({ ...sale, returned_revenue: 900 }), 0);
  assert.equal(effectiveIncentive({ ...sale, incentive_amount: 0 }), 0);
  assert.equal(effectiveIncentive({ ...sale, incentive_min_sale_amount: 1000, returned_amount: 200 }), 0);
});
