module.exports = {
  ROLES: ['super_admin', 'admin', 'manager', 'accountant', 'production_mgr', 'warehouse', 'sales', 'viewer'],
  PO_STATUS: ['draft', 'approved', 'sent', 'partial', 'completed', 'cancelled'],
  PROD_STATUS: ['planned', 'in_progress', 'completed', 'cancelled'],
  SO_STATUS: ['draft', 'confirmed', 'invoiced', 'delivered', 'cancelled'],
  INVOICE_STATUS: ['unpaid', 'partial', 'paid', 'overdue'],
  JOURNAL_STATUS: ['draft', 'posted'],
  EXPENSE_STATUS: ['draft', 'approved'],
  ACCOUNT_TYPES: ['asset', 'liability', 'equity', 'revenue', 'expense'],
  PAYMENT_MODES: ['cash', 'bank_transfer', 'cheque', 'upi', 'card'],
  ACCOUNT_CODES: {
    CASH: '1000', BANK: '1010', AR: '1100',
    RAW_INVENTORY: '1200', PKG_INVENTORY: '1210', WIP: '1220', FG_INVENTORY: '1300',
    AP: '2000', TAX_PAYABLE: '2100',
    CAPITAL: '3000', RETAINED: '3100',
    SALES_REVENUE: '4000', OTHER_INCOME: '4100',
    COGS: '5000', MFG_OVERHEAD: '5100'
  }
};
