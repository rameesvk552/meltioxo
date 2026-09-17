const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../models');

test('retail sales can link one replacement invoice to a sales return', () => {
  assert.ok(db.retailSale.rawAttributes.exchange_return_id);
  assert.equal(db.retailSale.associations.exchangeReturn.as, 'exchangeReturn');
  assert.equal(db.salesReturn.associations.exchangeSale.as, 'exchangeSale');
  const uniqueExchangeIndex = db.retailSale.options.indexes.find(index => index.unique && index.fields.includes('exchange_return_id'));
  assert.ok(uniqueExchangeIndex);
});

test.after(() => db.sequelize.close());
