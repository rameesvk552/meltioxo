import React, { useState } from 'react';
import { Table, Card, Row, Col, Statistic, Tag, Button, Space, Typography, Tabs } from 'antd';
import { PlusOutlined, EyeOutlined, PlayCircleOutlined, CheckSquareOutlined, StopOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Title } = Typography;
const { TabPane } = Tabs;

const ProductionOrders = () => {
  const [activeTab, setActiveTab] = useState('All');

  const orders = [
    { id: 'PROD-2024-101', formula: 'Royal Oud (FORM-001)', batch: 'B-RO-2401', plannedQty: 1000, actualQty: 0, status: 'Planned', plannedDate: '2024-02-10', completeDate: '-' },
    { id: 'PROD-2024-102', formula: 'Midnight Rose (FORM-002)', batch: 'B-MR-2401', plannedQty: 500, actualQty: 500, status: 'Completed', plannedDate: '2024-01-25', completeDate: '2024-01-28' },
    { id: 'PROD-2024-103', formula: 'Citrus Breeze (FORM-003)', batch: 'B-CB-2402', plannedQty: 2000, actualQty: 0, status: 'In Progress', plannedDate: '2024-02-01', completeDate: '-' },
    { id: 'PROD-2024-104', formula: 'Vanilla Essence (FORM-006)', batch: 'B-VE-2401', plannedQty: 800, actualQty: 810, status: 'Completed', plannedDate: '2024-01-15', completeDate: '2024-01-18' },
    { id: 'PROD-2024-105', formula: 'Aqua Marine (FORM-007)', batch: 'B-AM-2403', plannedQty: 1500, actualQty: 0, status: 'Planned', plannedDate: '2024-02-15', completeDate: '-' },
    { id: 'PROD-2024-106', formula: 'Sandalwood Dreams (FORM-005)', batch: 'B-SD-2401', plannedQty: 1200, actualQty: 0, status: 'In Progress', plannedDate: '2024-02-05', completeDate: '-' },
    { id: 'PROD-2024-107', formula: 'Jasmine Noir (FORM-008)', batch: 'B-JN-2402', plannedQty: 600, actualQty: 595, status: 'Completed', plannedDate: '2024-01-20', completeDate: '2024-01-22' },
    { id: 'PROD-2024-108', formula: 'Royal Oud (FORM-001)', batch: 'B-RO-2402', plannedQty: 1000, actualQty: 1005, status: 'Completed', plannedDate: '2024-01-10', completeDate: '2024-01-14' },
    { id: 'PROD-2024-109', formula: 'Bergamot Fresh (FORM-010)', batch: 'B-BF-2401', plannedQty: 2000, actualQty: 0, status: 'Planned', plannedDate: '2024-02-20', completeDate: '-' },
    { id: 'PROD-2024-110', formula: 'Midnight Rose (FORM-002)', batch: 'B-MR-2402', plannedQty: 500, actualQty: 0, status: 'In Progress', plannedDate: '2024-02-08', completeDate: '-' },
    { id: 'PROD-2024-111', formula: 'Citrus Breeze (FORM-003)', batch: 'B-CB-2401', plannedQty: 1000, actualQty: 1000, status: 'Completed', plannedDate: '2024-01-05', completeDate: '2024-01-08' },
    { id: 'PROD-2024-112', formula: 'Aqua Marine (FORM-007)', batch: 'B-AM-2404', plannedQty: 1500, actualQty: 0, status: 'Planned', plannedDate: '2024-02-25', completeDate: '-' },
  ];

  const filteredOrders = activeTab === 'All' ? orders : orders.filter(o => o.status === activeTab);

  const getStatusTag = (status) => {
    switch(status) {
      case 'Planned': return <Tag color="default">Planned</Tag>;
      case 'In Progress': return <Tag color="blue">In Progress</Tag>;
      case 'Completed': return <Tag color="green">Completed</Tag>;
      case 'Cancelled': return <Tag color="red">Cancelled</Tag>;
      default: return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    { title: 'Order#', dataIndex: 'id', key: 'id', render: (text, rec) => <Link to={`/manufacturing/production/${rec.id}`} style={{ color: '#d4a853', fontWeight: 500 }}>{text}</Link> },
    { title: 'Formula', dataIndex: 'formula', key: 'formula' },
    { title: 'Batch#', dataIndex: 'batch', key: 'batch' },
    { title: 'Planned Qty', dataIndex: 'plannedQty', key: 'plannedQty' },
    { title: 'Actual Qty', dataIndex: 'actualQty', key: 'actualQty' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: getStatusTag },
    { title: 'Planned Date', dataIndex: 'plannedDate', key: 'plannedDate' },
    { title: 'Completion Date', dataIndex: 'completeDate', key: 'completeDate' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Link to={`/manufacturing/production/${record.id}`}><Button type="text" icon={<EyeOutlined />} style={{ color: '#d4a853' }} title="View" /></Link>
          {record.status === 'Planned' && <Button type="text" icon={<PlayCircleOutlined />} style={{ color: '#3b82f6' }} title="Start" />}
          {record.status === 'In Progress' && <Button type="text" icon={<CheckSquareOutlined />} style={{ color: '#22c55e' }} title="Complete" />}
          {(record.status === 'Planned' || record.status === 'In Progress') && <Button type="text" icon={<StopOutlined />} style={{ color: '#ef4444' }} title="Cancel" />}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2} style={{ color: '#d4a853', margin: 0, fontFamily: 'Playfair Display' }}>Production Orders</Title>
        <Button type="primary" icon={<PlusOutlined />} style={{ backgroundColor: '#d4a853', borderColor: '#d4a853', color: '#0f1729' }}>New Order</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Total Orders" value={22} valueStyle={{ color: '#d4a853' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Planned" value={4} valueStyle={{ color: '#94a3b8' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="In Progress" value={3} valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Completed" value={15} valueStyle={{ color: '#22c55e' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Cancelled" value={0} valueStyle={{ color: '#ef4444' }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} className="custom-tabs">
          <TabPane tab="All" key="All" />
          <TabPane tab="Planned" key="Planned" />
          <TabPane tab="In Progress" key="In Progress" />
          <TabPane tab="Completed" key="Completed" />
          <TabPane tab="Cancelled" key="Cancelled" />
        </Tabs>
        
        <Table 
          columns={columns} 
          dataSource={filteredOrders} 
          rowKey="id" 
          pagination={{ pageSize: 10 }} 
          scroll={{ x: 'max-content' }}
          className="dark-theme-table"
        />
      </Card>
    </div>
  );
};

export default ProductionOrders;
