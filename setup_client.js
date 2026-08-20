const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, 'client');
const srcDir = path.join(clientDir, 'src');

const dirs = [
  'api',
  'components/layout',
  'components/common',
  'context',
  'pages/auth',
  'pages/dashboard',
  'pages/inventory',
  'pages/purchasing',
  'pages/manufacturing',
  'pages/sales',
  'pages/finance',
  'pages/reports',
  'pages/settings',
  'styles',
  'theme'
];

dirs.forEach(d => fs.mkdirSync(path.join(srcDir, d), { recursive: true }));

const files = {};

files['styles/design-system.css'] = `
:root {
  /* Colors - Dark Luxury Theme */
  --color-bg-primary: #0a0f1c;
  --color-bg-secondary: #0f1729;
  --color-bg-elevated: #1a2744;
  --color-bg-card: rgba(26, 39, 68, 0.6);
  --color-bg-glass: rgba(26, 39, 68, 0.4);
  --color-bg-hover: rgba(212, 168, 83, 0.08);
  
  --color-gold: #d4a853;
  --color-gold-light: #e8c97a;
  --color-gold-dark: #b8913a;
  --color-gold-bg: rgba(212, 168, 83, 0.1);
  
  --color-text-primary: #f0f2f5;
  --color-text-secondary: rgba(240, 242, 245, 0.65);
  --color-text-muted: rgba(240, 242, 245, 0.4);
  
  --color-border: rgba(255, 255, 255, 0.08);
  --color-border-hover: rgba(212, 168, 83, 0.3);
  
  --color-success: #52c41a;
  --color-warning: #faad14;
  --color-error: #ff4d4f;
  --color-info: #1890ff;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  
  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-heading: 'Playfair Display', serif;
  --font-size-xs: 12px;
  --font-size-sm: 13px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 32px;
  
  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.15);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.2);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.3);
  --shadow-gold: 0 4px 16px rgba(212, 168, 83, 0.15);
  
  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.25s ease;
  --transition-slow: 0.4s ease;
  
  /* Layout */
  --sidebar-width: 260px;
  --sidebar-collapsed-width: 72px;
  --header-height: 64px;
  --mobile-nav-height: 64px;
}
`;

files['styles/global.css'] = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700;800&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-family);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  color: var(--color-gold);
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: var(--color-bg-secondary);
}
::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-full);
}
::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-hover);
}

/* Antd overrides */
.ant-card {
  background: var(--color-bg-card) !important;
  backdrop-filter: blur(10px);
  border: 1px solid var(--color-border) !important;
}

.ant-table-wrapper {
  background: transparent !important;
}

/* Mobile utils */
.desktop-only { display: none; }
@media (min-width: 768px) {
  .desktop-only { display: block; }
  .mobile-only { display: none; }
}
`;

files['theme/antdTheme.js'] = `
import { theme } from 'antd';

export const antdTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#d4a853',
    colorBgContainer: '#0f1729',
    colorBgElevated: '#1a2744',
    colorBorder: 'rgba(255,255,255,0.08)',
    colorText: '#f0f2f5',
    fontFamily: "'Inter', sans-serif",
    borderRadius: 8,
  },
  components: {
    Card: {
      colorBgContainer: 'rgba(26, 39, 68, 0.6)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    Menu: {
      colorItemBg: 'transparent',
      colorItemBgSelected: 'rgba(212, 168, 83, 0.1)',
      colorItemTextSelected: '#d4a853',
    }
  }
};
`;

files['api/client.js'] = `
import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:5000/api',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = \\\`Bearer \\\${token}\\\`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
`;

files['context/AuthContext.jsx'] = `
import React, { createContext, useState, useEffect } from 'react';
import client from '../api/client';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate token on mount
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // Mock login
    const mockToken = 'mock-jwt-token';
    setToken(mockToken);
    setUser({ email, name: 'Admin User', role: 'admin' });
    localStorage.setItem('token', mockToken);
  };

  const register = async (data) => {
    // Mock register
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, tenant, isAuthenticated: !!token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
`;

files['context/NotificationContext.jsx'] = `
import React, { createContext } from 'react';
import { message, notification } from 'antd';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [messageApi, contextHolder] = message.useMessage();
  const [notificationApi, notifContextHolder] = notification.useNotification();

  const showSuccess = (msg) => messageApi.success(msg);
  const showError = (msg) => messageApi.error(msg);
  const showWarning = (msg) => messageApi.warning(msg);
  const showInfo = (msg) => messageApi.info(msg);

  return (
    <NotificationContext.Provider value={{ showSuccess, showError, showWarning, showInfo, notificationApi }}>
      {contextHolder}
      {notifContextHolder}
      {children}
    </NotificationContext.Provider>
  );
};
`;

files['components/layout/AppLayout.jsx'] = `
import React, { useState } from 'react';
import { Layout, Drawer } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileBottomNav from './MobileBottomNav';

const { Content, Sider } = Layout;

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Desktop Sider */}
      <Sider 
        className="desktop-only"
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        style={{ borderRight: '1px solid var(--color-border)' }}
        width={260}
      >
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ margin: 0, color: 'var(--color-gold)' }}>{collapsed ? 'ERP' : 'Perfume ERP'}</h2>
        </div>
        <Sidebar />
      </Sider>

      {/* Mobile Drawer Sider */}
      <Drawer
        placement="left"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        styles={{ body: { padding: 0 } }}
        width={260}
        className="mobile-only"
      >
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ margin: 0, color: 'var(--color-gold)' }}>Perfume ERP</h2>
        </div>
        <Sidebar />
      </Drawer>

      <Layout>
        <Header 
          collapsed={collapsed} 
          setCollapsed={setCollapsed}
          mobileDrawerOpen={mobileDrawerOpen}
          setMobileDrawerOpen={setMobileDrawerOpen}
        />
        <Content style={{ padding: '24px', overflowY: 'auto', paddingBottom: '80px' }}>
          <Outlet />
        </Content>
      </Layout>
      <MobileBottomNav />
    </Layout>
  );
}
`;

files['components/layout/Sidebar.jsx'] = `
import React from 'react';
import { Menu } from 'antd';
import { useNavigate } from 'react-router-dom';
import { 
  DashboardOutlined, 
  AppstoreOutlined, 
  ShopOutlined, 
  ShoppingCartOutlined, 
  ExperimentOutlined, 
  ToolOutlined, 
  TeamOutlined, 
  DollarOutlined, 
  BankOutlined, 
  LineChartOutlined, 
  SettingOutlined 
} from '@ant-design/icons';

export default function Sidebar() {
  const navigate = useNavigate();

  const items = [
    { key: '/app/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: 'inventory', icon: <AppstoreOutlined />, label: 'Inventory', children: [
      { key: '/app/raw-materials', label: 'Raw Materials' },
      { key: '/app/packaging', label: 'Packaging' },
      { key: '/app/finished-goods', label: 'Finished Goods' },
    ]},
    { key: '/app/suppliers', icon: <ShopOutlined />, label: 'Suppliers' },
    { key: 'purchasing', icon: <ShoppingCartOutlined />, label: 'Purchasing', children: [
      { key: '/app/purchase-orders', label: 'Purchase Orders' },
    ]},
    { key: '/app/formulas', icon: <ExperimentOutlined />, label: 'Formulas' },
    { key: '/app/production', icon: <ToolOutlined />, label: 'Production' },
    { key: '/app/customers', icon: <TeamOutlined />, label: 'Customers' },
    { key: 'sales', icon: <DollarOutlined />, label: 'Sales', children: [
      { key: '/app/sales-orders', label: 'Sales Orders' },
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
      { key: '/app/reports/profit-loss', label: 'P&L' },
      { key: '/app/reports/balance-sheet', label: 'Balance Sheet' },
      { key: '/app/reports/trial-balance', label: 'Trial Balance' },
      { key: '/app/reports/stock', label: 'Stock Report' },
    ]},
    { key: '/app/settings', icon: <SettingOutlined />, label: 'Settings' },
  ];

  return (
    <Menu 
      mode="inline"
      theme="dark"
      items={items}
      onClick={({ key }) => navigate(key)}
      style={{ borderRight: 0 }}
    />
  );
}
`;

files['components/layout/Header.jsx'] = `
import React from 'react';
import { Layout, Button, Input, Badge, Avatar, Dropdown } from 'antd';
import { 
  MenuUnfoldOutlined, 
  MenuFoldOutlined, 
  BellOutlined, 
  SearchOutlined, 
  UserOutlined 
} from '@ant-design/icons';

const { Header: AntHeader } = Layout;

export default function Header({ collapsed, setCollapsed, setMobileDrawerOpen }) {
  return (
    <AntHeader style={{ 
      padding: '0 24px', 
      background: 'var(--color-bg-secondary)', 
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Button 
          type="text" 
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setCollapsed(!collapsed)}
          className="desktop-only"
          style={{ color: 'var(--color-text-primary)' }}
        />
        <Button 
          type="text" 
          icon={<MenuUnfoldOutlined />}
          onClick={() => setMobileDrawerOpen(true)}
          className="mobile-only"
          style={{ color: 'var(--color-text-primary)' }}
        />
        <Input 
          prefix={<SearchOutlined style={{ color: 'var(--color-text-muted)' }} />} 
          placeholder="Search..." 
          style={{ width: 250, background: 'var(--color-bg-primary)', border: 'none' }}
          className="desktop-only"
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <Badge count={5} size="small">
          <BellOutlined style={{ fontSize: '20px', color: 'var(--color-text-primary)', cursor: 'pointer' }} />
        </Badge>
        <Dropdown menu={{ items: [
          { key: 'profile', label: 'Profile' },
          { key: 'settings', label: 'Settings' },
          { type: 'divider' },
          { key: 'logout', label: 'Logout' },
        ]}} trigger={['click']}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: 'var(--color-gold)' }} />
            <span className="desktop-only">Admin User</span>
          </div>
        </Dropdown>
      </div>
    </AntHeader>
  );
}
`;

files['components/layout/MobileBottomNav.jsx'] = `
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardOutlined, AppstoreOutlined, ToolOutlined, DollarOutlined, EllipsisOutlined } from '@ant-design/icons';

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { key: '/app/dashboard', icon: <DashboardOutlined />, label: 'Dash' },
    { key: '/app/raw-materials', icon: <AppstoreOutlined />, label: 'Inv' },
    { key: '/app/production', icon: <ToolOutlined />, label: 'Prod' },
    { key: '/app/sales-orders', icon: <DollarOutlined />, label: 'Sales' },
    { key: '/app/settings', icon: <EllipsisOutlined />, label: 'More' },
  ];

  return (
    <div className="mobile-only" style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 'var(--mobile-nav-height)',
      background: 'var(--color-bg-elevated)',
      borderTop: '1px solid var(--color-border)',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      zIndex: 1000,
      paddingBottom: 'env(safe-area-inset-bottom)'
    }}>
      {tabs.map(tab => {
        const isActive = location.pathname.startsWith(tab.key);
        return (
          <div 
            key={tab.key}
            onClick={() => navigate(tab.key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: isActive ? 'var(--color-gold)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              flex: 1,
              height: '100%'
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{tab.icon}</div>
            <div style={{ fontSize: '10px' }}>{tab.label}</div>
          </div>
        );
      })}
    </div>
  );
}
`;

files['components/common/PageHeader.jsx'] = `
import React from 'react';
import { Button } from 'antd';
export default function PageHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <h2 style={{ margin: 0, color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>{title}</h2>
      {action && <div>{action}</div>}
    </div>
  );
}
`;

files['components/common/StatCard.jsx'] = `
import React from 'react';
import { Card } from 'antd';
export default function StatCard({ title, value, prefix, suffix, trend }) {
  return (
    <Card bordered={false} style={{ height: '100%' }}>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
        {prefix}{value}{suffix}
      </div>
      {trend && <div style={{ marginTop: 8, color: trend > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
        {trend > 0 ? '+' : ''}{trend}%
      </div>}
    </Card>
  );
}
`;

const simplePages = [
  'pages/auth/Login.jsx',
  'pages/auth/Register.jsx',
  'pages/dashboard/Dashboard.jsx',
  'pages/inventory/RawMaterials.jsx',
  'pages/inventory/PackagingMaterials.jsx',
  'pages/inventory/FinishedGoods.jsx',
  'pages/purchasing/Suppliers.jsx',
  'pages/purchasing/PurchaseOrders.jsx',
  'pages/manufacturing/Formulas.jsx',
  'pages/manufacturing/ProductionOrders.jsx',
  'pages/sales/Customers.jsx',
  'pages/sales/SalesOrders.jsx',
  'pages/finance/ChartOfAccounts.jsx',
  'pages/finance/JournalEntries.jsx',
  'pages/finance/Payments.jsx',
  'pages/finance/Expenses.jsx',
  'pages/finance/AccountsPayable.jsx',
  'pages/finance/AccountsReceivable.jsx',
  'pages/inventory/RawMaterialDetail.jsx',
  'pages/purchasing/SupplierDetail.jsx',
  'pages/purchasing/PurchaseOrderForm.jsx',
  'pages/manufacturing/FormulaBuilder.jsx',
  'pages/manufacturing/ProductionOrderDetail.jsx',
  'pages/sales/SalesOrderForm.jsx',
  'pages/sales/Invoice.jsx',
  'pages/finance/JournalEntryForm.jsx',
  'pages/finance/PaymentForm.jsx',
  'pages/finance/ExpenseForm.jsx',
  'pages/reports/ProfitAndLoss.jsx',
  'pages/reports/BalanceSheet.jsx',
  'pages/reports/TrialBalance.jsx',
  'pages/reports/StockReport.jsx',
  'pages/settings/CompanySettings.jsx',
];

simplePages.forEach(p => {
  const compName = p.split('/').pop().replace('.jsx', '');
  files[p] = `
import React from 'react';
import { Card, Table, Button } from 'antd';
import PageHeader from '../../components/common/PageHeader';

export default function ${compName}() {
  return (
    <div>
      <PageHeader title="${compName}" action={<Button type="primary">Add New</Button>} />
      <Card>
        <p>This is the ${compName} page. Use mock data here for now.</p>
        <Table dataSource={[]} columns={[{ title: 'Name', dataIndex: 'name' }]} />
      </Card>
    </div>
  );
}
`;
});

// Overwrite Login page
files['pages/auth/Login.jsx'] = `
import React, { useContext } from 'react';
import { Card, Form, Input, Button } from 'antd';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    await login(values.email, values.password);
    navigate('/app/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)' }}>
      <Card style={{ width: '100%', maxWidth: 400, margin: 24 }}>
        <h1 style={{ textAlign: 'center', marginBottom: 24 }}>Perfume ERP</h1>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block style={{ background: 'var(--color-gold)', borderColor: 'var(--color-gold)' }}>
            Sign In
          </Button>
        </Form>
      </Card>
    </div>
  );
}
`;

files['App.jsx'] = `
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/dashboard/Dashboard';
import RawMaterials from './pages/inventory/RawMaterials';
import PackagingMaterials from './pages/inventory/PackagingMaterials';
import FinishedGoods from './pages/inventory/FinishedGoods';
import Suppliers from './pages/purchasing/Suppliers';
import PurchaseOrders from './pages/purchasing/PurchaseOrders';
import Formulas from './pages/manufacturing/Formulas';
import ProductionOrders from './pages/manufacturing/ProductionOrders';
import Customers from './pages/sales/Customers';
import SalesOrders from './pages/sales/SalesOrders';
import ChartOfAccounts from './pages/finance/ChartOfAccounts';
import JournalEntries from './pages/finance/JournalEntries';
import Payments from './pages/finance/Payments';
import Expenses from './pages/finance/Expenses';
import AccountsPayable from './pages/finance/AccountsPayable';
import AccountsReceivable from './pages/finance/AccountsReceivable';

import RawMaterialDetail from './pages/inventory/RawMaterialDetail';
import SupplierDetail from './pages/purchasing/SupplierDetail';
import PurchaseOrderForm from './pages/purchasing/PurchaseOrderForm';
import FormulaBuilder from './pages/manufacturing/FormulaBuilder';
import ProductionOrderDetail from './pages/manufacturing/ProductionOrderDetail';
import SalesOrderForm from './pages/sales/SalesOrderForm';
import Invoice from './pages/sales/Invoice';
import JournalEntryForm from './pages/finance/JournalEntryForm';
import PaymentForm from './pages/finance/PaymentForm';
import ExpenseForm from './pages/finance/ExpenseForm';

import ProfitAndLoss from './pages/reports/ProfitAndLoss';
import BalanceSheet from './pages/reports/BalanceSheet';
import TrialBalance from './pages/reports/TrialBalance';
import StockReport from './pages/reports/StockReport';

import CompanySettings from './pages/settings/CompanySettings';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        <Route path="raw-materials" element={<RawMaterials />} />
        <Route path="raw-materials/:id" element={<RawMaterialDetail />} />
        <Route path="packaging" element={<PackagingMaterials />} />
        <Route path="finished-goods" element={<FinishedGoods />} />
        
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="suppliers/:id" element={<SupplierDetail />} />
        
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        <Route path="purchase-orders/new" element={<PurchaseOrderForm />} />
        <Route path="purchase-orders/:id" element={<PurchaseOrderForm />} />
        
        <Route path="formulas" element={<Formulas />} />
        <Route path="formulas/new" element={<FormulaBuilder />} />
        <Route path="formulas/:id" element={<FormulaBuilder />} />
        
        <Route path="production" element={<ProductionOrders />} />
        <Route path="production/new" element={<ProductionOrderDetail />} />
        <Route path="production/:id" element={<ProductionOrderDetail />} />
        
        <Route path="customers" element={<Customers />} />
        
        <Route path="sales-orders" element={<SalesOrders />} />
        <Route path="sales-orders/new" element={<SalesOrderForm />} />
        <Route path="sales-orders/:id" element={<SalesOrderForm />} />
        <Route path="sales-orders/:id/invoice" element={<Invoice />} />
        
        <Route path="accounts" element={<ChartOfAccounts />} />
        
        <Route path="journal-entries" element={<JournalEntries />} />
        <Route path="journal-entries/new" element={<JournalEntryForm />} />
        
        <Route path="payables" element={<AccountsPayable />} />
        <Route path="receivables" element={<AccountsReceivable />} />
        
        <Route path="payments" element={<Payments />} />
        <Route path="payments/new" element={<PaymentForm />} />
        
        <Route path="expenses" element={<Expenses />} />
        <Route path="expenses/new" element={<ExpenseForm />} />
        
        <Route path="reports/profit-loss" element={<ProfitAndLoss />} />
        <Route path="reports/balance-sheet" element={<BalanceSheet />} />
        <Route path="reports/trial-balance" element={<TrialBalance />} />
        <Route path="reports/stock" element={<StockReport />} />
        
        <Route path="settings" element={<CompanySettings />} />
      </Route>
    </Routes>
  );
}
`;

files['main.jsx'] = `
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import App from './App';
import './styles/design-system.css';
import './styles/global.css';
import { antdTheme } from './theme/antdTheme';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider theme={antdTheme}>
        <NotificationProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </NotificationProvider>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
`;

for (const [filepath, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(srcDir, filepath), content.trim() + '\\n');
}

const htmlPath = path.join(clientDir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace('<title>Vite + React</title>', '<title>Perfume ERP</title>\\n    <link rel="preconnect" href="https://fonts.googleapis.com">\\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\\n    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet">');
fs.writeFileSync(htmlPath, html);

console.log('Setup complete!');
