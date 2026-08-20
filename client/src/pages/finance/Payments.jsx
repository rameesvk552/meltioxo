import React, { useState } from 'react';
import { Table, Card, Row, Col, Statistic, Tag, Tabs, Button } from 'antd';
import { PlusOutlined, ArrowUpOutlined, ArrowDownOutlined, DollarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';

const Payments = () => {
  const [activeTab, setActiveTab] = useState('All');
  const navigate = useNavigate();
  const { data: paymentData, loading } = useApiData('/payments');
  const paymentRows = paymentData.map(item => ({
    ...item,
    type: item.payment_type === 'incoming' ? 'Incoming' : 'Outgoing',
    party: item.party_name || item.party_type || '—',
    mode: item.payment_mode || '—',
    amount: Number(item.amount || 0),
    date: item.payment_date,
    ref: item.reference_number || '—',
    status: item.status || '—'
  }));

  const columns = [
    { title: 'Payment#', dataIndex: 'id', key: 'id' },
    { 
      title: 'Type', 
      dataIndex: 'type', 
      key: 'type',
      render: (type) => (
        <Tag color={type === 'Incoming' ? 'green' : 'red'}>
          {type === 'Incoming' ? <ArrowDownOutlined /> : <ArrowUpOutlined />} {type}
        </Tag>
      )
    },
    { title: 'Party', dataIndex: 'party', key: 'party' },
    { title: 'Mode', dataIndex: 'mode', key: 'mode', render: val => <Tag>{val}</Tag> },
    { 
      title: 'Amount', 
      dataIndex: 'amount', 
      key: 'amount',
      align: 'right',
      render: (val, record) => (
        <span style={{ color: record.type === 'Incoming' ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
          ₹{val.toLocaleString('en-IN')}
        </span>
      )
    },
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Reference', dataIndex: 'ref', key: 'ref', responsive: ['lg'] },
    { title: 'Status', dataIndex: 'status', key: 'status', render: val => <Tag color={val === 'Pending' ? 'warning' : 'success'}>{val}</Tag> }
  ];

  const filteredData = activeTab === 'All' ? paymentRows : paymentRows.filter(d => d.type === activeTab);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>Payments</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/payments/new')} >
          Record Payment
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Total Payments</span>} value={paymentRows.length} prefix={<DollarOutlined />} styles={{ content: { color: 'var(--color-text-primary)' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Incoming</span>} value={paymentRows.filter(item => item.type === 'Incoming').reduce((sum, item) => sum + item.amount, 0)} prefix={<ArrowDownOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Outgoing</span>} value={paymentRows.filter(item => item.type === 'Outgoing').reduce((sum, item) => sum + item.amount, 0)} prefix={<ArrowUpOutlined />} styles={{ content: { color: '#ff4d4f' } }} />
          </Card>
        </Col>
      </Row>

      <Card >
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          items={[
            { key: 'All', label: 'All Payments' },
            { key: 'Incoming', label: 'Incoming Receipts' },
            { key: 'Outgoing', label: 'Outgoing Payments' }
          ]} 
        />
        
        <Table 
          columns={columns} 
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default Payments;
