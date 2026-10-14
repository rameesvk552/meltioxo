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

test('fully discounted items still carry their original discount into a return', () => {
  const result = returns.allocateReturnAmounts({ quantity: 1, unit_price: 100, tax_amount: 0, total: 0, cost_amount: 40 }, 1);
  assert.equal(result.subtotal, 100);
  assert.equal(result.discount, 100);
  assert.equal(result.tax, 0);
  assert.equal(result.total, 0);
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

test('a partial payment is reduced before any refund is made', () => {
  assert.deepEqual(returns.calculateSettlement({ returnTotal: 70, saleTotal: 100, collected: 40 }), {
    receivableOffset: 60, reinstatedCredit: 0, refundAmount: 10, storeCreditAmount: 0
  });
});

test('store credit applies only to the paid part of a return', () => {
  assert.deepEqual(returns.calculateSettlement({ returnTotal: 70, saleTotal: 100, collected: 40, settlementType: 'store_credit' }), {
    receivableOffset: 60, reinstatedCredit: 0, refundAmount: 0, storeCreditAmount: 10
  });
});

test('redeemed store credit is reinstated before cash is refunded, across partial returns', () => {
  assert.deepEqual(returns.calculateSettlement({ returnTotal: 50, saleTotal: 100, previouslyReturned: 50, collected: 100, originalStoreCredit: 30, previouslyReinstated: 20 }), {
    receivableOffset: 0, reinstatedCredit: 10, refundAmount: 40, storeCreditAmount: 10
  });
});
