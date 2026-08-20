import React from 'react';
import { Card, Table, Row, Col, Statistic, Tag, Typography } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { DollarOutlined } from '@ant-design/icons';
import useApiData from '../../hooks/useApiData';

const { Title } = Typography;

const AccountsPayable = () => {
  const { data: report, loading } = useApiData('/reports/aging-payables', { initialData: {} });
  const invoiceRows = Array.isArray(report.invoices) ? report.invoices : [];
  const agingData = [
    { name: 'Current', amount: Number(report.current || report['0-30'] || 0), color: '#52c41a' },
    { name: '1-30 Days', amount: Number(report['1-30'] || 0), color: '#faad14' },
    { name: '31-60 Days', amount: Number(report['31-60'] || 0), color: '#fa541c' },
    { name: '60+ Days', amount: Number(report['60+'] || report['90+'] || 0), color: '#cf1322' }
  ];
  const columns = [
    { title: 'Supplier', dataIndex: 'supplier', key: 'supplier' },
    { title: 'Invoice#', dataIndex: 'id', key: 'id' },
    { title: 'Due Date', dataIndex: 'due', key: 'due' },
    { 
      title: 'Amount', 
      dataIndex: 'amount', 
      key: 'amount',
      align: 'right',
      render: val => `₹${val.toLocaleString('en-IN')}`
    },
    { 
      title: 'Balance', 
      dataIndex: 'balance', 
      key: 'balance',
      align: 'right',
      render: val => <span style={{ fontWeight: 'bold' }}>₹{val.toLocaleString('en-IN')}</span>
    },
    { title: 'Days Overdue', dataIndex: 'daysOverdue', key: 'daysOverdue', align: 'center', render: val => val > 0 ? <span style={{ color: '#ff4d4f' }}>{val}</span> : '-' },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => {
        let color = 'success';
        if (status === '1-30 Days') color = 'warning';
        if (status === '31-60 Days') color = 'volcano';
        if (status === '60+ Days') color = 'error';
        return <Tag color={color}>{status}</Tag>;
      }
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', marginBottom: 24 }}>Accounts Payable</Title>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={4}>
          <Card style={{ height: '100%' }}>
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Total Payable</span>} value={agingData.reduce((sum, item) => sum + item.amount, 0)} prefix={<DollarOutlined />} styles={{ content: { color: '#ff4d4f' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card style={{ height: '100%' }}>
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Current</span>} value={agingData[0].amount} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card style={{ height: '100%' }}>
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>1-30 Days</span>} value={agingData[1].amount} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card style={{ height: '100%' }}>
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>31-60 Days</span>} value={agingData[2].amount} styles={{ content: { color: '#fa541c' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card style={{ height: '100%' }}>
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>60+ Days</span>} value={agingData[3].amount} styles={{ content: { color: '#cf1322' } }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card >
            <Title level={4} style={{ marginBottom: 16 }}>Aging Summary</Title>
            <div style={{ height: 300, width: '100%' }}>
              <ResponsiveContainer>
                <BarChart data={agingData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="name" stroke="#8b949e" />
                  <YAxis stroke="#8b949e" tickFormatter={(val) => `₹${val/1000}k`} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f1729', borderColor: '#30363d', color: '#fff' }}
                    formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Amount']}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {agingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      <Card >
        <Table 
          columns={columns} 
          dataSource={invoiceRows}
          loading={loading}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default AccountsPayable;
