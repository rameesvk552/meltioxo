import React, { useContext, useMemo, useState } from 'react';
import { Layout, Button, Badge, Avatar, Dropdown, Input, Tooltip, Typography, Select } from 'antd';
import { 
  MenuUnfoldOutlined, 
  MenuFoldOutlined, 
  BellOutlined, 
  UserOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageTitle } from '../../context/PageTitleContext';
import { AuthContext } from '../../context/AuthContext';
import {
  getFirstAllowedPath,
  getViewPermissionsForPath,
  hasAnyViewPermission,
  hasViewPermission,
} from '../../config/permissions';

const { Header: AntHeader } = Layout;
const { Title } = Typography;

export default function Header({ collapsed, setCollapsed, setMobileDrawerOpen }) {
  const { title } = usePageTitle();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, branches, branchId, selectBranch } = useContext(AuthContext);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const pageTitle = useMemo(() => {
    const path = location.pathname;
    const titles = [
      ['/app/dashboard', 'Dashboard'], ['/app/raw-materials', 'Raw Materials'],
      ['/app/packaging', 'Packaging Materials'], ['/app/finished-goods', 'Finished Goods'],
      ['/app/suppliers', 'Suppliers'], ['/app/purchases', 'Purchases'],
      ['/app/direct-purchases', 'Purchases'], ['/app/formulas', 'Formulas'],
      ['/app/production', 'Production Orders'], ['/app/customers', 'Customers'],
      ['/app/retail-sales/new', 'POS'], ['/app/retail-sales', 'Sales & Invoices'], ['/app/day-register', 'Day Register'], ['/app/accounts', 'Accounts'],
      ['/app/journal-entries', 'Journal Entries'], ['/app/payables', 'Accounts Payable'],
      ['/app/receivables', 'Accounts Receivable'], ['/app/payments', 'Payments'],
      ['/app/expenses', 'Expenses'], ['/app/reports/profit-loss', 'Profit & Loss'],
      ['/app/reports/sales-profit', 'Daily Sales & Profit'],
      ['/app/reports/balance-sheet', 'Balance Sheet'], ['/app/reports/trial-balance', 'Trial Balance'],
      ['/app/reports/stock', 'Stock Valuation'], ['/app/settings', 'Company Settings']
    ];
    const match = titles.find(([route]) => path === route || path.startsWith(`${route}/`));
    // Route names must win here: some pages set a contextual title, but that
    // state can remain briefly after navigation and must not label the next page.
    return match?.[1] || title || 'Wayon';
  }, [location.pathname, title]);

  const goBack = () => {
    const detailParents = [
      '/app/raw-materials', '/app/suppliers', '/app/purchases',
      '/app/formulas', '/app/production', '/app/retail-sales',
      '/app/journal-entries', '/app/payments', '/app/expenses'
    ];
    const parentPath = detailParents.find((route) => location.pathname.startsWith(`${route}/`));
    if (parentPath && hasAnyViewPermission(user, getViewPermissionsForPath(parentPath))) {
      navigate(parentPath);
      return;
    }
    navigate(getFirstAllowedPath(user) || '/app');
  };

  const handleAccountMenu = async ({ key }) => {
    if ((key === 'settings' || key === 'profile') && hasViewPermission(user, 'settings')) {
      navigate('/app/settings');
      return;
    }
    if (key !== 'logout' || loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <AntHeader className="app-header" style={{ 
      padding: '0 24px', 
      background: 'var(--color-bg-secondary)', 
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
        <Tooltip title="Back">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={goBack}
            className="mobile-only mobile-back-button"
            aria-label="Go back"
          />
        </Tooltip>
        {pageTitle && (
          <Title level={4} style={{ 
            margin: 0, 
            color: 'var(--color-gold)', 
            fontFamily: 'Playfair Display', 
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 280
          }}>
            {pageTitle}
          </Title>
        )}
      </div>

      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {branches?.length > 0 && (
          <Select
            size="small"
            value={branchId || branches.find(item => item.is_default)?.id}
            onChange={selectBranch}
            options={branches.map(item => ({ value: item.id, label: item.name }))}
            style={{ minWidth: 150 }}
            aria-label="Current branch"
          />
        )}
        <div className="mobile-only mobile-header-search">
          {searchOpen ? (
            <Input
              autoFocus
              size="small"
              placeholder="Search this page"
              suffix={<CloseOutlined onClick={() => setSearchOpen(false)} />}
              aria-label="Search this page"
            />
          ) : (
            <Tooltip title="Search">
              <Button type="text" icon={<SearchOutlined />} onClick={() => setSearchOpen(true)} aria-label="Search this page" />
            </Tooltip>
          )}
        </div>
        <Badge count={5} size="small">
          <BellOutlined style={{ fontSize: '20px', color: 'var(--color-text-primary)', cursor: 'pointer' }} />
        </Badge>
        <Dropdown menu={{ onClick: handleAccountMenu, items: [
          ...(hasViewPermission(user, 'settings') ? [
            { key: 'profile', label: 'Profile' },
            { key: 'settings', label: 'Settings' },
            { type: 'divider' },
          ] : []),
          { key: 'logout', label: loggingOut ? 'Signing out…' : 'Logout', disabled: loggingOut },
        ]}} trigger={['click']}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: 'var(--color-gold)' }} />
            <span className="desktop-only">{user?.name || 'Admin User'}</span>
          </div>
        </Dropdown>
      </div>
    </AntHeader>
  );
}
