export const VIEW_PERMISSION_GROUPS = [
  {
    label: 'General',
    options: [
      { key: 'dashboard', label: 'Dashboard', path: '/app/dashboard' },
    ],
  },
  {
    label: 'Inventory',
    options: [
      { key: 'inventory.raw_materials', label: 'Raw Materials', path: '/app/raw-materials' },
      { key: 'inventory.packaging', label: 'Packaging', path: '/app/packaging' },
      { key: 'inventory.packing_kits', label: 'Packing Kits', path: '/app/packing-kits' },
      { key: 'inventory.finished_goods', label: 'Products & Variants', path: '/app/finished-goods' },
    ],
  },
  {
    label: 'Operations',
    options: [
      { key: 'suppliers', label: 'Suppliers', path: '/app/suppliers' },
      { key: 'purchases', label: 'Purchases', path: '/app/purchases' },
      { key: 'formulas', label: 'Formulas', path: '/app/formulas' },
      { key: 'production', label: 'Production', path: '/app/production' },
      { key: 'customers', label: 'Customers', path: '/app/customers' },
      { key: 'pos', label: 'Point of Sale', path: '/app/retail-sales/new' },
      { key: 'day_register', label: 'Day Register', path: '/app/day-register' },
      { key: 'sales', label: 'Retail Sales', path: '/app/retail-sales' },
    ],
  },
  {
    label: 'Finance',
    options: [
      { key: 'finance.accounts', label: 'Chart of Accounts', path: '/app/accounts' },
      { key: 'finance.journal_entries', label: 'Journal Entries', path: '/app/journal-entries' },
      { key: 'finance.payments', label: 'Payments', path: '/app/payments' },
      { key: 'finance.expenses', label: 'Expenses', path: '/app/expenses' },
      { key: 'finance.payables', label: 'Payables', path: '/app/payables' },
      { key: 'finance.receivables', label: 'Receivables', path: '/app/receivables' },
    ],
  },
  {
    label: 'Reports',
    options: [
      { key: 'reports.profit_loss', label: 'Profit & Loss', path: '/app/reports/profit-loss' },
      { key: 'reports.sales_profit', label: 'Daily Sales & Profit', path: '/app/reports/sales-profit' },
      { key: 'reports.balance_sheet', label: 'Balance Sheet', path: '/app/reports/balance-sheet' },
      { key: 'reports.trial_balance', label: 'Trial Balance', path: '/app/reports/trial-balance' },
      { key: 'reports.stock', label: 'Stock Report', path: '/app/reports/stock' },
      { key: 'reports.production', label: 'Production Owner Report', path: '/app/reports/production' },
      { key: 'reports.audit_log', label: 'Audit Log', path: '/app/reports/audit-log' },
    ],
  },
  {
    label: 'Administration',
    options: [
      { key: 'settings', label: 'Company Settings', path: '/app/settings' },
    ],
  },
];

export const VIEW_PERMISSIONS = VIEW_PERMISSION_GROUPS.flatMap(group => group.options);
export const ALL_VIEW_PERMISSION_KEYS = VIEW_PERMISSIONS.map(permission => permission.key);

export const DASHBOARD_WIDGETS = [
  { key: 'today_sales', label: "Today's Sales" },
  { key: 'inventory_value', label: 'Inventory Value' },
  { key: 'pending_production', label: 'Pending Production' },
  { key: 'low_stock_count', label: 'Low Stock Count' },
  { key: 'overdue_payables', label: 'Overdue Payables' },
  { key: 'overdue_receivables', label: 'Overdue Receivables' },
  { key: 'revenue_trend', label: 'Revenue Trend' },
  { key: 'revenue_by_product', label: 'Revenue by Product' },
  { key: 'low_stock_list', label: 'Low Stock List' },
  { key: 'recent_activities', label: 'Recent Activities' },
  { key: 'overdue_payments', label: 'Overdue Payments' },
];

export const ALL_DASHBOARD_WIDGET_KEYS = DASHBOARD_WIDGETS.map(widget => widget.key);
export const PRIVILEGED_ROLES = ['super_admin', 'admin'];

const hasExplicitPermissions = user => Boolean(user?.permissions && typeof user.permissions === 'object');

export const hasViewPermission = (user, permission) => {
  if (!user || !permission) return false;
  if (PRIVILEGED_ROLES.includes(user.role)) return true;
  if (!hasExplicitPermissions(user)) return true;
  return Array.isArray(user.permissions.views) && user.permissions.views.includes(permission);
};

export const hasAnyViewPermission = (user, permissions) =>
  permissions.some(permission => hasViewPermission(user, permission));

export const hasDashboardWidgetPermission = (user, widget) => {
  if (!user || !widget) return false;
  if (PRIVILEGED_ROLES.includes(user.role)) return true;
  if (!hasExplicitPermissions(user)) return true;
  return Array.isArray(user.permissions.dashboard_widgets)
    && user.permissions.dashboard_widgets.includes(widget);
};

export const getFirstAllowedPath = user =>
  VIEW_PERMISSIONS.find(permission => hasViewPermission(user, permission.key))?.path || null;

export const getViewPermissionsForPath = pathname => {
  if (pathname === '/app/dashboard') return ['dashboard'];
  if (pathname.startsWith('/app/raw-materials')) return ['inventory.raw_materials'];
  if (pathname.startsWith('/app/packaging')) return ['inventory.packaging'];
  if (pathname.startsWith('/app/packing-kits')) return ['inventory.packing_kits'];
  if (pathname.startsWith('/app/finished-goods')) return ['inventory.finished_goods'];
  if (pathname.startsWith('/app/suppliers')) return ['suppliers'];
  if (pathname.startsWith('/app/purchases') || pathname.startsWith('/app/direct-purchases')) return ['purchases'];
  if (pathname.startsWith('/app/formulas')) return ['formulas'];
  if (pathname.startsWith('/app/production')) return ['production'];
  if (pathname.startsWith('/app/customers')) return ['customers'];
  if (pathname === '/app/retail-sales/new') return ['pos'];
  if (pathname.startsWith('/app/retail-sales/')) return ['sales', 'pos'];
  if (pathname === '/app/retail-sales') return ['sales'];
  if (pathname.startsWith('/app/day-register')) return ['day_register'];
  if (pathname.startsWith('/app/accounts')) return ['finance.accounts'];
  if (pathname.startsWith('/app/journal-entries')) return ['finance.journal_entries'];
  if (pathname.startsWith('/app/payments')) return ['finance.payments'];
  if (pathname.startsWith('/app/expenses')) return ['finance.expenses'];
  if (pathname.startsWith('/app/payables')) return ['finance.payables'];
  if (pathname.startsWith('/app/receivables')) return ['finance.receivables'];
  if (pathname.startsWith('/app/reports/profit-loss')) return ['reports.profit_loss'];
  if (pathname.startsWith('/app/reports/sales-profit')) return ['reports.sales_profit'];
  if (pathname.startsWith('/app/reports/balance-sheet')) return ['reports.balance_sheet'];
  if (pathname.startsWith('/app/reports/trial-balance')) return ['reports.trial_balance'];
  if (pathname.startsWith('/app/reports/stock')) return ['reports.stock'];
  if (pathname.startsWith('/app/reports/production')) return ['reports.production'];
  if (pathname.startsWith('/app/reports/audit-log')) return ['reports.audit_log'];
  if (pathname.startsWith('/app/settings')) return ['settings'];
  return [];
};
