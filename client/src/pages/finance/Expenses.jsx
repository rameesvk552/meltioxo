import React from 'react';
import { Table, Card, Row, Col, Statistic, Tag, Button, Space } from 'antd';
import { PlusOutlined, EyeOutlined, BankOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';

const Expenses = () => {
  const navigate = useNavigate();
  const { data: expenseData, loading } = useApiData('/expenses');
  const expenseRows = expenseData.map(item => ({
    ...item,
    date: item.expense_date,
    category: item.category || '—',
    account: item.account_id || '—',
    amount: Number(item.amount || 0),
    mode: item.payment_mode || '—',
    status: item.status ? item.status[0].toUpperCase() + item.status.slice(1) : 'Draft'
  }));

  const columns = [
    { title: 'Expense#', dataIndex: 'id', key: 'id' },
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Category', dataIndex: 'category', key: 'category', responsive: ['md'] },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    { title: 'Account', dataIndex: 'account', key: 'account', responsive: ['lg'] },
    { 
      title: 'Amount', 
      dataIndex: 'amount', 
      key: 'amount',
      align: 'right',
      render: (val) => `₹${val.toLocaleString('en-IN')}`
    },
    { title: 'Mode', dataIndex: 'mode', key: 'mode', responsive: ['lg'] },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => (
        <Tag color={status === 'Approved' ? 'green' : 'gold'}>
          {status === 'Approved' ? <CheckCircleOutlined /> : <ClockCircleOutlined />} {status}
        </Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="text" icon={<EyeOutlined />} style={{ color: 'var(--color-gold)' }} />
          {record.status === 'Draft' && <Button type="link" size="small">Approve</Button>}
        </Space>
      ),
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>Expenses</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/expenses/new')} >
          Record Expense
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Total Expenses</span>} value={expenseRows.length} prefix={<BankOutlined />} styles={{ content: { color: 'var(--color-text-primary)' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Draft</span>} value={expenseRows.filter(item => item.status === 'Draft').length} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Approved</span>} value={expenseRows.filter(item => item.status === 'Approved').length} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Total Amount</span>} value={expenseRows.reduce((sum, item) => sum + item.amount, 0)} prefix="₹" styles={{ content: { color: '#ff4d4f' } }} />
          </Card>
        </Col>
      </Row>

      <Card >
        <Table 
          columns={columns} 
          dataSource={expenseRows}
          loading={loading}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default Expenses;
