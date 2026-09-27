import React, { useState } from 'react';
import { Layout, Drawer } from 'antd';
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
  const { data: tenant } = useApiData('/tenant/settings', { initialData: {} });

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
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--color-border)' }}>
          <WayonLogo compact={collapsed} textOnly={!collapsed} size={collapsed ? 38 : 36} logoUrl={tenant.logo_url} companyName={tenant.name} />
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
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--color-border)' }}>
          <WayonLogo textOnly size={36} logoUrl={tenant.logo_url} companyName={tenant.name} />
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
          <Outlet />
        </Content>
      </Layout>
      <MobileBottomNav />
    </Layout>
    </PageTitleProvider>
  );
}
