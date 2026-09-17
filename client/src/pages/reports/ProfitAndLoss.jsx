import React from 'react';
import { Card, Typography, DatePicker, Row, Col, Divider } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import useApiData from '../../hooks/useApiData';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ProfitAndLoss = () => {
  const { data: report } = useApiData('/reports/profit-loss', { initialData: {} });
  const trendData = Array.isArray(report.trend) ? report.trend : [];
  const data = {
    revenue: { sales: Number(report.sales ?? report.revenue ?? 0), other: Number(report.other_income || 0) },
    cogs: Number(report.cogs || 0),
    expenses: {
      manufacturing: Number(report.manufacturing_expense || 0),
      salaries: Number(report.salary_expense || 0),
      rent: Number(report.rent_expense || 0),
      utilities: Number(report.utilities_expense || 0),
      marketing: Number(report.marketing_expense || 0),
      office: Number(report.office_expense ?? report.expense ?? 0)
    }
  };

  const totalRevenue = data.revenue.sales + data.revenue.other;
  const grossProfit = totalRevenue - data.cogs;
  const totalExpenses = Object.values(data.expenses).reduce((a, b) => a + b, 0);
  const netProfit = grossProfit - totalExpenses;

  const ItemRow = ({ label, value, indent = false, bold = false, color = '#fff' }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: indent ? 24 : 0 }}>
      <Text style={{ color: bold ? color : '#8b949e', fontWeight: bold ? 'bold' : 'normal', fontSize: bold ? 16 : 14 }}>{label}</Text>
      <Text style={{ color: bold ? color : '#fff', fontWeight: bold ? 'bold' : 'normal', fontSize: bold ? 16 : 14 }}>₹{value.toLocaleString('en-IN')}</Text>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>Profit & Loss Statement</Title>
        <RangePicker  />
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card style={{ height: '100%' }}>
            
            <Title level={4} style={{ color: 'var(--color-gold)', borderBottom: '1px solid #30363d', paddingBottom: 8 }}>Revenue</Title>
            <ItemRow label="Sales" value={data.revenue.sales} indent />
            <ItemRow label="Other Income" value={data.revenue.other} indent />
            <Divider style={{ margin: '8px 0', borderColor: '#30363d' }} />
            <ItemRow label="Total Revenue" value={totalRevenue} bold color="#52c41a" />
            
            <Title level={4} style={{ color: 'var(--color-gold)', borderBottom: '1px solid #30363d', paddingBottom: 8, marginTop: 24 }}>Cost of Goods Sold</Title>
            <ItemRow label="Cost of Goods Sold" value={data.cogs} indent />
            <Divider style={{ margin: '8px 0', borderColor: '#30363d' }} />
            <ItemRow label="Gross Profit" value={grossProfit} bold color="#1677ff" />

            <Title level={4} style={{ color: 'var(--color-gold)', borderBottom: '1px solid #30363d', paddingBottom: 8, marginTop: 24 }}>Operating Expenses</Title>
            <ItemRow label="Manufacturing Overhead" value={data.expenses.manufacturing} indent />
            <ItemRow label="Salaries & Wages" value={data.expenses.salaries} indent />
            <ItemRow label="Rent" value={data.expenses.rent} indent />
            <ItemRow label="Utilities" value={data.expenses.utilities} indent />
            <ItemRow label="Marketing" value={data.expenses.marketing} indent />
            <ItemRow label="Office Expenses" value={data.expenses.office} indent />
            <Divider style={{ margin: '8px 0', borderColor: '#30363d' }} />
            <ItemRow label="Total Operating Expenses" value={totalExpenses} bold color="#faad14" />

            <Divider style={{ margin: '16px 0', borderColor: 'var(--color-gold)' }} />
            <ItemRow label="Net Profit" value={netProfit} bold color={netProfit >= 0 ? '#52c41a' : '#ff4d4f'} />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card >
            <Title level={4} style={{ marginBottom: 16 }}>Revenue vs Expenses Trend</Title>
            <div style={{ height: 350, width: '100%' }}>
              <ResponsiveContainer>
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="month" stroke="#8b949e" />
                  <YAxis stroke="#8b949e" tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f1729', borderColor: '#30363d', color: '#fff' }}
                    formatter={(value) => `₹${value.toLocaleString('en-IN')}`}
                  />
                  <Line type="monotone" dataKey="rev" name="Revenue" stroke="#52c41a" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="exp" name="Expenses" stroke="#ff4d4f" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProfitAndLoss;
