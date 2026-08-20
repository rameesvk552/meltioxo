const test = require('node:test');
const assert = require('node:assert/strict');
const accounting = require('../services/accounting.service');

test('validates and normalizes a balanced journal', () => {
  const result = accounting.validateJournalLines([
    { account_id: 'cash', debit_amount: 100.125 },
    { account_id: 'sales', credit_amount: 100.13 }
  ]);
  assert.equal(result.totalDebit, 100.13);
  assert.equal(result.totalCredit, 100.13);
});

test('rejects an unbalanced journal', () => {
  assert.throws(() => accounting.validateJournalLines([
    { account_id: 'cash', debit_amount: 100 },
    { account_id: 'sales', credit_amount: 99 }
  ]), /Unbalanced journal entry/);
});

test('rejects a line containing both debit and credit', () => {
  assert.throws(() => accounting.validateJournalLines([
    { account_id: 'cash', debit_amount: 100, credit_amount: 100 },
    { account_id: 'sales', credit_amount: 100 }
  ]), /either a debit or a credit/);
});
