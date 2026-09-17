import React from 'react';
import { Table, Card, Row, Col, Statistic, Tag, Button } from 'antd';
import { PlusOutlined, BankOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
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
    status: item.status === 'approved' ? 'Posted' : 'Draft'
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
        <Tag color={status === 'Posted' ? 'green' : 'gold'}>
          {status === 'Posted' ? <CheckCircleOutlined /> : <ClockCircleOutlined />} {status}
        </Tag>
      )
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
        <Col xs={24} sm={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Total Expenses</span>} value={expenseRows.length} prefix={<BankOutlined />} styles={{ content: { color: 'var(--color-text-primary)' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Posted</span>} value={expenseRows.filter(item => item.status === 'Posted').length} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
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
