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

test('normalizes split payments that equal the document total', () => {
  assert.deepEqual(accounting.normalizePaymentSplits({ payments: [
    { payment_method_id: 'cash', amount: 60 },
    { payment_method_id: 'upi', amount: 40.005 }
  ] }, 100.01), [
    { payment_method_id: 'cash', amount: 60 },
    { payment_method_id: 'upi', amount: 40.01 }
  ]);
});

test('rejects split payments that do not equal the document total', () => {
  assert.throws(() => accounting.normalizePaymentSplits({ payments: [
    { payment_method_id: 'cash', amount: 50 },
    { payment_method_id: 'upi', amount: 40 }
  ] }, 100), /must equal document total/);
});

test('rejects duplicate methods in one split payment', () => {
  assert.throws(() => accounting.normalizePaymentSplits({ payments: [
    { payment_method_id: 'cash', amount: 50 },
    { payment_method_id: 'cash', amount: 50 }
  ] }, 100), /only once/);
});
