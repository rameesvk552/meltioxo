const db = require('../models');

exports.seedChartOfAccounts = async (tenantId, transaction) => {
  const accounts = [
    // Assets
    // 1000 is a group. Sales and payments must always select one of its child ledgers.
    { tenant_id: tenantId, code: '1000', name: 'Cash & Bank', type: 'asset', is_system: true, is_group: true },
    { tenant_id: tenantId, code: '1001', name: 'Cash in Hand', type: 'asset', parent_code: '1000', is_system: true },
    // These are control ledgers: system postings are permitted, while customer/supplier
    // detail is held in subledgers rather than directly in a journal entry form.
    { tenant_id: tenantId, code: '1100', name: 'Accounts Receivable', type: 'asset', is_system: true },
    { tenant_id: tenantId, code: '1110', name: 'Input Tax Recoverable', type: 'asset', is_system: true },
    { tenant_id: tenantId, code: '1200', name: 'Raw Material Inventory', type: 'asset', is_system: true },
    { tenant_id: tenantId, code: '1210', name: 'Packaging Inventory', type: 'asset', is_system: true },
    { tenant_id: tenantId, code: '1220', name: 'Work in Progress', type: 'asset', is_system: true },
    { tenant_id: tenantId, code: '1300', name: 'Finished Goods Inventory', type: 'asset', is_system: true },
    // Liabilities
    { tenant_id: tenantId, code: '2000', name: 'Accounts Payable', type: 'liability', is_system: true },
    { tenant_id: tenantId, code: '2100', name: 'Tax Payable', type: 'liability', is_system: true },
    // Equity
    { tenant_id: tenantId, code: '3000', name: "Owner's Capital", type: 'equity', is_system: true },
    { tenant_id: tenantId, code: '3100', name: 'Retained Earnings', type: 'equity', is_system: true },
    // Revenue
    { tenant_id: tenantId, code: '4000', name: 'Sales Revenue', type: 'revenue', is_system: true },
    // Expenses
    { tenant_id: tenantId, code: '5000', name: 'Cost of Goods Sold', type: 'expense', is_system: true },
    { tenant_id: tenantId, code: '5100', name: 'Manufacturing Overhead', type: 'expense', is_system: true }
  ];
  // Resolve parent codes before insert because account.parent_id is a UUID.
  for (const item of accounts) {
    if (item.parent_code) {
      const parent = await db.account.findOne({ where: { tenant_id: tenantId, code: item.parent_code }, transaction });
      item.parent_id = parent?.id || null;
      delete item.parent_code;
    }
    await db.account.create(item, { transaction });
  }
};
