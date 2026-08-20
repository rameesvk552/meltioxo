import React, { useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Collapse, DatePicker, Empty, Row, Segmented,
  Select, Space, Spin, Statistic, Table, Tag, Typography
} from 'antd';
import {
  ArrowDownOutlined, ArrowUpOutlined, DownloadOutlined, InfoCircleOutlined,
  PrinterOutlined, RiseOutlined, TrophyOutlined, WarningOutlined
} from '@ant-design/icons';
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis
} from 'recharts';
import dayjs from 'dayjs';
import useApiData from '../../hooks/useApiData';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const preciseMoney = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percentage = value => `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;

const presetRange = preset => {
  const today = dayjs();
  if (preset === 'today') return [today, today];
  if (preset === 'this_month') return [today.startOf('month'), today];
  if (preset === 'last_30_days') return [today.subtract(29, 'day'), today];
  if (preset === 'last_year') return [today.subtract(1, 'year').startOf('year'), today.subtract(1, 'year').endOf('year')];
  if (preset === 'last_5_years') return [today.subtract(4, 'year').startOf('year'), today];
  return [today.startOf('year'), today];
};

const comparisonText = (value, positiveIsGood = true) => {
  if (value == null) return { text: 'No prior-period base', color: '#8c8c8c', icon: null };
  const improved = positiveIsGood ? value >= 0 : value <= 0;
  return {
    text: `${Math.abs(value).toFixed(1)}% vs previous period`,
    color: improved ? '#16a34a' : '#dc2626',
    icon: value >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />
  };
};

function MetricCard({ title, value, suffix, change, positiveIsGood = true, color = '#172033' }) {
  const comparison = comparisonText(change, positiveIsGood);
  return <Card style={{ height: '100%', borderRadius: 14 }} bodyStyle={{ padding: 18 }}>
    <Statistic
      title={<Text type="secondary">{title}</Text>}
      value={value}
      prefix={suffix ? undefined : '₹'}
      suffix={suffix}
      precision={suffix === '%' ? 1 : 0}
      styles={{ content: { color, fontWeight: 750, fontSize: 25 } }}
    />
    <div style={{ color: comparison.color, fontSize: 12, marginTop: 7 }}>
      {comparison.icon} {comparison.text}
    </div>
  </Card>;
}

function StatementRow({ label, value, tone, strong, inset }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: strong ? '12px 0' : '7px 0', paddingLeft: inset ? 18 : 0, borderTop: strong ? '1px solid var(--color-border)' : undefined }}>
    <Text strong={strong} type={inset ? 'secondary' : undefined}>{label}</Text>
    <Text strong={strong} style={{ color: tone }}>{preciseMoney(value)}</Text>
  </div>;
}

const csvValue = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

export default function OwnerProfitAndLoss() {
  const [preset, setPreset] = useState('this_year');
  const [range, setRange] = useState(() => presetRange('this_year'));
  const [groupBy, setGroupBy] = useState('month');
  const [productView, setProductView] = useState('products');
  const [pageSize, setPageSize] = useState(10);

  const endpoint = useMemo(() => {
    const from = range[0].format('YYYY-MM-DD');
    const to = range[1].format('YYYY-MM-DD');
    return `/reports/profit-loss?from=${from}&to=${to}&group_by=${groupBy}`;
  }, [range, groupBy]);

  const { data: report, loading, error } = useApiData(endpoint, {
    initialData: { summary: {}, comparison: { changes: {}, previous: {} }, trend: [], accounts: {}, product_profitability: {} }
  });

  const summary = report.summary || {};
  const changes = report.comparison?.changes || {};
  const products = report.product_profitability?.[productView] || [];
  const ownerSignals = report.owner_signals || {};

  const selectPreset = value => {
    setPreset(value);
    if (value === 'custom') return;
    setRange(presetRange(value));
    if (['today', 'this_month', 'last_30_days'].includes(value)) setGroupBy('day');
    else if (value === 'last_5_years') setGroupBy('year');
    else setGroupBy('month');
  };

  const selectRange = values => {
    if (!values?.[0] || !values?.[1]) return;
    setRange(values);
    setPreset('custom');
  };

  const exportCsv = () => {
    const headers = ['Product', 'SKU / Code', 'Units', 'Revenue', 'COGS', 'Gross Profit', 'Gross Margin %', 'Allocated Overhead', 'Estimated Net Profit', 'Net Margin %'];
    const rows = products.map(item => [
      productView === 'variants' ? `${item.product_name} · ${item.variant_name}` : item.product_name,
      item.sku || item.code, item.quantity, item.revenue, item.cogs, item.gross_profit,
      item.gross_margin_pct, item.allocated_expenses, item.net_profit, item.net_margin_pct
    ]);
    const csv = [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `profit-and-loss-${range[0].format('YYYY-MM-DD')}-${range[1].format('YYYY-MM-DD')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const productColumns = [
    {
      title: productView === 'variants' ? 'Product / Variant' : 'Product', key: 'product', fixed: 'left', width: 230,
      render: (_, item) => <div><Text strong>{item.product_name}</Text><div><Text type="secondary" style={{ fontSize: 12 }}>{productView === 'variants' ? `${item.variant_name} · ${item.sku}` : item.code}</Text></div></div>
    },
    { title: 'Units', dataIndex: 'quantity', align: 'right', width: 90, sorter: (a, b) => a.quantity - b.quantity },
    { title: 'Revenue', dataIndex: 'revenue', align: 'right', width: 130, render: money, sorter: (a, b) => a.revenue - b.revenue },
    { title: 'COGS', dataIndex: 'cogs', align: 'right', width: 120, render: money },
    { title: 'Gross profit', dataIndex: 'gross_profit', align: 'right', width: 135, render: value => <Text style={{ color: value >= 0 ? '#16a34a' : '#dc2626' }}>{money(value)}</Text>, sorter: (a, b) => a.gross_profit - b.gross_profit },
    { title: 'Gross margin', dataIndex: 'gross_margin_pct', align: 'right', width: 125, render: value => <Tag color={value >= 40 ? 'green' : value >= 20 ? 'gold' : 'red'}>{percentage(value)}</Tag>, sorter: (a, b) => a.gross_margin_pct - b.gross_margin_pct },
    { title: 'Allocated overhead', dataIndex: 'allocated_expenses', align: 'right', width: 155, render: money },
    { title: 'Est. net profit', dataIndex: 'net_profit', align: 'right', width: 145, render: value => <Text strong style={{ color: value >= 0 ? '#16a34a' : '#dc2626' }}>{money(value)}</Text>, sorter: (a, b) => a.net_profit - b.net_profit },
    { title: 'Net margin', dataIndex: 'net_margin_pct', align: 'right', width: 115, render: percentage, sorter: (a, b) => a.net_margin_pct - b.net_margin_pct }
  ];

  const accountPanels = [
    ['Revenue accounts', report.accounts?.revenue || [], '#16a34a'],
    ['Cost of goods sold accounts', report.accounts?.cogs || [], '#d97706'],
    ['Operating expense accounts', report.accounts?.operating_expenses || [], '#dc2626']
  ].map(([label, rows, color]) => ({
    key: label,
    label: `${label} (${rows.length})`,
    children: rows.length ? rows.map(row => <StatementRow key={row.id} label={`${row.code} · ${row.name}`} value={row.amount} tone={color} inset />) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No postings in this period" />
  }));

  if (loading && !report.period) return <div style={{ display: 'grid', placeItems: 'center', minHeight: 420 }}><Spin size="large" /></div>;

  return <div style={{ padding: 24, maxWidth: 1500, margin: '0 auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
      <div>
        <Text type="secondary" style={{ fontSize: 11, letterSpacing: 1.4 }}>OWNER REPORT · PROFITABILITY</Text>
        <Title level={2} style={{ margin: '3px 0', color: 'var(--color-gold)', fontFamily: "'Playfair Display', serif" }}>Profit & Loss Intelligence</Title>
        <Text type="secondary">Company P&L, trends, product contribution and owner alerts in one report.</Text>
      </div>
      <Space wrap>
        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
        <Button type="primary" icon={<DownloadOutlined />} onClick={exportCsv} disabled={!products.length}>Export products</Button>
      </Space>
    </div>

    <Card style={{ marginBottom: 16, borderRadius: 14 }} bodyStyle={{ padding: 16 }}>
      <Space wrap size={12}>
        <Select value={preset} onChange={selectPreset} style={{ width: 150 }} options={[
          { value: 'today', label: 'Today' }, { value: 'this_month', label: 'This month' },
          { value: 'last_30_days', label: 'Last 30 days' }, { value: 'this_year', label: 'This year' },
          { value: 'last_year', label: 'Last year' }, { value: 'last_5_years', label: 'Last 5 years' },
          { value: 'custom', label: 'Custom range' }
        ]} />
        <RangePicker value={range} onChange={selectRange} allowClear={false} />
        <Segmented value={groupBy} onChange={setGroupBy} options={[{ label: 'Daily', value: 'day' }, { label: 'Monthly', value: 'month' }, { label: 'Yearly', value: 'year' }]} />
        {loading && <Spin size="small" />}
      </Space>
    </Card>

    {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Could not load the profitability report" description={error.response?.data?.message || error.message} />}

    <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
      <Col xs={24} sm={12} xl={4}><MetricCard title="Revenue" value={summary.revenue} change={changes.revenue_pct} color="#2563eb" /></Col>
      <Col xs={24} sm={12} xl={4}><MetricCard title="Gross profit" value={summary.gross_profit} change={changes.gross_profit_pct} color="#16a34a" /></Col>
      <Col xs={24} sm={12} xl={4}><MetricCard title="Gross margin" value={summary.gross_margin_pct} suffix="%" color="#0f766e" /></Col>
      <Col xs={24} sm={12} xl={4}><MetricCard title="Operating expenses" value={summary.operating_expenses} change={changes.operating_expenses_pct} positiveIsGood={false} color="#d97706" /></Col>
      <Col xs={24} sm={12} xl={4}><MetricCard title="Net profit" value={summary.net_profit} change={changes.net_profit_pct} color={summary.net_profit >= 0 ? '#16a34a' : '#dc2626'} /></Col>
      <Col xs={24} sm={12} xl={4}><MetricCard title="Net margin" value={summary.net_margin_pct} suffix="%" color={summary.net_margin_pct >= 0 ? '#7c3aed' : '#dc2626'} /></Col>
    </Row>

    <Card style={{ marginBottom: 16, borderRadius: 14, background: 'linear-gradient(135deg, #14213b 0%, #24395f 100%)', border: 0 }} bodyStyle={{ padding: 20 }}>
      <Row gutter={[20, 16]} align="middle">
        <Col xs={24} lg={10}>
          <Text style={{ color: '#9fb0cb', fontSize: 11, letterSpacing: 1 }}>OWNER'S READOUT</Text>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 750, marginTop: 4 }}>{ownerSignals.profitable ? 'The business is profitable for this period.' : 'The business is below break-even for this period.'}</div>
          <Text style={{ color: '#c9d4e6' }}>{summary.break_even_revenue == null ? 'A positive contribution margin is needed before break-even can be calculated.' : `Break-even revenue at the current gross margin is ${money(summary.break_even_revenue)}.`}</Text>
        </Col>
        <Col xs={12} md={6} lg={4}><Statistic title={<span style={{ color: '#9fb0cb' }}>Orders</span>} value={summary.orders || 0} styles={{ content: { color: '#fff' } }} /></Col>
        <Col xs={12} md={6} lg={4}><Statistic title={<span style={{ color: '#9fb0cb' }}>Average order</span>} value={summary.average_order_value || 0} prefix="₹" precision={0} styles={{ content: { color: '#fff' } }} /></Col>
        <Col xs={12} md={6} lg={3}><Statistic title={<span style={{ color: '#9fb0cb' }}>Loss products</span>} value={ownerSignals.loss_products || 0} prefix={<WarningOutlined />} styles={{ content: { color: ownerSignals.loss_products ? '#ff7875' : '#73d13d' } }} /></Col>
        <Col xs={12} md={6} lg={3}><Statistic title={<span style={{ color: '#9fb0cb' }}>Low margin</span>} value={ownerSignals.low_margin_products || 0} prefix={<RiseOutlined />} styles={{ content: { color: ownerSignals.low_margin_products ? '#f6cf75' : '#73d13d' } }} /></Col>
      </Row>
      {ownerSignals.best_product && <div style={{ marginTop: 14, color: '#f6cf75' }}><TrophyOutlined /> Best product: <strong>{ownerSignals.best_product.name}</strong> · estimated net profit {money(ownerSignals.best_product.net_profit)} · margin {percentage(ownerSignals.best_product.margin_pct)}</div>}
    </Card>

    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} xl={15}>
        <Card title="Profit trend" style={{ height: '100%', borderRadius: 14 }}>
          {report.trend?.length ? <div style={{ height: 360 }}><ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={report.trend} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
              <defs><linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="label" minTickGap={28} />
              <YAxis tickFormatter={value => `₹${Math.round(value / 1000)}k`} width={72} />
              <ChartTooltip formatter={value => money(value)} contentStyle={{ borderRadius: 10 }} /><Legend />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" fill="#2563eb" fillOpacity={0.08} />
              <Area type="monotone" dataKey="net_profit" name="Net profit" stroke="#16a34a" fill="url(#profitFill)" strokeWidth={2.5} />
              <Line type="monotone" dataKey="operating_expenses" name="Operating expenses" stroke="#d97706" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer></div> : <Empty description="No financial postings in this period" />}
        </Card>
      </Col>
      <Col xs={24} xl={9}>
        <Card title="Profit & loss statement" style={{ height: '100%', borderRadius: 14 }}>
          <StatementRow label="Revenue" value={summary.revenue} tone="#2563eb" strong />
          <StatementRow label="Cost of goods sold" value={summary.cogs} inset />
          <StatementRow label="Gross profit" value={summary.gross_profit} tone="#16a34a" strong />
          <StatementRow label="Operating expenses" value={summary.operating_expenses} inset />
          <StatementRow label="Net profit" value={summary.net_profit} tone={summary.net_profit >= 0 ? '#16a34a' : '#dc2626'} strong />
          <Collapse ghost size="small" items={accountPanels} style={{ marginTop: 10 }} />
        </Card>
      </Col>
    </Row>

    <Card title="Product-wise profit & loss" style={{ borderRadius: 14 }} extra={<Segmented value={productView} onChange={setProductView} options={[{ label: 'By product', value: 'products' }, { label: 'By variant', value: 'variants' }]} />}>
      <Alert type="info" showIcon icon={<InfoCircleOutlined />} message="How product net profit is calculated" description={report.product_profitability?.allocation_method || 'Operating expenses are allocated by product revenue share. Gross profit uses the actual cost recorded on each sale.'} style={{ marginBottom: 14 }} />
      {Math.abs(Number(report.product_profitability?.unreconciled_sales_revenue || 0)) > 0.01 && <Alert type="warning" showIcon message={`${money(report.product_profitability.unreconciled_sales_revenue)} of company revenue is not linked to product sale lines (for example, other income or manual journals).`} style={{ marginBottom: 14 }} />}
      <Table
        rowKey="id" columns={productColumns} dataSource={products} loading={loading} scroll={{ x: 1320 }}
        pagination={{ pageSize, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100], onShowSizeChange: (_, size) => setPageSize(size), showTotal: total => `${total} records` }}
        locale={{ emptyText: <Empty description="No product sales in this period" /> }}
        summary={rows => rows.length ? <Table.Summary.Row>
          <Table.Summary.Cell index={0}><Text strong>All products total</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={1} align="right"><Text strong>{rows.reduce((sum, row) => sum + row.quantity, 0).toLocaleString('en-IN')}</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={2} align="right"><Text strong>{money(rows.reduce((sum, row) => sum + row.revenue, 0))}</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={3} align="right"><Text strong>{money(rows.reduce((sum, row) => sum + row.cogs, 0))}</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={4} align="right"><Text strong>{money(rows.reduce((sum, row) => sum + row.gross_profit, 0))}</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={5} />
          <Table.Summary.Cell index={6} align="right"><Text strong>{money(rows.reduce((sum, row) => sum + row.allocated_expenses, 0))}</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={7} align="right"><Text strong>{money(rows.reduce((sum, row) => sum + row.net_profit, 0))}</Text></Table.Summary.Cell>
          <Table.Summary.Cell index={8} />
        </Table.Summary.Row> : null}
      />
    </Card>
  </div>;
}
