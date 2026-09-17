const db = require('../models');

// The order is significant: every parent is created before its children.
// Statement headings are stored as groups so every accounting screen can use
// the same hierarchy instead of maintaining a separate, hard-coded tree.
const DEFAULT_ACCOUNTS = [
  { code: 'BS', name: 'Balance Sheet', type: 'asset', is_group: true },
  { code: 'BS-ASSET', name: 'Assets', type: 'asset', parent_code: 'BS', is_group: true },
  { code: 'G1100', name: 'Fixed Assets', type: 'asset', parent_code: 'BS-ASSET', is_group: true },
  { code: 'G1200', name: 'Current Assets', type: 'asset', parent_code: 'BS-ASSET', is_group: true },
  { code: '1002', name: 'Cash & Bank', type: 'asset', parent_code: 'G1200', is_group: true },
  { code: '1004', name: 'Cash', type: 'asset', parent_code: '1002' },
  { code: '1005', name: 'Trade Debtors', type: 'asset', parent_code: 'G1200' },
  { code: 'G1250', name: 'Inventory', type: 'asset', parent_code: 'G1200', is_group: true },
  { code: '1201', name: 'Raw Material Inventory', type: 'asset', parent_code: 'G1250' },
  { code: '1202', name: 'Packaging Material Inventory', type: 'asset', parent_code: 'G1250' },
  { code: '1203', name: 'Work in Progress Inventory', type: 'asset', parent_code: 'G1250' },
  { code: '1204', name: 'Finished Goods Inventory', type: 'asset', parent_code: 'G1250' },
  { code: 'G1300', name: 'Tax Credits', type: 'asset', parent_code: 'BS-ASSET', is_group: true },
  { code: '1301', name: 'Input CGST Credit', type: 'asset', parent_code: 'G1300' },
  { code: '1302', name: 'Input SGST Credit', type: 'asset', parent_code: 'G1300' },
  { code: '1303', name: 'Input IGST Credit', type: 'asset', parent_code: 'G1300' },
  { code: '2301', name: 'Input Tax Credit', type: 'asset', parent_code: 'G1300' },

  { code: 'BS-EQUITY', name: 'Equity', type: 'equity', parent_code: 'BS', is_group: true },
  { code: 'G2100', name: 'Capital', type: 'equity', parent_code: 'BS-EQUITY', is_group: true },
  { code: '2101', name: 'Opening Balance Equity', type: 'equity', parent_code: 'G2100' },
  { code: '2102', name: "Owner's Capital", type: 'equity', parent_code: 'G2100' },
  { code: '2103', name: 'Retained Earnings', type: 'equity', parent_code: 'G2100' },

  { code: 'BS-LIAB', name: 'Liabilities', type: 'liability', parent_code: 'BS', is_group: true },
  { code: 'G2200', name: 'Current Liabilities', type: 'liability', parent_code: 'BS-LIAB', is_group: true },
  { code: '2001', name: 'Trade Creditors', type: 'liability', parent_code: 'G2200', is_group: true },
  { code: '2002', name: 'Customer Advances', type: 'liability', parent_code: 'G2200' },
  { code: '2003', name: 'Expense Payable', type: 'liability', parent_code: 'G2200' },
  { code: 'G2300', name: 'Tax Payables', type: 'liability', parent_code: 'BS-LIAB', is_group: true },
  { code: '2302', name: 'Output Tax Payable', type: 'liability', parent_code: 'G2300' },
  { code: '2303', name: 'Output CGST Payable', type: 'liability', parent_code: 'G2300' },
  { code: '2304', name: 'Output SGST Payable', type: 'liability', parent_code: 'G2300' },
  { code: '2305', name: 'Output IGST Payable', type: 'liability', parent_code: 'G2300' },

  { code: 'PL', name: 'Profit and Loss', type: 'expense', is_group: true },
  { code: 'PL-EXPENSE', name: 'Expenses', type: 'expense', parent_code: 'PL', is_group: true },
  { code: 'G5100', name: 'Direct Expenses', type: 'expense', parent_code: 'PL-EXPENSE', is_group: true },
  { code: '5101', name: 'Purchases', type: 'expense', parent_code: 'G5100' },
  { code: '5102', name: 'Cost of Goods Sold', type: 'expense', parent_code: 'G5100' },
  { code: '5103', name: 'Purchase Cost Variance', type: 'expense', parent_code: 'G5100' },
  { code: 'G5200', name: 'Indirect Expenses', type: 'expense', parent_code: 'PL-EXPENSE', is_group: true },
  { code: '5201', name: 'Manufacturing Overhead', type: 'expense', parent_code: 'G5200' },
  { code: '5202', name: 'Discount Allowed', type: 'expense', parent_code: 'G5200' },
  { code: 'PL-INCOME', name: 'Income', type: 'revenue', parent_code: 'PL', is_group: true },
  { code: 'G4100', name: 'Direct Income', type: 'revenue', parent_code: 'PL-INCOME', is_group: true },
  { code: '4102', name: 'Sales', type: 'revenue', parent_code: 'G4100' },
  { code: 'G4200', name: 'Indirect Income', type: 'revenue', parent_code: 'PL-INCOME', is_group: true },
  { code: '4201', name: 'Discount Received', type: 'revenue', parent_code: 'G4200' }
];

// Rename former system ledgers in place. Their UUIDs stay unchanged, preserving
// journal history, payment-method mappings, balances, and production references.
const LEGACY_CODE_MIGRATIONS = [
  ['1000', '1002'], ['1001', '1004'], ['1100', '1005'], ['1110', '2301'],
  ['1200', '1201'], ['1210', '1202'], ['1220', '1203'], ['1300', '1204'],
  ['2000', '2001'], ['2100', '2302'], ['3000', '2102'], ['3100', '2103'],
  ['4000', '4102'], ['4101', '4201'], ['5000', '5102'], ['5100', '5201']
];

const ensureChartOfAccounts = async (tenantId, transaction) => {
  for (const [legacyCode, newCode] of LEGACY_CODE_MIGRATIONS) {
    const [legacy, current] = await Promise.all([
      db.account.findOne({ where: { tenant_id: tenantId, code: legacyCode }, transaction }),
      db.account.findOne({ where: { tenant_id: tenantId, code: newCode }, transaction })
    ]);
    if (legacy && !current) await legacy.update({ code: newCode }, { transaction });
  }

  const byCode = new Map();
  for (const definition of DEFAULT_ACCOUNTS) {
    const parent = definition.parent_code ? byCode.get(definition.parent_code) : null;
    const values = {
      name: definition.name,
      type: definition.type,
      parent_id: parent?.id || null,
      is_group: Boolean(definition.is_group),
      is_system: true,
      is_active: true
    };
    let item = await db.account.findOne({ where: { tenant_id: tenantId, code: definition.code }, transaction });
    if (item) await item.update(values, { transaction });
    else item = await db.account.create({ tenant_id: tenantId, code: definition.code, ...values }, { transaction });
    byCode.set(definition.code, item);
  }
  return [...byCode.values()];
};

exports.DEFAULT_ACCOUNTS = DEFAULT_ACCOUNTS;
exports.ensureChartOfAccounts = ensureChartOfAccounts;
exports.seedChartOfAccounts = ensureChartOfAccounts;
