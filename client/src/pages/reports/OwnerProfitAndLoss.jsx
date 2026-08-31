import React, { useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Drawer, Empty, Row,
  Segmented, Select, Space, Spin, Statistic, Table, Tag, Typography
} from 'antd';
import {
  DownloadOutlined, EyeOutlined, FileTextOutlined, PrinterOutlined,
  ShoppingCartOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import useApiData from '../../hooks/useApiData';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const money = value => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(Number(value || 0));
const quantity = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 });
const percentage = value => `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;
const dateLabel = value => value ? dayjs(value).format('DD MMM YYYY') : '—';

const presetRange = preset => {
  const today = dayjs();
  if (preset === 'yesterday') return [today.subtract(1, 'day'), today.subtract(1, 'day')];
  if (preset === 'last_7_days') return [today.subtract(6, 'day'), today];
  if (preset === 'this_month') return [today.startOf('month'), today];
  return [today, today];
};

const csvValue = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

function SummaryCard({ title, value, description, moneyValue = false, icon, color = '#172033', action }) {
  return <Card style={{ height: '100%', borderRadius: 12 }} bodyStyle={{ padding: 18 }}>
    <Text type="secondary">{title}</Text>
    <div style={{ color, fontWeight: 750, fontSize: 24, lineHeight: 1.2, marginTop: 4, whiteSpace: 'nowrap', letterSpacing: '-0.3px' }}>
      {moneyValue ? money(value) : <><span style={{ marginRight: 7 }}>{icon}</span>{Number(value || 0).toLocaleString('en-IN')}</>}
    </div>
    <Text type="secondary" style={{ display: 'block', fontSize: 11, lineHeight: 1.35, marginTop: 7 }}>{description}</Text>
    {action && <div style={{ marginTop: 8 }}>{action}</div>}
  </Card>;
}

function ExpenseBreakdownDrawer({ open, onClose, range }) {
  const endpoint = useMemo(() => open
    ? `/reports/profit-loss-statement?from=${range[0].format('YYYY-MM-DD')}&to=${range[1].format('YYYY-MM-DD')}`
    : null, [open, range]);
  const expenseQuery = useApiData(endpoint, {
    enabled: open,
    initialData: { summary: {}, accounts: {} }
  });
  const summary = expenseQuery.data.summary || {};
  const rows = Array.isArray(expenseQuery.data.accounts?.operating_expenses) ? expenseQuery.data.accounts.operating_expenses : [];
  const operatingExpenses = Number(summary.operating_expenses || 0);
  const totalCosts = Number(summary.cogs || 0) + operatingExpenses;
  const columns = [
    { title: 'Code', dataIndex: 'code', width: 90 },
    { title: 'Expense ledger', dataIndex: 'name' },
    {
      title: 'Share', width: 100, align: 'right',
      render: (_, row) => operatingExpenses ? percentage(Number(row.amount || 0) / operatingExpenses * 100) : '0%'
    },
    { title: 'Amount', dataIndex: 'amount', width: 145, align: 'right', render: value => <Text strong>{money(value)}</Text> }
  ];

  const exportExpenses = () => {
    const headers = ['Code', 'Expense ledger', 'Amount'];
    const exportRows = rows.map(item => [item.code, item.name, Number(item.amount || 0).toFixed(2)]);
    exportRows.push(['', 'Total operating expenses', operatingExpenses.toFixed(2)]);
    const csv = [
      ['Expense breakdown', `${range[0].format('YYYY-MM-DD')} to ${range[1].format('YYYY-MM-DD')}`],
      [], headers, ...exportRows
    ].map(row => row.map(csvValue).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `expense-breakdown-${range[0].format('YYYY-MM-DD')}-${range[1].format('YYYY-MM-DD')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return <Drawer
    title="Expense breakdown"
    open={open}
    onClose={onClose}
    width={720}
    destroyOnHidden
    extra={<Button icon={<DownloadOutlined />} onClick={exportExpenses} disabled={!rows.length}>Export expenses</Button>}
  >
    <Alert
      type="info"
      showIcon
      message={`${range[0].format('DD MMM YYYY')} to ${range[1].format('DD MMM YYYY')}`}
      description="Only expenses posted to the accounts within the selected dates are included. Draft expenses are excluded."
      style={{ marginBottom: 16 }}
    />
    <Row gutter={[12, 12]} style={{ marginBottom: 18 }}>
      <Col xs={12}><Card size="small"><Statistic title="Operating expenses" value={operatingExpenses} prefix="₹" precision={2} /></Card></Col>
      <Col xs={12}><Card size="small"><Statistic title="COGS + expenses" value={totalCosts} prefix="₹" precision={2} /></Card></Col>
    </Row>
    <Table
      rowKey={row => row.id || row.code}
      columns={columns}
      dataSource={rows}
      loading={expenseQuery.loading}
      pagination={false}
      size="small"
      scroll={{ x: 620 }}
      locale={{ emptyText: <Empty description="No operating expenses posted in this period" /> }}
      summary={() => rows.length ? <Table.Summary.Row>
        <Table.Summary.Cell index={0} colSpan={3}><Text strong>Total operating expenses</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={3} align="right"><Text strong>{money(operatingExpenses)}</Text></Table.Summary.Cell>
      </Table.Summary.Row> : null}
    />
  </Drawer>;
}

function InvoiceDrawer({ invoiceId, onClose }) {
  const navigate = useNavigate();
  const saleQuery = useApiData(invoiceId ? `/retail-sales/${invoiceId}` : null, {
    enabled: Boolean(invoiceId), initialData: {}
  });
  const sale = saleQuery.data;
  const items = sale.retailSaleItems || [];

  const itemColumns = [
    {
      title: 'Product / variant', key: 'product', width: 220,
      render: (_, item) => {
        const variant = item.finishedGood || {};
        const product = variant.product || {};
        return <div><Text strong>{product.name || variant.name || 'Product'}</Text><div><Text type="secondary" style={{ fontSize: 12 }}>{variant.size_label || variant.sku || 'Standard'}</Text></div></div>;
      }
    },
    { title: 'Qty', dataIndex: 'quantity', align: 'right', width: 80, render: quantity },
    { title: 'Rate', dataIndex: 'unit_price', align: 'right', width: 110, render: money },
    {
      title: 'Discount', key: 'discount', align: 'right', width: 120,
      render: (_, item) => {
        const base = Number(item.quantity || 0) * Number(item.unit_price || 0);
        const discount = Math.max(0, base - (Number(item.total || 0) - Number(item.tax_amount || 0)));
        return <div>{money(discount)}<div><Text type="secondary" style={{ fontSize: 11 }}>{percentage(item.discount_pct)}</Text></div></div>;
      }
    },
    { title: 'Tax', dataIndex: 'tax_amount', align: 'right', width: 100, render: money },
    { title: 'Amount', dataIndex: 'total', align: 'right', width: 115, render: value => <Text strong>{money(value)}</Text> }
  ];

  return <Drawer
    title={sale.sale_number ? `Invoice ${sale.sale_number}` : 'Invoice details'}
    open={Boolean(invoiceId)} onClose={onClose} width={860} destroyOnHidden
    extra={sale.id && <Space>
      <Button icon={<EyeOutlined />} onClick={() => navigate(`/app/retail-sales/${sale.id}`)}>Full details</Button>
      <Button type="primary" icon={<PrinterOutlined />} onClick={() => navigate(`/app/retail-sales/${sale.id}/invoice`)}>Print invoice</Button>
    </Space>}
  >
    {saleQuery.loading ? <div style={{ padding: 60, textAlign: 'center' }}><Spin /></div> : !sale.id ? <Empty description="Invoice not found" /> : <>
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 18 }}>
        <Descriptions.Item label="Date">{dateLabel(sale.sale_date)}</Descriptions.Item>
        <Descriptions.Item label="Customer">{sale.customer?.name || 'Walk-in customer'}</Descriptions.Item>
        <Descriptions.Item label="Payment">{sale.paymentMethod?.name || sale.paymentAccount?.name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Status"><Tag color={sale.return_status === 'none' ? 'success' : 'orange'}>{sale.return_status === 'none' ? 'POSTED' : `${String(sale.return_status).toUpperCase()} RETURN`}</Tag></Descriptions.Item>
      </Descriptions>

      <Table rowKey="id" columns={itemColumns} dataSource={items} pagination={false} size="small" scroll={{ x: 760 }} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <div style={{ width: 330, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Subtotal</Text><Text>{money(sale.subtotal)}</Text></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Discount</Text><Text type="danger">− {money(sale.discount_amount)}</Text></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Tax</Text><Text>{money(sale.tax_amount)}</Text></div>
          {Number(sale.returned_amount || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Returned</Text><Text type="danger">− {money(sale.returned_amount)}</Text></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 10, fontSize: 17 }}><Text strong>Net sale</Text><Text strong>{money(Number(sale.total_amount || 0) - Number(sale.returned_amount || 0))}</Text></div>
        </div>
      </div>
      {sale.notes && <Alert style={{ marginTop: 18 }} type="info" message="Invoice note" description={sale.notes} />}
    </>}
  </Drawer>;
}

export default function OwnerProfitAndLoss() {
  const [preset, setPreset] = useState('today');
  const [range, setRange] = useState(() => presetRange('today'));
  const [salesView, setSalesView] = useState('invoices');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [expenseBreakdownOpen, setExpenseBreakdownOpen] = useState(false);
  const [expenseBreakdownPeriod, setExpenseBreakdownPeriod] = useState(() => presetRange('today'));

  const reportEndpoint = useMemo(() => {
    const from = range[0].format('YYYY-MM-DD');
    const to = range[1].format('YYYY-MM-DD');
    return `/reports/profit-loss?from=${from}&to=${to}&group_by=day`;
  }, [range]);

  const reportQuery = useApiData(reportEndpoint, {
    initialData: { summary: {}, trend: [], product_profitability: {} }
  });
  const salesQuery = useApiData('/retail-sales');
  const purchaseEndpoint = useMemo(() => `/reports/purchases?from=${range[0].format('YYYY-MM-DD')}&to=${range[1].format('YYYY-MM-DD')}`, [range]);
  const purchaseQuery = useApiData(purchaseEndpoint, { initialData: { summary: {}, rows: [] } });

  const invoices = useMemo(() => {
    const from = range[0].format('YYYY-MM-DD');
    const to = range[1].format('YYYY-MM-DD');
    return salesQuery.data.filter(sale => sale.sale_date >= from && sale.sale_date <= to);
  }, [range, salesQuery.data]);

  const invoiceSummary = useMemo(() => invoices.reduce((totals, sale) => {
    totals.discount += Number(sale.discount_amount || 0);
    totals.returns += Number(sale.returned_amount || 0);
    totals.netSales += Number(sale.subtotal || 0) - Number(sale.discount_amount || 0) - Number(sale.returned_revenue || 0);
    return totals;
  }, { discount: 0, returns: 0, netSales: 0 }), [invoices]);

  const dailyRows = useMemo(() => {
    const trend = Array.isArray(reportQuery.data.trend) ? reportQuery.data.trend : [];
    const days = new Map(trend.map(point => [point.period, {
      date: point.period,
      invoices: 0,
      gross: 0,
      discount: 0,
      returns: 0,
      net: 0,
      cogs: Number(point.cogs || 0),
      expenses: Number(point.operating_expenses || 0),
      netProfit: Number(point.net_profit || 0)
    }]));
    invoices.forEach(sale => {
      const row = days.get(sale.sale_date) || { date: sale.sale_date, invoices: 0, gross: 0, discount: 0, returns: 0, net: 0, cogs: 0, expenses: 0, netProfit: 0 };
      row.invoices += 1;
      row.gross += Number(sale.subtotal || 0);
      row.discount += Number(sale.discount_amount || 0);
      row.returns += Number(sale.returned_amount || 0);
      row.net += Number(sale.subtotal || 0) - Number(sale.discount_amount || 0) - Number(sale.returned_revenue || 0);
      days.set(sale.sale_date, row);
    });
    return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices, reportQuery.data.trend]);

  const summary = reportQuery.data.summary || {};
  const products = reportQuery.data.product_profitability?.products || [];
  const purchaseSummary = purchaseQuery.data.summary || {};
  const purchaseRows = Array.isArray(purchaseQuery.data.rows) ? purchaseQuery.data.rows : [];
  const averageInvoice = invoices.length ? invoiceSummary.netSales / invoices.length : 0;

  const selectPreset = value => {
    setPreset(value);
    if (value !== 'custom') setRange(presetRange(value));
  };
  const selectRange = values => {
    if (!values?.[0] || !values?.[1]) return;
    setRange(values);
    setPreset('custom');
  };

  const exportInvoices = () => {
    const headers = ['Date', 'Invoice', 'Customer', 'Items', 'Subtotal', 'Discount', 'Tax', 'Returns', 'Net total'];
    const rows = invoices.map(sale => [
      sale.sale_date, sale.sale_number, sale.customer?.name || 'Walk-in customer',
      (sale.retailSaleItems || []).length, sale.subtotal, sale.discount_amount, sale.tax_amount,
      sale.returned_amount, Number(sale.total_amount || 0) - Number(sale.returned_amount || 0)
    ]);
    const csv = [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sales-report-${range[0].format('YYYY-MM-DD')}-${range[1].format('YYYY-MM-DD')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportProducts = () => {
    const headers = ['Product', 'Code', 'Quantity sold', 'Invoices', 'Sales', 'Average price', 'Cost', 'Gross profit', 'Margin %'];
    const rows = products.map(item => [
      item.product_name, item.code, item.quantity, item.orders, item.revenue,
      item.average_selling_price, item.cogs, item.gross_profit, item.gross_margin_pct
    ]);
    const csv = [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `product-sales-${range[0].format('YYYY-MM-DD')}-${range[1].format('YYYY-MM-DD')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportPurchases = () => {
    const headers = ['Date', 'Invoice', 'Supplier', 'Receipt', 'Item', 'Type', 'Quantity', 'Unit', 'Unit cost', 'Tax %', 'Tax', 'Line total', 'Status'];
    const rows = purchaseRows.map(item => [item.invoice_date, item.invoice_number, item.supplier, item.receipt_number, item.item_name, item.material_type, item.quantity, item.unit, item.unit_price, item.tax_rate, item.tax_amount, item.line_total, item.status]);
    const csv = [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `purchase-report-${range[0].format('YYYY-MM-DD')}-${range[1].format('YYYY-MM-DD')}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  const invoiceColumns = [
    { title: 'Date', dataIndex: 'sale_date', width: 120, render: dateLabel },
    {
      title: 'Invoice', dataIndex: 'sale_number', width: 145,
      render: (value, sale) => <Button type="link" icon={<FileTextOutlined />} style={{ padding: 0, fontWeight: 650 }} onClick={event => { event.stopPropagation(); setSelectedInvoiceId(sale.id); }}>{value}</Button>
    },
    { title: 'Customer', width: 170, render: (_, sale) => sale.customer?.name || 'Walk-in customer' },
    {
      title: 'Product / variant', width: 280,
      render: (_, sale) => <Space direction="vertical" size={2}>
        {(sale.retailSaleItems || []).map(item => {
          const variant = item.finishedGood || {};
          const product = variant.product || {};
          const variantName = variant.size_label || (variant.name !== product.name ? variant.name : null) || variant.sku;
          return <div key={item.id}>
            <Text strong>{product.name || variant.name || 'Product'}</Text>
            {variantName && <Text type="secondary"> · {variantName}</Text>}
            <Tag style={{ marginLeft: 7 }}>{quantity(item.quantity)}</Tag>
          </div>;
        })}
      </Space>
    },
    { title: 'Items', width: 75, align: 'right', render: (_, sale) => (sale.retailSaleItems || []).length },
    { title: 'Subtotal', dataIndex: 'subtotal', width: 125, align: 'right', render: money },
    { title: 'Discount', dataIndex: 'discount_amount', width: 115, align: 'right', render: value => Number(value || 0) ? <Text type="danger">− {money(value)}</Text> : money(0) },
    { title: 'Tax', dataIndex: 'tax_amount', width: 105, align: 'right', render: money },
    { title: 'Returned', dataIndex: 'returned_amount', width: 115, align: 'right', render: value => Number(value || 0) ? <Tag color="orange">{money(value)}</Tag> : '—' },
    { title: 'Net total', width: 130, align: 'right', render: (_, sale) => <Text strong>{money(Number(sale.total_amount || 0) - Number(sale.returned_amount || 0))}</Text> },
    { title: '', width: 52, render: (_, sale) => <Button type="text" aria-label={`View ${sale.sale_number}`} icon={<EyeOutlined />} onClick={event => { event.stopPropagation(); setSelectedInvoiceId(sale.id); }} /> }
  ];

  const productColumns = [
    {
      title: 'Product', dataIndex: 'product_name', width: 230,
      render: (value, item) => <div><Text strong>{value}</Text><div><Text type="secondary" style={{ fontSize: 12 }}>{item.code || '—'}</Text></div></div>
    },
    { title: 'Qty sold', dataIndex: 'quantity', align: 'right', width: 100, render: quantity },
    { title: 'Invoices', dataIndex: 'orders', align: 'right', width: 95 },
    { title: 'Sales', dataIndex: 'revenue', align: 'right', width: 130, render: money },
    { title: 'Average price', dataIndex: 'average_selling_price', align: 'right', width: 130, render: money },
    { title: 'Cost', dataIndex: 'cogs', align: 'right', width: 125, render: money },
    { title: 'Gross profit', dataIndex: 'gross_profit', align: 'right', width: 140, render: value => <Text strong style={{ color: Number(value || 0) >= 0 ? '#16a34a' : '#dc2626' }}>{money(value)}</Text> },
    { title: 'Margin', dataIndex: 'gross_margin_pct', align: 'right', width: 105, render: value => <Tag color={value >= 30 ? 'green' : value >= 15 ? 'gold' : 'red'}>{percentage(value)}</Tag> }
  ];
  const purchaseColumns = [
    { title: 'Date', dataIndex: 'invoice_date', width: 120, render: dateLabel },
    { title: 'Invoice', dataIndex: 'invoice_number', width: 155, render: value => <Text strong>{value || '—'}</Text> },
    { title: 'Supplier', dataIndex: 'supplier', width: 170 },
    { title: 'Receipt', dataIndex: 'receipt_number', width: 145 },
    { title: 'Purchased item', width: 245, render: (_, item) => <div><Text strong>{item.item_name}</Text><div><Tag color="blue">{item.material_type}</Tag>{item.sku && <Text type="secondary">{item.sku}</Text>}</div></div> },
    { title: 'Qty', dataIndex: 'quantity', align: 'right', width: 90, render: quantity },
    { title: 'Unit cost', dataIndex: 'unit_price', align: 'right', width: 120, render: money },
    { title: 'Tax', width: 115, align: 'right', render: (_, item) => <div>{money(item.tax_amount)}<div><Text type="secondary">{percentage(item.tax_rate)}</Text></div></div> },
    { title: 'Line total', dataIndex: 'line_total', align: 'right', width: 130, render: value => <Text strong>{money(value)}</Text> },
    { title: 'Status', dataIndex: 'status', width: 105, render: value => <Tag color={value === 'paid' ? 'green' : value === 'draft' ? 'default' : 'orange'}>{String(value || '').toUpperCase()}</Tag> }
  ];

  if ((reportQuery.loading || salesQuery.loading || purchaseQuery.loading) && !reportQuery.data.period) return <div style={{ display: 'grid', placeItems: 'center', minHeight: 420 }}><Spin size="large" /></div>;

  return <div style={{ padding: 24, maxWidth: 1500, margin: '0 auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
      <div>
        <Text type="secondary" style={{ fontSize: 11, letterSpacing: 1.3 }}>SALES REPORT</Text>
        <Title level={2} style={{ margin: '3px 0', color: 'var(--color-gold)', fontFamily: "'Playfair Display', serif" }}>Daily Sales & Profit</Title>
        <Text type="secondary">Invoices, discounts, products and profit in one simple report.</Text>
      </div>
      <Space wrap>
        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
        <Button
          type="primary" icon={<DownloadOutlined />}
          onClick={salesView === 'invoices' ? exportInvoices : exportProducts}
          disabled={salesView === 'invoices' ? !invoices.length : !products.length}
        >Export {salesView}</Button>
      </Space>
    </div>

    <Card style={{ marginBottom: 16, borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
      <Space wrap size={12}>
        <Select value={preset} onChange={selectPreset} style={{ width: 145 }} options={[
          { value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' },
          { value: 'last_7_days', label: 'Last 7 days' }, { value: 'this_month', label: 'This month' },
          { value: 'custom', label: 'Custom range' }
        ]} />
        <RangePicker value={range} onChange={selectRange} allowClear={false} />
        {(reportQuery.loading || salesQuery.loading || purchaseQuery.loading) && <Spin size="small" />}
      </Space>
    </Card>

    {(reportQuery.error || salesQuery.error || purchaseQuery.error) && <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Could not load the report" description={(reportQuery.error || salesQuery.error || purchaseQuery.error)?.response?.data?.message || (reportQuery.error || salesQuery.error || purchaseQuery.error)?.message} />}

    <Row gutter={[14, 14]} style={{ marginBottom: 16 }}>
      <Col xs={12} md={8} xl={6} xxl={3}><SummaryCard title="Net sales" value={invoiceSummary.netSales} description="Gross sales − discounts − returned revenue" moneyValue color="#16a34a" /></Col>
      <Col xs={12} md={8} xl={6} xxl={3}><SummaryCard title="Invoices" value={invoices.length} description="Posted invoices in the selected dates" icon={<ShoppingCartOutlined />} color="#2563eb" /></Col>
      <Col xs={12} md={8} xl={6} xxl={3}><SummaryCard title="Discounts" value={invoiceSummary.discount} description="Total discount given on all invoices" moneyValue color="#dc2626" /></Col>
      <Col xs={12} md={8} xl={6} xxl={3}><SummaryCard title="Average invoice" value={averageInvoice} description="Net sales ÷ number of invoices" moneyValue color="#7c3aed" /></Col>
      <Col xs={12} md={8} xl={6} xxl={3}><SummaryCard title="Cost of goods" value={summary.cogs} description="Actual material and product cost, net of returns" moneyValue color="#d97706" /></Col>
      <Col xs={12} md={8} xl={6} xxl={3}><SummaryCard
        title="Operating expenses"
        value={summary.operating_expenses}
        description="Posted expenses within the selected dates"
        moneyValue
        color="#be123c"
        action={<Button type="link" size="small" style={{ padding: 0 }} onClick={() => { setExpenseBreakdownPeriod(range); setExpenseBreakdownOpen(true); }}>View breakdown</Button>}
      /></Col>
      <Col xs={12} md={8} xl={6} xxl={3}><SummaryCard title="Gross profit" value={summary.gross_profit} description="Net sales − cost of goods" moneyValue color={Number(summary.gross_profit || 0) >= 0 ? '#0284c7' : '#dc2626'} /></Col>
      <Col xs={12} md={8} xl={6} xxl={3}><SummaryCard title="Net profit" value={summary.net_profit} description="Gross profit − operating expenses" moneyValue color={Number(summary.net_profit || 0) >= 0 ? '#16a34a' : '#dc2626'} /></Col>
    </Row>

    <Card title="Daily totals" style={{ marginBottom: 16, borderRadius: 12 }} extra={<Text type="secondary">Profit and expenses use posted journal dates</Text>}>
      <Table
        rowKey="date" dataSource={dailyRows} pagination={false} size="small" scroll={{ x: 1120 }}
        locale={{ emptyText: <Empty description="No sales or expenses in this period" /> }}
        columns={[
          { title: 'Date', dataIndex: 'date', render: dateLabel },
          { title: 'Invoices', dataIndex: 'invoices', align: 'right' },
          { title: 'Gross sales', dataIndex: 'gross', align: 'right', render: money },
          { title: 'Discounts', dataIndex: 'discount', align: 'right', render: value => <Text type="danger">− {money(value)}</Text> },
          { title: 'Returns', dataIndex: 'returns', align: 'right', render: money },
          { title: 'Net sales', dataIndex: 'net', align: 'right', render: value => <Text strong style={{ color: '#16a34a' }}>{money(value)}</Text> },
          { title: 'Cost of goods', dataIndex: 'cogs', align: 'right', render: money },
          { title: 'Expenses', dataIndex: 'expenses', align: 'right', render: (value, row) => <Button type="link" style={{ padding: 0, color: '#be123c' }} onClick={() => { const date = dayjs(row.date); setExpenseBreakdownPeriod([date, date]); setExpenseBreakdownOpen(true); }}>{money(value)}</Button> },
          { title: 'Net profit', dataIndex: 'netProfit', align: 'right', render: value => <Text strong style={{ color: Number(value || 0) >= 0 ? '#16a34a' : '#dc2626' }}>{money(value)}</Text> }
        ]}
      />
    </Card>

    <Card
      title={<Space><ShoppingCartOutlined style={{ color: '#b64232' }} /><span>Detailed purchase report</span></Space>}
      style={{ marginBottom: 16, borderRadius: 12 }}
      extra={<Space wrap><Text type="secondary">Supplier invoices and received items</Text><Button icon={<DownloadOutlined />} onClick={exportPurchases} disabled={!purchaseRows.length}>Export purchases</Button></Space>}
    >
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Statistic title="Purchase invoices" value={purchaseSummary.invoices || 0} /></Col>
        <Col xs={12} sm={6}><Statistic title="Purchased value" value={purchaseSummary.total || 0} prefix="₹" precision={2} /></Col>
        <Col xs={12} sm={6}><Statistic title="Paid" value={purchaseSummary.paid || 0} prefix="₹" precision={2} valueStyle={{ color: '#16a34a' }} /></Col>
        <Col xs={12} sm={6}><Statistic title="Balance due" value={purchaseSummary.due || 0} prefix="₹" precision={2} valueStyle={{ color: '#dc2626' }} /></Col>
      </Row>
      <Table rowKey="id" columns={purchaseColumns} dataSource={purchaseRows} loading={purchaseQuery.loading} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: total => `${total} purchase lines` }} scroll={{ x: 1370 }} locale={{ emptyText: <Empty description="No purchases in this period" /> }} />
    </Card>

    <Card
      title={salesView === 'invoices' ? 'Invoice-wise sales' : 'Product-wise sales'}
      style={{ marginBottom: 16, borderRadius: 12 }}
      extra={<Space wrap>
        <Segmented value={salesView} onChange={setSalesView} options={[{ label: 'Invoice-wise', value: 'invoices' }, { label: 'Product-wise', value: 'products' }]} />
        {salesView === 'invoices' && <Text type="secondary">Click an invoice to see every item and discount</Text>}
      </Space>}
    >
      {salesView === 'invoices' ? <Table
          rowKey="id" columns={invoiceColumns} dataSource={invoices} loading={salesQuery.loading}
          onRow={sale => ({ onClick: () => setSelectedInvoiceId(sale.id), style: { cursor: 'pointer' } })}
          scroll={{ x: 1430 }} pagination={{ pageSize: 15, showSizeChanger: true, showTotal: total => `${total} invoices` }}
          locale={{ emptyText: <Empty description="No invoices in this period" /> }}
        /> : <Table
          rowKey="id" columns={productColumns} dataSource={products} loading={reportQuery.loading}
          scroll={{ x: 1050 }} pagination={{ pageSize: 15, showSizeChanger: true, showTotal: total => `${total} products` }}
          locale={{ emptyText: <Empty description="No products sold in this period" /> }}
        />}
    </Card>

    <InvoiceDrawer invoiceId={selectedInvoiceId} onClose={() => setSelectedInvoiceId(null)} />
    <ExpenseBreakdownDrawer
      open={expenseBreakdownOpen}
      onClose={() => setExpenseBreakdownOpen(false)}
      range={expenseBreakdownPeriod}
    />
  </div>;
}
