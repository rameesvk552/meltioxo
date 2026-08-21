import React from 'react';
import { Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  DashboardOutlined, 
  AppstoreOutlined, 
  ShopOutlined, 
  ShoppingCartOutlined, 
  ExperimentOutlined, 
  ToolOutlined, 
  TeamOutlined, 
  DollarOutlined, 
  CreditCardOutlined,
  BankOutlined, 
  LineChartOutlined, 
  SettingOutlined 
} from '@ant-design/icons';

export default function Sidebar({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = location.pathname === '/app/retail-sales/new'
    ? '/app/retail-sales/new'
    : location.pathname.startsWith('/app/retail-sales/')
      ? '/app/retail-sales'
      : location.pathname;

  const items = [
    { key: '/app/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: 'inventory', icon: <AppstoreOutlined />, label: 'Inventory', children: [
      { key: '/app/raw-materials', label: 'Raw Materials' },
      { key: '/app/packaging', label: 'Packaging' },
      { key: '/app/finished-goods', label: 'Products & Variants' },
    ]},
    { key: '/app/suppliers', icon: <ShopOutlined />, label: 'Suppliers' },
    { key: '/app/purchases', icon: <ShoppingCartOutlined />, label: 'Purchases' },
    { key: '/app/formulas', icon: <ExperimentOutlined />, label: 'Formulas' },
    { key: '/app/production', icon: <ToolOutlined />, label: 'Production' },
    { key: '/app/customers', icon: <TeamOutlined />, label: 'Customers' },
    { key: '/app/retail-sales/new', icon: <CreditCardOutlined />, label: 'POS' },
    { key: 'sales', icon: <DollarOutlined />, label: 'Sales', children: [
      { key: '/app/retail-sales', label: 'Retail Sales' },
    ]},
    { key: 'finance', icon: <BankOutlined />, label: 'Finance', children: [
      { key: '/app/accounts', label: 'Chart of Accounts' },
      { key: '/app/journal-entries', label: 'Journal Entries' },
      { key: '/app/payments', label: 'Payments' },
      { key: '/app/expenses', label: 'Expenses' },
      { key: '/app/payables', label: 'Payables' },
      { key: '/app/receivables', label: 'Receivables' },
    ]},
    { key: 'reports', icon: <LineChartOutlined />, label: 'Reports', children: [
      { key: '/app/reports/profit-loss', label: 'Owner Profit & Loss' },
      { key: '/app/reports/balance-sheet', label: 'Balance Sheet' },
      { key: '/app/reports/trial-balance', label: 'Trial Balance' },
      { key: '/app/reports/stock', label: 'Stock Report' },
      { key: '/app/reports/production', label: 'Production Owner Report' },
    ]},
    { key: '/app/settings', icon: <SettingOutlined />, label: 'Settings' },
  ];

  return (
    <Menu 
      mode="inline"
      theme="light"
      items={items}
      selectedKeys={[selectedKey]}
      onClick={({ key }) => {
        // Parent menu keys only expand/collapse their submenu; route selections
        // should also dismiss the mobile drawer after navigation.
        if (!key.startsWith('/')) return;
        navigate(key);
        onNavigate?.();
      }}
      style={{ borderRight: 0 }}
    />
  );
}
