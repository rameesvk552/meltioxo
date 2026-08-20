import React from 'react';
import { Card, Breadcrumb, Descriptions, Tabs, Table, Tag, Button, Space, message } from 'antd';
import { ArrowLeftOutlined, EditOutlined, PrinterOutlined } from '@ant-design/icons';
import { useNavigate, useParams, Link } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';

export default function SupplierDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: supplierData } = useApiData(`/suppliers/${id}`, { initialData: {} });
  const supplier = {
    ...supplierData,
    contact: supplierData.contact_person || '—',
    terms: `${Number(supplierData.payment_terms || 0)} Days`,
    outstanding: Number(supplierData.outstanding || 0),
    limit: Number(supplierData.credit_limit || 0),
    status: supplierData.is_active === false ? 'Inactive' : 'Active',
    history: (supplierData.purchaseOrders || []).map(item => ({
      key: item.id,
      po: item.po_number,
      date: item.order_date,
      amount: Number(item.total_amount || 0),
      status: item.status,
      received: item.received_date || '—'
    })),
    invoices: [],
    materials: []
  };

  const historyColumns = [
    { title: 'PO#', dataIndex: 'po', key: 'po', render: text => <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{text}</span> },
    { title: 'Order Date', dataIndex: 'date', key: 'date' },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: v => `₹${v.toLocaleString()}` },
    { title: 'Received Date', dataIndex: 'received', key: 'received' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: status => <Tag color={status === 'Completed' ? 'success' : 'processing'}>{status}</Tag> }
  ];

  const invoiceColumns = [
    { title: 'Invoice#', dataIndex: 'invoice', key: 'invoice', render: text => <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{text}</span> },
    { title: 'Invoice Date', dataIndex: 'date', key: 'date' },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: v => `₹${v.toLocaleString()}` },
    { title: 'Paid', dataIndex: 'paid', key: 'paid', align: 'right', render: v => `₹${v.toLocaleString()}` },
    { title: 'Balance', dataIndex: 'balance', key: 'balance', align: 'right', render: v => <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>₹{v.toLocaleString()}</span> },
    { title: 'Due Date', dataIndex: 'due', key: 'due' }
  ];

  const materialColumns = [
    { title: 'Material Name', dataIndex: 'name', key: 'name', render: text => <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{text}</span> },
    { title: 'Type', dataIndex: 'type', key: 'type', render: t => <Tag color="cyan">{t}</Tag> },
    { title: 'Unit Price', dataIndex: 'price', key: 'price', align: 'right', render: v => `₹${v.toLocaleString()}/kg` },
    { title: 'Lead Time', dataIndex: 'leadTime', key: 'leadTime' }
  ];

  const tabItems = [
    {
      key: '1',
      label: 'Purchase History',
      children: <Table dataSource={supplier.history} columns={historyColumns} pagination={false} />
    },
    {
      key: '2',
      label: 'Outstanding Invoices',
      children: <Table dataSource={supplier.invoices} columns={invoiceColumns} pagination={false} />
    },
    {
      key: '3',
      label: 'Materials Supplied',
      children: <Table dataSource={supplier.materials} columns={materialColumns} pagination={false} />
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb style={{ marginBottom: 16 }}>
        <Breadcrumb.Item><Link to="/app/dashboard" style={{ color: 'var(--color-text-secondary)' }}>Dashboard</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to="/app/suppliers" style={{ color: 'var(--color-text-secondary)' }}>Suppliers</Link></Breadcrumb.Item>
        <Breadcrumb.Item><span style={{ color: 'var(--color-gold)' }}>{supplier.name}</span></Breadcrumb.Item>
      </Breadcrumb>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space size="middle">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/suppliers')} />
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>{supplier.name}</h1>
        </Space>
        <Space>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print Profile</Button>
          <Button type="primary" icon={<EditOutlined />} onClick={() => message.info('Edit supplier features!')}>Edit</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <Descriptions column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}>
          <Descriptions.Item label="Contact Person" labelStyle={{ color: 'var(--color-text-secondary)' }}>{supplier.contact}</Descriptions.Item>
          <Descriptions.Item label="Email" labelStyle={{ color: 'var(--color-text-secondary)' }}>{supplier.email}</Descriptions.Item>
          <Descriptions.Item label="Phone" labelStyle={{ color: 'var(--color-text-secondary)' }}>{supplier.phone}</Descriptions.Item>
          <Descriptions.Item label="Payment Terms" labelStyle={{ color: 'var(--color-text-secondary)' }}>{supplier.terms}</Descriptions.Item>
          <Descriptions.Item label="Outstanding Balance" labelStyle={{ color: 'var(--color-text-secondary)' }}>
            <span style={{ color: supplier.outstanding > 0 ? '#ff4d4f' : 'inherit', fontWeight: 'bold' }}>₹{supplier.outstanding.toLocaleString()}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Credit Limit" labelStyle={{ color: 'var(--color-text-secondary)' }}>₹{supplier.limit.toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="Status" labelStyle={{ color: 'var(--color-text-secondary)' }}>
            <Tag color={supplier.status === 'Active' ? 'success' : 'default'}>{supplier.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Address" span={3} labelStyle={{ color: 'var(--color-text-secondary)' }}>{supplier.address}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card>
        <Tabs defaultActiveKey="1" items={tabItems} />
      </Card>
    </div>
  );
}
