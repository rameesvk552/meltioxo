import React from 'react';
import { Table, Card, Row, Col, Statistic, Tag, Button, Space, Typography } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Title } = Typography;

const Suppliers = () => {
  const suppliers = [
    { id: 1, name: 'Aromatic Essentials Pvt Ltd', contact: 'Rahul Sharma', email: 'rahul@aromatic.in', phone: '+91 9876543210', terms: 'Net 30', outstanding: 125000, creditLimit: 500000, status: 'Active' },
    { id: 2, name: 'Gulf Fragrance Trading LLC', contact: 'Ahmed Al-Fayed', email: 'ahmed@gulffragrance.ae', phone: '+971 501234567', terms: 'Net 60', outstanding: 450000, creditLimit: 1000000, status: 'Active' },
    { id: 3, name: 'Kerala Spices & Extracts', contact: 'Anjali Menon', email: 'sales@keralaspices.in', phone: '+91 9988776655', terms: 'Net 15', outstanding: 50000, creditLimit: 200000, status: 'Active' },
    { id: 4, name: 'French Perfumery Supply', contact: 'Jean-Paul', email: 'jp@frenchperfumery.fr', phone: '+33 123456789', terms: 'Net 45', outstanding: 0, creditLimit: 800000, status: 'Inactive' },
    { id: 5, name: 'Global Glassworks', contact: 'Vikram Singh', email: 'vikram@globalglass.com', phone: '+91 9123456789', terms: 'Net 30', outstanding: 220000, creditLimit: 500000, status: 'Active' },
    { id: 6, name: 'Luxe Packaging Solutions', contact: 'Priya Patel', email: 'priya@luxepack.in', phone: '+91 9876512345', terms: 'Net 30', outstanding: 0, creditLimit: 300000, status: 'Active' },
    { id: 7, name: 'Oud Masters Intl', contact: 'Omar', email: 'omar@oudmasters.com', phone: '+971 551122334', terms: 'Net 60', outstanding: 850000, creditLimit: 1500000, status: 'Active' },
    { id: 8, name: 'Floral Extracts Co.', contact: 'Ritu', email: 'ritu@floralextracts.in', phone: '+91 9988112233', terms: 'Net 15', outstanding: 15000, creditLimit: 100000, status: 'Active' },
    { id: 9, name: 'Mumbai Chemicals', contact: 'Sanjay', email: 'sanjay@mumbaichem.com', phone: '+91 9123498765', terms: 'Net 30', outstanding: 0, creditLimit: 400000, status: 'Inactive' },
    { id: 10, name: 'Premium Caps & Sprayers', contact: 'Neha', email: 'neha@premiumcaps.in', phone: '+91 9876123456', terms: 'Net 30', outstanding: 45000, creditLimit: 250000, status: 'Active' },
  ];

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (text, record) => <Link to={`/purchasing/suppliers/${record.id}`} style={{ color: 'var(--color-primary)' }}>{text}</Link> },
    { title: 'Contact Person', dataIndex: 'contact', key: 'contact' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { title: 'Payment Terms', dataIndex: 'terms', key: 'terms' },
    { title: 'Outstanding (₹)', dataIndex: 'outstanding', key: 'outstanding', render: val => <span style={{ color: val > 0 ? '#ef4444' : '#22c55e' }}>₹{val.toLocaleString()}</span> },
    { title: 'Credit Limit (₹)', dataIndex: 'creditLimit', key: 'creditLimit', render: val => `₹${val.toLocaleString()}` },
    { title: 'Status', dataIndex: 'status', key: 'status', render: status => <Tag color={status === 'Active' ? 'green' : 'default'}>{status}</Tag> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Link to={`/purchasing/suppliers/${record.id}`}><Button type="text" icon={<EyeOutlined />} style={{ color: '#d4a853' }} /></Link>
          <Button type="text" icon={<EditOutlined />} style={{ color: '#60a5fa' }} />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2} style={{ color: '#d4a853', margin: 0, fontFamily: 'Playfair Display' }}>Suppliers</Title>
        <Button type="primary" icon={<PlusOutlined />} style={{ backgroundColor: '#d4a853', borderColor: '#d4a853', color: '#0f1729' }}>Add Supplier</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Total Suppliers" value={12} valueStyle={{ color: '#d4a853' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Active Suppliers" value={10} valueStyle={{ color: '#22c55e' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Outstanding Payable" value={845000} prefix="₹" valueStyle={{ color: '#ef4444' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <Statistic title="Credit Limit Used" value={65} suffix="%" valueStyle={{ color: '#f59e0b' }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <Table 
          columns={columns} 
          dataSource={suppliers} 
          rowKey="id" 
          pagination={{ pageSize: 10 }} 
          scroll={{ x: 'max-content' }}
          className="dark-theme-table"
        />
      </Card>
    </div>
  );
};

export default Suppliers;
