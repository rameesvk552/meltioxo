const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePurchaseTotals } = require('../services/purchaseDiscount.service');

test('allocates purchase discount across mixed GST rates before tax', () => {
  const totals = calculatePurchaseTotals([
    { quantity: 1, unit_price: 100, tax_rate: 18 },
    { quantity: 1, unit_price: 100, tax_rate: 5 }
  ], 20);
  assert.deepEqual(totals, { subtotal: 200, discount_amount: 20, tax_amount: 20.7, line_net_amounts: [90, 90], line_tax_amounts: [16.2, 4.5], total_amount: 200.7 });
  assert.equal(totals.line_net_amounts.reduce((sum, value, index) => sum + value + totals.line_tax_amounts[index], 0), totals.total_amount);
});

test('rejects discounts above the purchase subtotal', () => {
  assert.throws(() => calculatePurchaseTotals([{ quantity: 1, unit_price: 100, tax_rate: 18 }], 100.01), /Discount must be between zero/);
});
