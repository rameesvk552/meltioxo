import React from 'react';
import { Card, Typography, DatePicker, Table } from 'antd';
import useApiData from '../../hooks/useApiData';

const { Title, Text } = Typography;

const TrialBalance = () => {
  const { data: accounts, loading } = useApiData('/accounts');
  const accountRows = accounts.map(item => {
    const balance = Number(item.balance || 0);
    const debitNormal = ['asset', 'expense'].includes(String(item.type).toLowerCase());
    return {
      ...item,
      debit: debitNormal ? Math.max(balance, 0) : Math.max(-balance, 0),
      credit: debitNormal ? Math.max(-balance, 0) : Math.max(balance, 0)
    };
  });
  const totalDebit = accountRows.reduce((sum, item) => sum + item.debit, 0);
  const totalCredit = accountRows.reduce((sum, item) => sum + item.credit, 0);

  const columns = [
    { title: 'Account Code', dataIndex: 'code', key: 'code', width: '15%' },
    { title: 'Account Name', dataIndex: 'name', key: 'name' },
    { title: 'Type', dataIndex: 'type', key: 'type', responsive: ['md'] },
    { 
      title: 'Debit Balance', 
      dataIndex: 'debit', 
      key: 'debit',
      align: 'right',
      render: val => val > 0 ? `₹${val.toLocaleString('en-IN')}` : '-'
    },
    { 
      title: 'Credit Balance', 
      dataIndex: 'credit', 
      key: 'credit',
      align: 'right',
      render: val => val > 0 ? `₹${val.toLocaleString('en-IN')}` : '-'
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>Trial Balance</Title>
        <DatePicker  placeholder="As of Date" />
      </div>

      <Card >
        <Table 
          columns={columns} 
          dataSource={accountRows}
          loading={loading}
          rowKey="code"
          pagination={false}
          scroll={{ x: 'max-content' }}
          summary={() => (
            <Table.Summary.Row style={{ background: 'rgba(0,0,0,0.2)' }}>
              <Table.Summary.Cell index={0} colSpan={3}>
                <Text strong style={{ color: 'var(--color-gold)', fontSize: 16 }}>TOTAL</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text strong style={{ color: totalDebit === totalCredit ? '#52c41a' : '#ff4d4f', fontSize: 16 }}>₹{totalDebit.toLocaleString('en-IN')}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <Text strong style={{ color: totalDebit === totalCredit ? '#52c41a' : '#ff4d4f', fontSize: 16 }}>₹{totalCredit.toLocaleString('en-IN')}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </div>
  );
};

export default TrialBalance;
