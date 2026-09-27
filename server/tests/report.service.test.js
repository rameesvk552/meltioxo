const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../models');
const reports = require('../services/report.service');
const ctrl = require('../controllers/report.controller');
const { requestContext, setAuditBranch } = require('../middleware/auditContext');
const { Op } = require('sequelize');

test('P&L recognises discounts, returns, direct costs and expenses exactly once', async () => {
  const original=db.journalEntryLine.findAll;
  db.journalEntryLine.findAll=async ()=>[
    ['income','4102','Sales','revenue',0,1000],['income','4102','Sales','revenue',100,0],
    ['discount','5202','Discount allowed','expense',50,0],['cogs','5102','COGS','expense',300,0],
    ['rent','5203','Rent','expense',100,0]
  ].map(([id,code,name,type,debit,credit])=>({account:{id,code,name,type},debit,credit,journalEntry:{entry_date:'2026-09-01'}}));
  try {
    const report=await reports.profitAndLossStatement('tenant','2026-09-01','2026-09-30');
    assert.equal(report.summary.revenue,850);assert.equal(report.summary.cogs,300);
    assert.equal(report.summary.operating_expenses,100);assert.equal(report.summary.gross_profit,550);assert.equal(report.summary.net_profit,450);
  } finally { db.journalEntryLine.findAll=original; }
});

test('journal reports constrain posted entries to tenant, branch and date', async () => {
  const original=db.journalEntryLine.findAll;
  let options;
  db.journalEntryLine.findAll=async query=>{options=query;return [];};
  try {
    await new Promise((resolve,reject)=>requestContext({ method:'GET',originalUrl:'/test',get:()=>null },{},async ()=>{
      try {setAuditBranch('branch-a');await reports.trialBalance('tenant-a','2026-09-27');resolve();}catch(e){reject(e);}
    }));
    const where=options.include[0].where;
    assert.equal(where.tenant_id,'tenant-a'); assert.equal(where.branch_id,'branch-a'); assert.equal(where.status,'posted');
    assert.equal(where.entry_date[Op.lte],'2026-09-27');
    assert.equal(options.include[1].where.tenant_id,'tenant-a');
  } finally {db.journalEntryLine.findAll=original;}
});

test('invalid calendar dates and reversed ranges are rejected before database work', async () => {
  for (const [handler,query] of [[ctrl.balanceSheet,{as_of:'2026-02-30'}],[ctrl.managementReport,{from:'2026-09-30',to:'2026-09-01'}],[ctrl.ledgerStatement,{from:'2026-01-01',to:'2026-13-01'}]]) {
    let error;
    await handler({query,params:{},tenantId:'test'},{json:()=>assert.fail('must reject')},err=>{error=err;});
    assert.equal(error.statusCode,400);
  }
});

test('historical statements default to the fiscal year containing the requested end date', async () => {
  const original = reports.profitAndLossStatement;
  let received;
  reports.profitAndLossStatement = async (tenant,from,to) => { received = { tenant,from,to }; return { period: { from,to } }; };
  try {
    await ctrl.profitLossStatement({ tenantId:'tenant',query:{to:'2025-03-31'} }, { json:()=>{} }, error=>{throw error;});
    assert.deepEqual(received, { tenant:'tenant',from:'2024-04-01',to:'2025-03-31' });
  } finally { reports.profitAndLossStatement = original; }
});

test('offsetting unbalanced journals still require accounting review', async () => {
  const originals = { journals:db.journalEntry.findAll, accounts:db.account.findAll, trial:reports.trialBalance };
  db.journalEntry.findAll = async () => [
    { id:'a',entry_number:'JE-A',total_debit:10,total_credit:0,journalEntryLines:[{debit:10,credit:0}] },
    { id:'b',entry_number:'JE-B',total_debit:0,total_credit:10,journalEntryLines:[{debit:0,credit:10}] }
  ];
  db.account.findAll = async () => [];
  reports.trialBalance = async () => [{debit:10,credit:10}];
  try {
    const health = await reports.accountingHealth('tenant');
    assert.equal(health.difference,0);
    assert.equal(health.unbalanced_journals.length,2);
    assert.equal(health.balanced,false);
  } finally {
    db.journalEntry.findAll = originals.journals;
    db.account.findAll = originals.accounts;
    reports.trialBalance = originals.trial;
  }
});
