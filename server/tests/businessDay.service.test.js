const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../models');
const businessDays = require('../services/businessDay.service');

test('uses the India calendar date after local midnight', () => {
  assert.equal(
    businessDays.businessDate(new Date('2026-08-21T18:31:00.000Z'), 'Asia/Kolkata'),
    '2026-08-22'
  );
});

test('keeps the previous India date before local midnight', () => {
  assert.equal(
    businessDays.businessDate(new Date('2026-08-21T18:29:00.000Z'), 'Asia/Kolkata'),
    '2026-08-21'
  );
});

test('rounds register amounts to currency precision', () => {
  assert.equal(businessDays.money(100.005), 100.01);
  assert.equal(businessDays.money(0), 0);
});

test('expense cash journals do not reduce the POS drawer', async () => {
  const models = [db.retailSale, db.salesReturn, db.payment, db.paymentMethod, db.journalEntry, db.journalEntryLine];
  const originalFindAll = models.map(model => model.findAll);
  try {
    db.retailSale.findAll = async () => [{ total_amount: '1180.00', cogs_amount: '0.00' }];
    db.salesReturn.findAll = async () => [];
    db.payment.findAll = async () => [
      { amount: '1180.00', payment_type: 'incoming', payment_method_id: 'cash-method', journal_entry_id: 'sale', paymentMethod: { id: 'cash-method', name: 'Cash', method_type: 'CASH' } }
    ];
    db.paymentMethod.findAll = async () => [{ id: 'cash-method', account_id: 'cash-account', name: 'Cash', method_type: 'CASH' }];
    db.journalEntry.findAll = async () => [
      { id: 'sale', reference_type: 'retail_sale_revenue' },
      { id: 'small-expense', reference_type: 'expense' },
      { id: 'large-expense', reference_type: 'expense' }
    ];
    db.journalEntryLine.findAll = async ({ where }) => [
      { journal_entry_id: 'sale', account_id: 'cash-account', debit: '1180.00', credit: '0.00' },
      { journal_entry_id: 'small-expense', account_id: 'cash-account', debit: '0.00', credit: '50.00' },
      { journal_entry_id: 'large-expense', account_id: 'cash-account', debit: '0.00', credit: '15000.00' }
    ].filter(line => where.journal_entry_id.includes(line.journal_entry_id));

    const summary = await businessDays.summarize('tenant', 'day');
    assert.equal(summary.cash_movement, 1180);
    assert.equal(businessDays.money(370 + summary.cash_movement), 1550);
    assert.deepEqual(summary.payment_summary.map(row => [row.name, row.amount, row.count]), [['Cash', 1180, 1]]);
  } finally {
    models.forEach((model, index) => { model.findAll = originalFindAll[index]; });
  }
});
