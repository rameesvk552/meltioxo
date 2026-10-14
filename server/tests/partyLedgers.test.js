const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../models');
const accounting = require('../services/accounting.service');
const { ensureChartOfAccounts } = require('../seeders/seed-chart-of-accounts');
const storeCredit = require('../services/storeCredit.service');

test('creates customer ledgers after the numeric receivables range is full', async () => {
  const originalFindOne = db.account.findOne;
  const originalFindAll = db.account.findAll;
  const originalCreate = db.account.create;
  const originalCustomers = db.customer.findAll;
  const created = [];
  const receivables = { id: 'receivables', code: '1005', is_group: true };
  try {
    db.account.findOne = async ({ where }) => where.code === '1005' ? receivables : null;
    db.account.findAll = async () => Array.from({ length: 99 }, (_, i) => ({ code: String(1001 + i) }));
    db.account.create = async values => { created.push(values); return values; };
    db.customer.findAll = async () => Array.from({ length: 120 }, (_, i) => ({
      id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      name: `Customer ${i}`
    }));
    await accounting.ensureCustomerLedgers('tenant');
    assert.equal(created.length, 120);
    assert.equal(new Set(created.map(row => row.code)).size, 120);
    assert.ok(created.every(row => row.parent_id === receivables.id && row.code.startsWith('CUS-')));
  } finally {
    db.account.findOne = originalFindOne;
    db.account.findAll = originalFindAll;
    db.account.create = originalCreate;
    db.customer.findAll = originalCustomers;
  }
});

test('preserves a conflicting 2004 ledger and reuses its store-credit fallback', async () => {
  const originalFindOne = db.account.findOne;
  const originalCreate = db.account.create;
  const tenantId = 'tenant';
  const rows = new Map();
  const existing = { id: 'supplier-ledger', code: '2004', name: 'Vendor account', type: 'liability', is_group: false, is_system: false };
  rows.set('2004', existing);
  let nextId = 0;
  try {
    db.account.findOne = async ({ where }) => rows.get(where.code) || null;
    db.account.create = async values => {
      const row = { id: `account-${++nextId}`, ...values, update: async changes => Object.assign(row, changes) };
      rows.set(values.code, row);
      return row;
    };
    await ensureChartOfAccounts(tenantId);
    const fallback = rows.get(`SC-${tenantId}`);
    assert.equal(rows.get('2004'), existing);
    assert.equal(existing.name, 'Vendor account');
    assert.equal(fallback.name, 'Customer Store Credit');
    assert.equal((await storeCredit.account(tenantId)).id, fallback.id);
    await ensureChartOfAccounts(tenantId);
    assert.equal(rows.get(`SC-${tenantId}`).id, fallback.id);
  } finally {
    db.account.findOne = originalFindOne;
    db.account.create = originalCreate;
  }
});
