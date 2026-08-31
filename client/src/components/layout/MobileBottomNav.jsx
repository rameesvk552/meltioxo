import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { DashboardOutlined, AppstoreOutlined, ToolOutlined, DollarOutlined, EllipsisOutlined } from '@ant-design/icons';
import { AuthContext } from '../../context/AuthContext';
import { getViewPermissionsForPath, hasAnyViewPermission } from '../../config/permissions';

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);

  const tabs = [
    { key: '/app/dashboard', icon: <DashboardOutlined />, label: 'Dash' },
    { key: '/app/raw-materials', icon: <AppstoreOutlined />, label: 'Inv' },
    { key: '/app/production', icon: <ToolOutlined />, label: 'Prod' },
    { key: '/app/retail-sales', icon: <DollarOutlined />, label: 'Sales' },
    { key: '/app/settings', icon: <EllipsisOutlined />, label: 'More' },
  ].filter(tab => hasAnyViewPermission(user, getViewPermissionsForPath(tab.key)));

  if (!tabs.length) return null;

  return (
    <div className="mobile-only mobile-bottom-nav" style={{
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
