// Runs on the production host through stdin. Prints aggregates only; no rows,
// credentials, custom account names, or snapshots are exported.
const db = require('/mnt/recovery/perfume-erp/app/server/models');
const assert = require('node:assert/strict');
// FINANCIAL_STATEMENTS_SOURCE
// REPORT_SERVICE_SOURCE

(async () => {
  const results = await db.sequelize.transaction({ readOnly: true }, async transaction => {
    await db.sequelize.query('SET TRANSACTION READ ONLY', { transaction, logging: false });
    // Force every service-level read into this read-only transaction. Hooks are
    // process-local and disappear when this validation process exits.
    for (const model of Object.values(db)) if (model?.addHook) model.addHook('beforeFind', options => { options.transaction = transaction; options.logging = false; });
    const tenants = await db.tenant.findAll({ attributes: ['id', 'name'], transaction, logging: false });
    const summaries = [];
    for (const tenant of tenants) {
      const lines = await db.journalEntryLine.findAll({ include: [
        { model: db.journalEntry, required: true, where: { tenant_id: tenant.id, status: 'posted' } },
        { model: db.account, required: true, where: { tenant_id: tenant.id } }
      ], transaction, logging: false });
      const rows = statements.trialBalance(lines);
      const sheet = statements.balanceSheet(rows);
      const debit = rows.reduce((sum,row)=>sum+statements.cents(row.debit),0);
      const credit = rows.reduce((sum,row)=>sum+statements.cents(row.credit),0);
      assert.equal(debit, credit);
      assert.equal(sheet.difference, 0);
      // Independent SQL provides the reference rather than stored balances.
      const [reference] = await db.sequelize.query(`SELECT
        coalesce(sum(CASE WHEN a.type='asset' THEN l.debit-l.credit ELSE 0 END),0) AS assets,
        coalesce(sum(CASE WHEN a.type='liability' THEN l.credit-l.debit ELSE 0 END),0) AS liabilities,
        coalesce(sum(CASE WHEN a.type IN ('equity','revenue') THEN l.credit-l.debit WHEN a.type='expense' THEN l.credit-l.debit ELSE 0 END),0) AS equity
        FROM journal_entry_lines l JOIN journal_entries j ON j.id=l.journal_entry_id JOIN accounts a ON a.id=l.account_id
        WHERE j.tenant_id=:tenant AND j.status='posted'`, { replacements: { tenant: tenant.id }, transaction, logging: false });
      for (const key of ['assets','liabilities','equity']) assert.equal(statements.cents(sheet[key]),statements.cents(reference[0][key]));
      const date = new Date().toISOString().slice(0,10);
      const [serviceSheet, health, pnl] = await Promise.all([
        reports.balanceSheet(tenant.id,date), reports.accountingHealth(tenant.id), reports.profitAndLossStatement(tenant.id,'2000-01-01',date)
      ]);
      assert.equal(serviceSheet.difference,0);
      assert.equal(health.difference,0);
      assert.equal(health.unbalanced_journals.length,0);
      assert.equal(statements.cents(pnl.summary.net_profit),statements.cents(sheet.unclosed_earnings));
      const branchIds = [...new Set(lines.map(line=>line.journalEntry.branch_id || null))];
      for (const branchId of branchIds) {
        const branchSheet = statements.balanceSheet(statements.trialBalance(lines.filter(line=>(line.journalEntry.branch_id || null)===branchId)));
        assert.equal(branchSheet.difference,0);
      }
      summaries.push({ company: tenant.name.trim(), posted_lines_checked: lines.length, branches_checked: branchIds.length,
        trial_difference: (debit-credit)/100, assets: sheet.assets, liabilities: sheet.liabilities, equity: sheet.equity, independent_sql: 'matched' });
      summaries[summaries.length-1].net_profit = pnl.summary.net_profit;
      summaries[summaries.length-1].stale_company_balances = health.stored_balance_mismatches.length;
    }
    return summaries;
  });
  console.log(JSON.stringify(results));
})().catch(error=>{ console.error(error.message); process.exitCode=1; }).finally(()=>db.sequelize.close());
