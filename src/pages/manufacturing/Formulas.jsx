import React from 'react';
import { Table, Card, Row, Col, Statistic, Tag, Button, Space, Typography } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, CopyOutlined, StopOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Title } = Typography;

const Formulas = () => {
  const formulas = [
    { id: 'FORM-001', name: 'Royal Oud', outputQty: 100, unit: 'ml', ingredients: 12, packaging: 3, cost: 1250, version: '1.2', status: 'Active' },
    { id: 'FORM-002', name: 'Midnight Rose', outputQty: 50, unit: 'ml', ingredients: 8, packaging: 2, cost: 450, version: '1.0', status: 'Active' },
    { id: 'FORM-003', name: 'Citrus Breeze', outputQty: 100, unit: 'ml', ingredients: 6, packaging: 3, cost: 280, version: '2.1', status: 'Active' },
    { id: 'FORM-004', name: 'Amber Nights', outputQty: 50, unit: 'ml', ingredients: 15, packaging: 2, cost: 890, version: '1.0', status: 'Inactive' },
    { id: 'FORM-005', name: 'Sandalwood Dreams', outputQty: 200, unit: 'ml', ingredients: 5, packaging: 4, cost: 1500, version: '1.5', status: 'Active' },
    { id: 'FORM-006', name: 'Vanilla Essence', outputQty: 100, unit: 'ml', ingredients: 4, packaging: 2, cost: 150, version: '1.0', status: 'Active' },
    { id: 'FORM-007', name: 'Aqua Marine', outputQty: 150, unit: 'ml', ingredients: 10, packaging: 3, cost: 340, version: '3.0', status: 'Active' },
    { id: 'FORM-008', name: 'Jasmine Noir', outputQty: 50, unit: 'ml', ingredients: 9, packaging: 2, cost: 520, version: '1.1', status: 'Active' },
    { id: 'FORM-009', name: 'Spicy Musk', outputQty: 100, unit: 'ml', ingredients: 14, packaging: 3, cost: 670, version: '1.0', status: 'Inactive' },
    { id: 'FORM-010', name: 'Bergamot Fresh', outputQty: 50, unit: 'ml', ingredients: 7, packaging: 2, cost: 210, version: '2.0', status: 'Active' },
  ];

  const columns = [
    { title: 'Code', dataIndex: 'id', key: 'id', render: text => <span style={{ color: '#d4a853', fontWeight: 500 }}>{text}</span> },
    { title: 'Formula Name', dataIndex: 'name', key: 'name' },
    { title: 'Output', key: 'output', render: (_, record) => `${record.outputQty} ${record.unit}` },
    { title: 'Ingredients', dataIndex: 'ingredients', key: 'ingredients' },
    { title: 'Packaging Items', dataIndex: 'packaging', key: 'packaging' },
    { title: 'Est. Cost/Unit', dataIndex: 'cost', key: 'cost', render: val => `₹${val}` },
    { title: 'Version', dataIndex: 'version', key: 'version', render: val => `v${val}` },
    { title: 'Status', dataIndex: 'status', key: 'status', render: status => <Tag color={status === 'Active' ? 'green' : 'default'}>{status}</Tag> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button type="text" icon={<EyeOutlined />} style={{ color: '#d4a853' }} title="View" />
          <Button type="text" icon={<EditOutlined />} style={{ color: '#60a5fa' }} title="Edit" />
          <Button type="text" icon={<CopyOutlined />} style={{ color: '#22c55e' }} title="Clone" />
          {record.status === 'Active' && <Button type="text" icon={<StopOutlined />} style={{ color: '#ef4444' }} title="Deactivate" />}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2} style={{ color: '#d4a853', margin: 0, fontFamily: 'Playfair Display' }}>Formulas & Recipes</Title>
        <Link to="/manufacturing/formulas/new">
          <Button type="primary" icon={<PlusOutlined />} style={{ backgroundColor: '#d4a853', borderColor: '#d4a853', color: '#0f1729' }}>Create Formula</Button>
        </Link>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Total Formulas" value={15} valueStyle={{ color: '#d4a853' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Active" value={12} valueStyle={{ color: '#22c55e' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Average Cost" value={285} prefix="₹" valueStyle={{ color: '#e2e8f0' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Products Linked" value={18} valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <Table 
          columns={columns} 
          dataSource={formulas} 
          rowKey="id" 
          pagination={{ pageSize: 10 }} 
          scroll={{ x: 'max-content' }}
          className="dark-theme-table"
        />
      </Card>
    </div>
  );
};

export default Formulas;
