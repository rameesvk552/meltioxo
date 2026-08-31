const VIEW_PERMISSION_KEYS = [
  'dashboard', 'inventory.raw_materials', 'inventory.packaging',
  'inventory.packing_kits', 'inventory.finished_goods', 'suppliers',
  'purchases', 'formulas', 'production', 'customers', 'pos', 'day_register',
  'sales', 'finance.accounts', 'finance.journal_entries', 'finance.payments',
  'finance.expenses', 'finance.payables', 'finance.receivables',
  'reports.profit_loss', 'reports.sales_profit', 'reports.balance_sheet',
  'reports.trial_balance', 'reports.stock', 'reports.production',
  'reports.audit_log', 'settings'
];

const DASHBOARD_WIDGET_KEYS = [
  'today_sales', 'inventory_value', 'pending_production', 'low_stock_count',
  'overdue_payables', 'overdue_receivables', 'revenue_trend',
  'revenue_by_product', 'low_stock_list', 'recent_activities', 'overdue_payments'
];

module.exports = { VIEW_PERMISSION_KEYS, DASHBOARD_WIDGET_KEYS };
