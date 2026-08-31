const test = require('node:test');
const assert = require('node:assert/strict');
const returns = require('../controllers/salesReturn.controller');

test('allocates a proportional partial return including discount and tax', () => {
  const result = returns.allocateReturnAmounts({
    quantity: 2,
    unit_price: 100,
    tax_amount: 18,
    total: 198,
    cost_amount: 120
  }, 1);
  assert.deepEqual(result, {
    quantity: 1,
    subtotal: 100,
    discount: 10,
    tax: 9,
    total: 99,
    remainingQuantity: 2
  });
});

test('assigns remaining cents to the final partial return', () => {
  const saleItem = { quantity: 3, unit_price: 30, tax_amount: 10, total: 100, cost_amount: 60 };
  const first = returns.allocateReturnAmounts(saleItem, 1);
  const final = returns.allocateReturnAmounts(saleItem, 2, {
    quantity: 1,
    subtotal: first.subtotal,
    discount: first.discount,
    tax: first.tax,
    total: first.total
  });
  assert.equal(first.total, 33.33);
  assert.equal(final.total, 66.67);
  assert.equal(first.total + final.total, 100);
  assert.equal(first.tax + final.tax, 10);
});

test('rejects a return above the remaining sold quantity', () => {
  assert.throws(() => returns.allocateReturnAmounts({
    quantity: 2,
    unit_price: 50,
    tax_amount: 0,
    total: 100,
    cost_amount: 40
  }, 1.5, { quantity: 1 }), /exceeds the quantity still available/);
});

test('rejects quantities beyond inventory precision', () => {
  assert.throws(() => returns.quantityNumber(0.00001), /more than four decimal places/);
  assert.equal(returns.quantityNumber(1.2345), 1.2345);
});
