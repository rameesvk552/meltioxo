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
    CASH_BANK_GROUP: '1002', CASH: '1004', AR: '1005',
    RAW_INVENTORY: '1201', PKG_INVENTORY: '1202', WIP: '1203', FG_INVENTORY: '1204',
    INPUT_TAX: '2301', AP: '2001', TAX_PAYABLE: '2302',
    CAPITAL: '2102', RETAINED: '2103',
    SALES_REVENUE: '4102', DISCOUNT_RECEIVED: '4201',
    PURCHASES: '5101', COGS: '5102', PURCHASE_VARIANCE: '5103', MFG_OVERHEAD: '5201'
  }
};
