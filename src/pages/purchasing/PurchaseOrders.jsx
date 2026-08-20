import React, { useState } from 'react';
import { Table, Card, Row, Col, Statistic, Tag, Button, Space, Typography, Tabs } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Title } = Typography;
const { TabPane } = Tabs;

const PurchaseOrders = () => {
  const [activeTab, setActiveTab] = useState('All');

  const allPOs = [
    { id: 'PO-2024-001', supplier: 'Aromatic Essentials Pvt Ltd', date: '2024-01-10', expected: '2024-01-25', items: 3, amount: 250000, status: 'Completed' },
    { id: 'PO-2024-002', supplier: 'Global Glassworks', date: '2024-01-12', expected: '2024-02-12', items: 1, amount: 120000, status: 'In Transit' },
    { id: 'PO-2024-003', supplier: 'Oud Masters Intl', date: '2024-01-15', expected: '2024-02-28', items: 2, amount: 850000, status: 'Approved' },
    { id: 'PO-2024-004', supplier: 'Premium Caps & Sprayers', date: '2024-01-18', expected: '2024-02-05', items: 4, amount: 95000, status: 'Draft' },
    { id: 'PO-2024-005', supplier: 'Luxe Packaging Solutions', date: '2024-01-20', expected: '2024-02-20', items: 2, amount: 320000, status: 'Approved' },
    { id: 'PO-2024-006', supplier: 'Kerala Spices & Extracts', date: '2024-01-22', expected: '2024-02-07', items: 5, amount: 180000, status: 'Draft' },
    { id: 'PO-2024-007', supplier: 'Gulf Fragrance Trading LLC', date: '2024-01-25', expected: '2024-03-10', items: 8, amount: 1250000, status: 'In Transit' },
    { id: 'PO-2024-008', supplier: 'Aromatic Essentials Pvt Ltd', date: '2024-01-28', expected: '2024-02-15', items: 2, amount: 75000, status: 'Approved' },
    { id: 'PO-2024-009', supplier: 'Global Glassworks', date: '2024-02-01', expected: '2024-03-01', items: 1, amount: 45000, status: 'Draft' },
    { id: 'PO-2024-010', supplier: 'Oud Masters Intl', date: '2024-02-05', expected: '2024-03-20', items: 3, amount: 560000, status: 'In Transit' },
    { id: 'PO-2024-011', supplier: 'Premium Caps & Sprayers', date: '2024-02-08', expected: '2024-02-25', items: 2, amount: 35000, status: 'Approved' },
    { id: 'PO-2024-012', supplier: 'Luxe Packaging Solutions', date: '2024-02-10', expected: '2024-03-10', items: 4, amount: 420000, status: 'Completed' },
    { id: 'PO-2024-013', supplier: 'Kerala Spices & Extracts', date: '2024-02-12', expected: '2024-02-28', items: 1, amount: 80000, status: 'Completed' },
    { id: 'PO-2024-014', supplier: 'Gulf Fragrance Trading LLC', date: '2024-02-15', expected: '2024-04-01', items: 5, amount: 890000, status: 'In Transit' },
    { id: 'PO-2024-015', supplier: 'Aromatic Essentials Pvt Ltd', date: '2024-02-18', expected: '2024-03-05', items: 3, amount: 145000, status: 'Approved' },
  ];

  const filteredPOs = activeTab === 'All' ? allPOs : allPOs.filter(po => po.status === activeTab);

  const getStatusTag = (status) => {
    switch(status) {
      case 'Draft': return <Tag color="default">Draft</Tag>;
      case 'Approved': return <Tag color="blue">Approved</Tag>;
      case 'In Transit': return <Tag color="orange">In Transit</Tag>;
      case 'Completed': return <Tag color="green">Completed</Tag>;
      case 'Cancelled': return <Tag color="red">Cancelled</Tag>;
      default: return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    { title: 'PO#', dataIndex: 'id', key: 'id', render: text => <span style={{ color: '#d4a853', fontWeight: 500 }}>{text}</span> },
    { title: 'Supplier', dataIndex: 'supplier', key: 'supplier' },
    { title: 'Order Date', dataIndex: 'date', key: 'date' },
    { title: 'Expected Date', dataIndex: 'expected', key: 'expected' },
    { title: 'Items', dataIndex: 'items', key: 'items' },
    { title: 'Total Amount', dataIndex: 'amount', key: 'amount', render: val => `₹${val.toLocaleString()}` },
    { title: 'Status', dataIndex: 'status', key: 'status', render: getStatusTag },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button type="text" icon={<EyeOutlined />} style={{ color: '#d4a853' }} title="View" />
          {record.status === 'Draft' && <Button type="text" icon={<CheckCircleOutlined />} style={{ color: '#22c55e' }} title="Approve" />}
          {record.status === 'In Transit' && <Button type="text" icon={<DownloadOutlined />} style={{ color: '#3b82f6' }} title="Receive" />}
          {(record.status === 'Draft' || record.status === 'Approved') && <Button type="text" icon={<CloseCircleOutlined />} style={{ color: '#ef4444' }} title="Cancel" />}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2} style={{ color: '#d4a853', margin: 0, fontFamily: 'Playfair Display' }}>Purchase Orders</Title>
        <Link to="/purchasing/purchase-orders/new">
          <Button type="primary" icon={<PlusOutlined />} style={{ backgroundColor: '#d4a853', borderColor: '#d4a853', color: '#0f1729' }}>Create PO</Button>
        </Link>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Total POs" value={28} valueStyle={{ color: '#d4a853' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Draft" value={3} valueStyle={{ color: '#94a3b8' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Approved" value={5} valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="In Transit" value={4} valueStyle={{ color: '#f59e0b' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Completed" value={16} valueStyle={{ color: '#22c55e' }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} className="custom-tabs">
          <TabPane tab="All" key="All" />
          <TabPane tab="Draft" key="Draft" />
          <TabPane tab="Approved" key="Approved" />
          <TabPane tab="In Transit" key="In Transit" />
          <TabPane tab="Completed" key="Completed" />
          <TabPane tab="Cancelled" key="Cancelled" />
        </Tabs>
        
        <Table 
          columns={columns} 
          dataSource={filteredPOs} 
          rowKey="id" 
          pagination={{ pageSize: 10 }} 
          scroll={{ x: 'max-content' }}
          className="dark-theme-table"
        />
      </Card>
    </div>
  );
};

export default PurchaseOrders;
