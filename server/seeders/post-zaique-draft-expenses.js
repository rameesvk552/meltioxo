require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const db = require('../models');
const accounting = require('../services/accounting.service');

const TARGET_EMAIL = 'zaiqueperfume@gmail.com';
const EXPECTED_TENANT_NAME = 'zaique perfume';

const main = async () => {
  const apply = process.argv.includes('--apply');
  const user = await db.user.findOne({
    where: db.sequelize.where(
      db.sequelize.fn('lower', db.sequelize.fn('trim', db.sequelize.col('email'))),
      TARGET_EMAIL
    )
  });
  if (!user) throw new Error(`Production user ${TARGET_EMAIL} was not found`);

  const tenant = await db.tenant.findByPk(user.tenant_id);
  if (!tenant || String(tenant.name).trim().toLowerCase() !== EXPECTED_TENANT_NAME) {
    throw new Error(`Tenant safety check failed for ${TARGET_EMAIL}`);
  }

  const drafts = await db.expense.findAll({
    where: { tenant_id: tenant.id, status: 'draft' },
    order: [['expense_date', 'ASC'], ['created_at', 'ASC']]
  });
  const preview = drafts.map(item => ({ id: item.id, expense_number: item.expense_number, date: item.expense_date, amount: Number(item.amount), description: item.description }));
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', tenant_id: tenant.id, tenant_name: tenant.name, count: drafts.length, amount: preview.reduce((sum, item) => sum + item.amount, 0), expenses: preview }, null, 2));
  if (!apply || !drafts.length) return;

  const posted = await db.sequelize.transaction(async transaction => {
    const locked = await db.expense.findAll({
      where: { tenant_id: tenant.id, status: 'draft' },
      order: [['expense_date', 'ASC'], ['created_at', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    const results = [];
    for (const item of locked) {
      const costAccount = await db.account.findOne({
        where: { id: item.account_id, tenant_id: tenant.id, type: 'expense', is_active: true, is_group: false },
        transaction
      });
      if (!costAccount) throw new Error(`Expense ${item.id} does not use an active expense ledger`);
      const method = await accounting.resolvePaymentMethod(tenant.id, item, transaction);
      const journal = await accounting.createAndPost(tenant.id, {
        entry_date: item.expense_date,
        reference_type: 'expense',
        reference_id: item.id,
        narration: item.description || `Expense ${item.expense_number}`,
        lines: [
          { account_id: costAccount.id, debit_amount: item.amount, description: item.description },
          { account_id: method.account.id, credit_amount: item.amount, description: item.description }
        ]
      }, user.id, transaction);
      await item.update({ status: 'approved', approved_by: user.id, journal_entry_id: journal.id }, { transaction });
      results.push({ expense_id: item.id, journal_entry_id: journal.id, amount: Number(item.amount) });
    }
    return results;
  });

  console.log(JSON.stringify({ posted_count: posted.length, posted_amount: posted.reduce((sum, item) => sum + item.amount, 0), posted }, null, 2));
};

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());
