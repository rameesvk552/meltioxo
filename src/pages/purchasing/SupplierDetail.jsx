import React from 'react';
import { Card, Descriptions, Tabs, Table, Tag, Typography, Breadcrumb } from 'antd';
import { HomeOutlined, UserOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { TabPane } = Tabs;

const SupplierDetail = () => {
  const purchaseHistory = [
    { key: '1', po: 'PO-2023-001', date: '2023-10-01', amount: 150000, status: 'Completed', receivedDate: '2023-10-15' },
    { key: '2', po: 'PO-2023-045', date: '2023-11-12', amount: 200000, status: 'Completed', receivedDate: '2023-11-20' },
    { key: '3', po: 'PO-2023-089', date: '2023-12-05', amount: 125000, status: 'In Transit', receivedDate: '-' },
  ];

  const outstandingInvoices = [
    { key: '1', invoice: 'INV-A-102', date: '2023-11-20', amount: 200000, paid: 100000, balance: 100000, dueDate: '2023-12-20', daysOverdue: 15 },
    { key: '2', invoice: 'INV-A-145', date: '2023-12-01', amount: 125000, paid: 100000, balance: 25000, dueDate: '2023-12-31', daysOverdue: 4 },
  ];

  const materialsSupplied = [
    { key: '1', material: 'Rose Absolute', type: 'Raw Material', unitPrice: 45000, leadTime: '15 Days' },
    { key: '2', material: 'Sandalwood Oil', type: 'Raw Material', unitPrice: 85000, leadTime: '30 Days' },
    { key: '3', material: 'Bergamot Extract', type: 'Raw Material', unitPrice: 12000, leadTime: '10 Days' },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item href=""><HomeOutlined /></Breadcrumb.Item>
        <Breadcrumb.Item href="/purchasing/suppliers"><UserOutlined /> Suppliers</Breadcrumb.Item>
        <Breadcrumb.Item>Aromatic Essentials Pvt Ltd</Breadcrumb.Item>
      </Breadcrumb>

      <Title level={2} style={{ color: '#d4a853', fontFamily: 'Playfair Display', marginBottom: '24px' }}>Aromatic Essentials Pvt Ltd</Title>

      <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: '24px' }}>
        <Descriptions title={<span style={{ color: '#d4a853' }}>Supplier Information</span>} bordered column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }} contentStyle={{ color: '#e2e8f0' }} labelStyle={{ color: '#94a3b8' }}>
          <Descriptions.Item label="Contact Person">Rahul Sharma</Descriptions.Item>
          <Descriptions.Item label="Email">rahul@aromatic.in</Descriptions.Item>
          <Descriptions.Item label="Phone">+91 9876543210</Descriptions.Item>
          <Descriptions.Item label="Payment Terms">Net 30</Descriptions.Item>
          <Descriptions.Item label="Outstanding Balance"><span style={{ color: '#ef4444' }}>₹1,25,000</span></Descriptions.Item>
          <Descriptions.Item label="Credit Limit">₹5,00,000</Descriptions.Item>
          <Descriptions.Item label="Status"><Tag color="green">Active</Tag></Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
        <Tabs defaultActiveKey="1" className="custom-tabs">
          <TabPane tab="Purchase History" key="1">
            <Table 
              dataSource={purchaseHistory} 
              columns={[
                { title: 'PO#', dataIndex: 'po', key: 'po' },
                { title: 'Date', dataIndex: 'date', key: 'date' },
                { title: 'Amount', dataIndex: 'amount', key: 'amount', render: val => `₹${val.toLocaleString()}` },
                { title: 'Status', dataIndex: 'status', key: 'status', render: s => <Tag color={s === 'Completed' ? 'green' : 'blue'}>{s}</Tag> },
                { title: 'Received Date', dataIndex: 'receivedDate', key: 'receivedDate' }
              ]} 
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </TabPane>
          <TabPane tab="Outstanding Invoices" key="2">
            <Table 
              dataSource={outstandingInvoices} 
              columns={[
                { title: 'Invoice#', dataIndex: 'invoice', key: 'invoice' },
                { title: 'Date', dataIndex: 'date', key: 'date' },
                { title: 'Amount', dataIndex: 'amount', key: 'amount', render: val => `₹${val.toLocaleString()}` },
                { title: 'Paid', dataIndex: 'paid', key: 'paid', render: val => `₹${val.toLocaleString()}` },
                { title: 'Balance', dataIndex: 'balance', key: 'balance', render: val => <span style={{ color: '#ef4444' }}>₹{val.toLocaleString()}</span> },
                { title: 'Due Date', dataIndex: 'dueDate', key: 'dueDate' },
                { title: 'Days Overdue', dataIndex: 'daysOverdue', key: 'daysOverdue', render: val => <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{val} Days</span> }
              ]} 
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </TabPane>
          <TabPane tab="Materials Supplied" key="3">
            <Table 
              dataSource={materialsSupplied} 
              columns={[
                { title: 'Material', dataIndex: 'material', key: 'material' },
                { title: 'Type', dataIndex: 'type', key: 'type' },
                { title: 'Unit Price', dataIndex: 'unitPrice', key: 'unitPrice', render: val => `₹${val.toLocaleString()}` },
                { title: 'Lead Time', dataIndex: 'leadTime', key: 'leadTime' }
              ]} 
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default SupplierDetail;
