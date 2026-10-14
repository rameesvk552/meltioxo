import React, { Suspense, useEffect, useState } from 'react';
import { Layout, Drawer, Spin } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileBottomNav from './MobileBottomNav';
import { PageTitleProvider } from '../../context/PageTitleContext';
import WayonLogo from '../common/WayonLogo';
import useApiData from '../../hooks/useApiData';

const { Content, Sider } = Layout;

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { data: tenant, reload: reloadTenant } = useApiData('/tenant/settings', { initialData: {} });

  useEffect(() => {
    window.addEventListener('tenant-settings-updated', reloadTenant);
    return () => window.removeEventListener('tenant-settings-updated', reloadTenant);
  }, [reloadTenant]);

  return (
    <PageTitleProvider>
    <Layout className="app-shell" style={{ minHeight: '100vh' }}>
      {/* Desktop Sider */}
      <Sider 
        className="desktop-only app-desktop-sider"
        theme="light"
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        style={{ borderRight: '1px solid var(--color-border)' }}
        width={260}
      >
        <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--color-border)' }}>
          <WayonLogo compact size={72} logoUrl={tenant.logo_url} companyName={tenant.name} />
        </div>
        <Sidebar />
      </Sider>

      {/* Mobile Drawer Sider */}
      <Drawer
        placement="left"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        styles={{ body: { padding: 0 } }}
        size={260}
        className="mobile-only"
      >
        <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--color-border)' }}>
          <WayonLogo compact size={72} logoUrl={tenant.logo_url} companyName={tenant.name} />
        </div>
        <Sidebar onNavigate={() => setMobileDrawerOpen(false)} />
      </Drawer>

      <Layout className="app-main-layout">
        <Header 
          collapsed={collapsed} 
          setCollapsed={setCollapsed}
          mobileDrawerOpen={mobileDrawerOpen}
          setMobileDrawerOpen={setMobileDrawerOpen}
        />
        <Content className="app-content" style={{ overflowY: 'auto' }}>
          <Suspense fallback={<div style={{ minHeight: 240, display: 'grid', placeItems: 'center' }}><Spin tip="Loading page"><div style={{ width: 120, height: 80 }} /></Spin></div>}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
      <MobileBottomNav />
    </Layout>
    </PageTitleProvider>
  );
}
