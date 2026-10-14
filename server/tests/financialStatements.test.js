const test = require('node:test');
const assert = require('node:assert/strict');
const statements = require('../services/financialStatements');
const account = (id, type) => ({ id, code: id, name: id, type });
const line = (id, type, debit, credit, date = '2026-09-01', entryId = id) => ({ id, debit, credit, account: account(id,type), journalEntry: { id: entryId, entry_date: date, entry_number: entryId, reference_type: 'test', narration: 'Test posting' } });

test('trial balance preserves abnormal credit assets and debit liabilities', () => {
  const rows = statements.trialBalance([line('cash','asset',0,10.01),line('payable','liability',10.01,0)]);
  assert.equal(rows.find(row=>row.id==='cash').balance,-10.01);
  assert.equal(rows.find(row=>row.id==='cash').credit,10.01);
  assert.equal(rows.find(row=>row.id==='payable').debit,10.01);
  assert.equal(rows.find(row=>row.id==='payable').balance,-10.01);
});

test('decimal postings aggregate in cents and zero accounts disappear', () => {
  const rows = statements.trialBalance([line('cash','asset',0.1,0),line('cash','asset',0.2,0),line('cleared','asset',10,10)]);
  assert.equal(rows.length,1); assert.equal(rows[0].debit,0.3);
});

test('balance sheet incorporates earnings and stays balanced through a closing journal', () => {
  const lines = [line('cash','asset',1000,0),line('income','revenue',0,1000),line('cash','asset',0,250),line('cost','expense',250,0)];
  const before = statements.balanceSheet(statements.trialBalance(lines));
  assert.equal(before.unclosed_earnings,750); assert.equal(before.equity,750); assert.equal(before.balanced,true);
  const closed = [...lines,line('income','revenue',1000,0),line('cost','expense',0,250),line('retained','equity',0,750)];
  const after = statements.balanceSheet(statements.trialBalance(closed));
  assert.equal(after.unclosed_earnings,0); assert.equal(after.equity,750); assert.equal(after.balanced,true);
});

test('loss is negative equity, and unbalanced data is exposed', () => {
  const report = statements.balanceSheet(statements.trialBalance([line('cash','asset',0,100),line('cost','expense',100,0)]));
  assert.equal(report.equity,-100); assert.equal(report.balanced,true);
  const bad = statements.balanceSheet(statements.trialBalance([line('cash','asset',99,0)]));
  assert.equal(bad.difference,99); assert.equal(bad.balanced,false);
});

test('ledger uses prior entries for opening and ignores entries after the cutoff', () => {
  const report = statements.ledgerStatement([line('cash','asset',100,0,'2026-08-31'),line('cash','asset',0,25,'2026-09-02'),line('cash','asset',200,0,'2026-10-01')], 'asset','2026-09-01','2026-09-30');
  assert.equal(report.opening_balance,100); assert.equal(report.closing_balance,75);
  assert.equal(report.rows.length,1); assert.equal(report.rows[0].balance,75);
});

test('credit-normal ledger running balance follows liabilities correctly', () => {
  const report = statements.ledgerStatement([line('ap','liability',0,100,'2026-08-31'),line('ap','liability',25,0,'2026-09-02')], 'liability','2026-09-01','2026-09-30');
  assert.equal(report.opening_balance,100); assert.equal(report.closing_balance,75);
});

test('cash opening + external net movements equals closing; transfers do not inflate flows', () => {
  const report = statements.cashMovements([
    line('cash','asset',100,0,'2026-08-31'),
    line('cash','asset',0,40,'2026-09-01','transfer'),line('bank','asset',40,0,'2026-09-01','transfer'),
    line('bank','asset',20,0,'2026-09-02','receipt'),line('cash','asset',0,10,'2026-09-03','payment')
  ], '2026-09-01','2026-09-30');
  assert.deepEqual(report.summary,{ opening_balance:100,closing_balance:110,inflow:20,outflow:10,net:10,transfers:40 });
  assert.equal(report.data.find(row=>row.id==='transfer').inflow,0);
});

test('balance equation agrees with anonymised production aggregate checks', () => {
  // Independently read-only SQL totals from the five production companies.
  for (const [assets,liabilities,profit] of [[51667.77,0,51667.77],[183748,209980,-26232],[0,0,0],[54293.92,19790,34503.92],[13972,10000,3972]]) {
    const report=statements.balanceSheet([{type:'asset',balance:assets},{type:'liability',balance:liabilities},{type:'revenue',balance:profit}]);
    assert.equal(report.difference,0); assert.equal(report.equity,profit);
  }
});
