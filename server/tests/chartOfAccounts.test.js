const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_ACCOUNTS } = require('../seeders/seed-chart-of-accounts');
const { ACCOUNT_CODES } = require('../config/constants');
const accounting = require('../services/accounting.service');

const byCode = new Map(DEFAULT_ACCOUNTS.map(account => [account.code, account]));

test('default chart contains the requested BS and PL hierarchy', () => {
  assert.equal(byCode.get('BS-ASSET').parent_code, 'BS');
  assert.equal(byCode.get('G1200').parent_code, 'BS-ASSET');
  assert.equal(byCode.get('1002').parent_code, 'G1200');
  assert.equal(byCode.get('1004').parent_code, '1002');
  assert.equal(byCode.get('1005').parent_code, 'G1200');
  assert.equal(byCode.get('G1300').parent_code, 'BS-ASSET');
  assert.equal(byCode.get('G2200').parent_code, 'BS-LIAB');
  assert.equal(byCode.get('G5100').parent_code, 'PL-EXPENSE');
  assert.equal(byCode.get('G4100').parent_code, 'PL-INCOME');
  assert.equal(byCode.get('G4100').name, 'Direct Income');
  assert.equal(byCode.get('4102').parent_code, 'G4100');
  assert.equal(byCode.get('4102').name, 'Sales');
  assert.equal(byCode.get('G4200').parent_code, 'PL-INCOME');
  assert.equal(byCode.get('G4200').name, 'Indirect Income');
  assert.equal(byCode.get('4201').parent_code, 'G4200');
  assert.equal(byCode.get('4201').name, 'Discount Received');
});

test('all production posting accounts are active leaf definitions', () => {
  const productionCodes = [
    ACCOUNT_CODES.RAW_INVENTORY,
    ACCOUNT_CODES.PKG_INVENTORY,
    ACCOUNT_CODES.WIP,
    ACCOUNT_CODES.FG_INVENTORY,
    ACCOUNT_CODES.PURCHASE_VARIANCE,
    ACCOUNT_CODES.COGS
  ];
  for (const code of productionCodes) {
    assert.ok(byCode.has(code), `missing production account ${code}`);
    assert.equal(Boolean(byCode.get(code).is_group), false, `${code} must be a posting ledger`);
  }
  assert.equal(byCode.get(ACCOUNT_CODES.RAW_INVENTORY).parent_code, 'G1250');
  assert.equal(byCode.get(ACCOUNT_CODES.PKG_INVENTORY).parent_code, 'G1250');
  assert.equal(byCode.get(ACCOUNT_CODES.WIP).parent_code, 'G1250');
  assert.equal(byCode.get(ACCOUNT_CODES.FG_INVENTORY).parent_code, 'G1250');
});

test('default account codes are unique and parents precede children', () => {
  assert.equal(byCode.size, DEFAULT_ACCOUNTS.length);
  const seen = new Set();
  for (const account of DEFAULT_ACCOUNTS) {
    if (account.parent_code) assert.ok(seen.has(account.parent_code), `${account.code} parent must be created first`);
    seen.add(account.code);
  }
});

test('new ledger code ranges follow the selected parent group', () => {
  assert.deepEqual(accounting.accountCodeRange('G1200', 'asset'), { start: 1201, end: 1299 });
  assert.deepEqual(accounting.accountCodeRange('1002', 'asset'), { start: 1001, end: 1099 });
  assert.deepEqual(accounting.accountCodeRange('G4100', 'revenue'), { start: 4101, end: 4199 });
  assert.deepEqual(accounting.accountCodeRange('PL-INCOME', 'revenue'), { start: 4001, end: 4999 });
});
