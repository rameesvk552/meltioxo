import React, { useContext } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Result, Spin } from 'antd';
import AppLayout from './components/layout/AppLayout';
import { AuthContext } from './context/AuthContext';
import { getFirstAllowedPath, getViewPermissionsForPath, hasAnyViewPermission } from './config/permissions';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

const Dashboard = React.lazy(() => import('./pages/dashboard/Dashboard'));
const RawMaterials = React.lazy(() => import('./pages/inventory/RawMaterials'));
const PackagingMaterials = React.lazy(() => import('./pages/inventory/PackagingMaterials'));
const PackingKits = React.lazy(() => import('./pages/inventory/PackingKits'));
const FinishedGoods = React.lazy(() => import('./pages/inventory/ProductsAndVariants'));
const Suppliers = React.lazy(() => import('./pages/purchasing/Suppliers'));
const Purchases = React.lazy(() => import('./pages/purchasing/Purchases'));
const Formulas = React.lazy(() => import('./pages/manufacturing/Formulas'));
const ProductionOrders = React.lazy(() => import('./pages/manufacturing/ProductionOrders'));
const Customers = React.lazy(() => import('./pages/sales/Customers'));
const SalesOrders = React.lazy(() => import('./pages/sales/SalesOrders'));
const DayRegister = React.lazy(() => import('./pages/sales/DayRegister'));
const AccountsWorkspace = React.lazy(() => import('./pages/finance/AccountsWorkspace'));
const JournalEntries = React.lazy(() => import('./pages/finance/JournalEntries'));
const Payments = React.lazy(() => import('./pages/finance/Payments'));
const Expenses = React.lazy(() => import('./pages/finance/Expenses'));
const AccountsPayable = React.lazy(() => import('./pages/finance/AccountsPayable'));
const AccountsReceivable = React.lazy(() => import('./pages/finance/AccountsReceivable'));
const RawMaterialDetail = React.lazy(() => import('./pages/inventory/RawMaterialDetail'));
const SupplierDetail = React.lazy(() => import('./pages/purchasing/SupplierDetail'));
const FormulaBuilder = React.lazy(() => import('./pages/manufacturing/FormulaBuilder'));
const ProductionOrderDetail = React.lazy(() => import('./pages/manufacturing/ProductionOrderDetail'));
const SalesOrderForm = React.lazy(() => import('./pages/sales/SalesOrderPOS'));
const RetailSaleDetail = React.lazy(() => import('./pages/sales/RetailSaleDetail'));
const RetailSaleInvoice = React.lazy(() => import('./pages/sales/RetailSaleInvoice'));
const JournalEntryForm = React.lazy(() => import('./pages/finance/JournalEntryForm'));
const PaymentForm = React.lazy(() => import('./pages/finance/PaymentForm'));
const ExpenseForm = React.lazy(() => import('./pages/finance/ExpenseForm'));
const ProfitAndLoss = React.lazy(() => import('./pages/reports/PureProfitAndLoss'));
const SalesProfitReport = React.lazy(() => import('./pages/reports/OwnerProfitAndLoss'));
const BalanceSheet = React.lazy(() => import('./pages/reports/BalanceSheet'));
const ManagementReport = React.lazy(() => import('./pages/reports/ManagementReport'));
const CashMovements = React.lazy(() => import('./pages/reports/CashMovements'));
const TrialBalance = React.lazy(() => import('./pages/reports/TrialBalance'));
const StockReport = React.lazy(() => import('./pages/reports/StockReport'));
const ProductionOwnerReport = React.lazy(() => import('./pages/reports/ProductionOwnerReport'));
const AuditLog = React.lazy(() => import('./pages/reports/AuditLog'));
const WhatsAppInvoiceReport = React.lazy(() => import('./pages/reports/WhatsAppInvoiceReport'));
const CompanySettings = React.lazy(() => import('./pages/settings/CompanySettings'));

import { useParams } from 'react-router-dom';

function RedirectToRawMaterialDetail() {
  const { id } = useParams();
  return <Navigate to={`/app/raw-materials/${id}`} replace />;
}

function ProtectedApp() {
  const { isAuthenticated, loading, user } = useContext(AuthContext);
  const location = useLocation();
  if (loading) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const requiredPermissions = getViewPermissionsForPath(location.pathname);
  if (requiredPermissions.length && !hasAnyViewPermission(user, requiredPermissions)) {
    return <Navigate to="/app" replace />;
  }
  return <AppLayout />;
}

function AppLanding() {
  const { user } = useContext(AuthContext);
  const destination = getFirstAllowedPath(user);
  return destination
    ? <Navigate to={destination} replace />
    : <Result status="403" title="No views assigned" subTitle="Ask an administrator to assign at least one view permission to your account." />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      <Route path="/inventory/raw-materials" element={<Navigate to="/app/raw-materials" replace />} />
      <Route path="/inventory/raw-materials/:id" element={<RedirectToRawMaterialDetail />} />
      
      <Route path="/app" element={<ProtectedApp />}>
        <Route index element={<AppLanding />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        <Route path="raw-materials" element={<RawMaterials />} />
        <Route path="raw-materials/:id" element={<RawMaterialDetail />} />
        <Route path="packaging" element={<PackagingMaterials />} />
        <Route path="packing-kits" element={<PackingKits />} />
        <Route path="finished-goods" element={<FinishedGoods />} />
        
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="suppliers/:id" element={<SupplierDetail />} />
        
        <Route path="purchases" element={<Purchases />} />
        <Route path="direct-purchases" element={<Navigate to="/app/purchases" replace />} />
        
        <Route path="formulas" element={<Formulas />} />
        <Route path="formulas/new" element={<FormulaBuilder />} />
        <Route path="formulas/:id" element={<FormulaBuilder />} />
        
        <Route path="production" element={<ProductionOrders />} />
        <Route path="production/new" element={<ProductionOrderDetail />} />
        <Route path="production/:id" element={<ProductionOrderDetail />} />
        
        <Route path="customers" element={<Customers />} />
        
        <Route path="retail-sales" element={<SalesOrders />} />
        <Route path="day-register" element={<DayRegister />} />
        <Route path="retail-sales/new" element={<SalesOrderForm />} />
        <Route path="retail-sales/:id/edit" element={<SalesOrderForm />} />
        <Route path="retail-sales/:id/invoice" element={<RetailSaleInvoice />} />
        <Route path="retail-sales/:id" element={<RetailSaleDetail />} />
        
        <Route path="accounts" element={<AccountsWorkspace />} />
        
        <Route path="journal-entries" element={<JournalEntries />} />
        <Route path="journal-entries/new" element={<JournalEntryForm />} />
        
        <Route path="payables" element={<AccountsPayable />} />
        <Route path="receivables" element={<AccountsReceivable />} />
        
        <Route path="payments" element={<Payments />} />
        <Route path="payments/new" element={<PaymentForm />} />
        
        <Route path="expenses" element={<Expenses />} />
        <Route path="expenses/new" element={<ExpenseForm />} />
        
        <Route path="reports/profit-loss" element={<ProfitAndLoss />} />
        <Route path="reports/sales-profit" element={<SalesProfitReport />} />
        <Route path="reports/balance-sheet" element={<BalanceSheet />} />
        <Route path="reports/management" element={<ManagementReport />} />
        <Route path="reports/cash-bank" element={<CashMovements />} />
        <Route path="reports/trial-balance" element={<TrialBalance />} />
        <Route path="reports/stock" element={<StockReport />} />
        <Route path="reports/production" element={<ProductionOwnerReport />} />
        <Route path="reports/audit-log" element={<AuditLog />} />
        <Route path="reports/whatsapp-invoices" element={<WhatsAppInvoiceReport />} />
        
        <Route path="settings" element={<CompanySettings />} />
      </Route>
    </Routes>
  );
}
