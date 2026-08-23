import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import AppLayout from './components/layout/AppLayout';
import { AuthContext } from './context/AuthContext';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/dashboard/Dashboard';
import RawMaterials from './pages/inventory/RawMaterials';
import PackagingMaterials from './pages/inventory/PackagingMaterials';
import FinishedGoods from './pages/inventory/ProductsAndVariants';
import Suppliers from './pages/purchasing/Suppliers';
import Purchases from './pages/purchasing/Purchases';
import Formulas from './pages/manufacturing/Formulas';
import ProductionOrders from './pages/manufacturing/ProductionOrders';
import Customers from './pages/sales/Customers';
import SalesOrders from './pages/sales/SalesOrders';
import DayRegister from './pages/sales/DayRegister';
import AccountsWorkspace from './pages/finance/AccountsWorkspace';
import JournalEntries from './pages/finance/JournalEntries';
import Payments from './pages/finance/Payments';
import Expenses from './pages/finance/Expenses';
import AccountsPayable from './pages/finance/AccountsPayable';
import AccountsReceivable from './pages/finance/AccountsReceivable';

import RawMaterialDetail from './pages/inventory/RawMaterialDetail';
import SupplierDetail from './pages/purchasing/SupplierDetail';
import FormulaBuilder from './pages/manufacturing/FormulaBuilder';
import ProductionOrderDetail from './pages/manufacturing/ProductionOrderDetail';
import SalesOrderForm from './pages/sales/SalesOrderPOS';
import RetailSaleDetail from './pages/sales/RetailSaleDetail';
import RetailSaleInvoice from './pages/sales/RetailSaleInvoice';
import JournalEntryForm from './pages/finance/JournalEntryForm';
import PaymentForm from './pages/finance/PaymentForm';
import ExpenseForm from './pages/finance/ExpenseForm';

import ProfitAndLoss from './pages/reports/OwnerProfitAndLoss';
import BalanceSheet from './pages/reports/BalanceSheet';
import TrialBalance from './pages/reports/TrialBalance';
import StockReport from './pages/reports/StockReport';
import ProductionOwnerReport from './pages/reports/ProductionOwnerReport';

import CompanySettings from './pages/settings/CompanySettings';

import { useParams } from 'react-router-dom';

function RedirectToRawMaterialDetail() {
  const { id } = useParams();
  return <Navigate to={`/app/raw-materials/${id}`} replace />;
}

function ProtectedApp() {
  const { isAuthenticated, loading } = useContext(AuthContext);
  if (loading) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>;
  return isAuthenticated ? <AppLayout /> : <Navigate to="/login" replace />;
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
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        <Route path="raw-materials" element={<RawMaterials />} />
        <Route path="raw-materials/:id" element={<RawMaterialDetail />} />
        <Route path="packaging" element={<PackagingMaterials />} />
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
        <Route path="reports/balance-sheet" element={<BalanceSheet />} />
        <Route path="reports/trial-balance" element={<TrialBalance />} />
        <Route path="reports/stock" element={<StockReport />} />
        <Route path="reports/production" element={<ProductionOwnerReport />} />
        
        <Route path="settings" element={<CompanySettings />} />
      </Route>
    </Routes>
  );
}
