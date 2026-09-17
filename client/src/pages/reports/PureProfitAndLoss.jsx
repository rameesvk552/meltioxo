import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Segmented, Space, Spin, Typography } from 'antd';
import { DownloadOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import useApiData from '../../hooks/useApiData';
import './PureProfitAndLoss.css';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

const money = value => {
  const amount = Number(value || 0);
  const formatted = Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return amount < 0 ? `(₹${formatted})` : `₹${formatted}`;
};

const financialYearRange = (date = dayjs(), offset = 0) => {
  const startYear = (date.month() >= 3 ? date.year() : date.year() - 1) + offset;
  const start = dayjs(`${startYear}-04-01`);
  const end = offset === 0 ? date : start.add(1, 'year').subtract(1, 'day');
  return [start, end];
};

const presetRange = preset => {
  const today = dayjs();
  if (preset === 'This month') return [today.startOf('month'), today];
  if (preset === 'Last FY') return financialYearRange(today, -1);
  return financialYearRange(today);
};

const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

function StatementRow({ code, label, value, total = false, result = false }) {
  return <div className={`pl-row${total ? ' pl-row--total' : ''}${result ? ' pl-row--result' : ''}${result && Number(value || 0) < 0 ? ' is-loss' : ''}`}>
    <div className="pl-row__label">
      {code && <span className="pl-row__code">{code}</span>}
      <span>{label}</span>
    </div>
    <span className={`pl-row__amount${Number(value || 0) < 0 ? ' is-negative' : ''}`}>{money(value)}</span>
  </div>;
}

function AccountSection({ title, rows, emptyLabel }) {
  return <section className="pl-section">
    <h3>{title}</h3>
    {rows.length
      ? rows.map(row => <StatementRow key={row.id || row.code} code={row.code} label={row.name} value={row.amount} />)
      : <div className="pl-empty-row">{emptyLabel}</div>}
  </section>;
}

export default function PureProfitAndLoss({ embedded = false }) {
  const [preset, setPreset] = useState('This FY');
  const [range, setRange] = useState(() => presetRange('This FY'));
  const endpoint = useMemo(() => {
    const [from, to] = range;
    return `/reports/profit-loss-statement?from=${from.format('YYYY-MM-DD')}&to=${to.format('YYYY-MM-DD')}`;
  }, [range]);
  const { data, loading, error, reload } = useApiData(endpoint, { initialData: {} });
  const summary = data.summary || {};
  const accounts = data.accounts || {};
  const revenue = Array.isArray(accounts.revenue) ? accounts.revenue : [];
  const directCosts = Array.isArray(accounts.cogs) ? accounts.cogs : [];
  const expenses = Array.isArray(accounts.operating_expenses) ? accounts.operating_expenses : [];

  const choosePreset = value => {
    setPreset(value);
    setRange(presetRange(value));
  };

  const chooseRange = dates => {
    if (!dates?.[0] || !dates?.[1]) return;
    setPreset('Custom');
    setRange(dates);
  };

  const exportCsv = () => {
    const rows = [
      ['Profit & Loss Statement'],
      ['Period', `${range[0].format('DD MMM YYYY')} to ${range[1].format('DD MMM YYYY')}`],
      [],
      ['Income'],
      ...revenue.map(row => [row.code, row.name, Number(row.amount || 0).toFixed(2)]),
      ['', 'Total income', Number(summary.revenue || 0).toFixed(2)],
      [],
      ['Cost of goods sold / direct costs'],
      ...directCosts.map(row => [row.code, row.name, Number(row.amount || 0).toFixed(2)]),
      ['', 'Total direct costs', Number(summary.cogs || 0).toFixed(2)],
      ['', 'Gross profit', Number(summary.gross_profit || 0).toFixed(2)],
      [],
      ['Operating expenses'],
      ...expenses.map(row => [row.code, row.name, Number(row.amount || 0).toFixed(2)]),
      ['', 'Total operating expenses', Number(summary.operating_expenses || 0).toFixed(2)],
      ['', Number(summary.net_profit || 0) >= 0 ? 'Net profit' : 'Net loss', Number(summary.net_profit || 0).toFixed(2)]
    ];
    const blob = new Blob([rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `profit-loss-${range[0].format('YYYY-MM-DD')}-${range[1].format('YYYY-MM-DD')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <div className={`profit-loss-page${embedded ? ' profit-loss-page--embedded' : ''}`}>
    {!embedded && <header className="pl-page-header">
      <div><Text className="pl-eyebrow">ACCOUNTS</Text><Title level={2}>Profit &amp; Loss</Title></div>
      <Space wrap className="pl-actions">
        <Button icon={<DownloadOutlined />} onClick={exportCsv}>Export CSV</Button>
        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
      </Space>
    </header>}

    <Card className="pl-filter-card no-print" styles={{ body: { padding: 16 } }}>
      <div className="pl-filters">
        <Segmented value={preset} options={['This month', 'This FY', 'Last FY']} onChange={choosePreset} />
        <RangePicker value={range} allowClear={false} onChange={chooseRange} format="DD MMM YYYY" />
        <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>Refresh</Button>
        {embedded && <Space className="pl-embedded-actions">
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>Export</Button>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
        </Space>}
      </div>
    </Card>

    {error && <Alert
      type="error"
      showIcon
      message="Could not load the Profit & Loss statement"
      description={error.response?.data?.message || error.message}
      action={<Button size="small" onClick={reload}>Try again</Button>}
      style={{ marginBottom: 16 }}
    />}

    <Card className="profit-loss-statement" styles={{ body: { padding: 0 } }}>
      <div className="pl-statement-header">
        <div>
          <span className="pl-statement-kicker">FINANCIAL STATEMENT</span>
          <h2>Profit &amp; Loss Account</h2>
          <p>{range[0].format('DD MMM YYYY')} to {range[1].format('DD MMM YYYY')}</p>
        </div>
        <div className="pl-basis"><span>Basis</span><strong>Posted journals</strong></div>
      </div>

      {loading ? <div className="pl-loading"><Spin /><span>Preparing statement from posted journal entries…</span></div> : <div className="pl-statement-body">
        <AccountSection title="Income" rows={revenue} emptyLabel="No income posted in this period" />
        <StatementRow label="Total income" value={summary.revenue} total />

        <AccountSection title="Cost of goods sold / direct costs" rows={directCosts} emptyLabel="No direct costs posted in this period" />
        <StatementRow label="Total direct costs" value={summary.cogs} total />
        <StatementRow label="Gross profit" value={summary.gross_profit} result />

        <AccountSection title="Operating expenses" rows={expenses} emptyLabel="No operating expenses posted in this period" />
        <StatementRow label="Total operating expenses" value={summary.operating_expenses} total />

        <div className={`pl-net-result${Number(summary.net_profit || 0) < 0 ? ' is-loss' : ''}`}>
          <div><span>{Number(summary.net_profit || 0) >= 0 ? 'Net profit' : 'Net loss'}</span><small>for the selected period</small></div>
          <strong>{money(summary.net_profit)}</strong>
        </div>
      </div>}

      <footer className="pl-statement-footer">This statement includes only revenue and expense entries from posted double-entry journals.</footer>
    </Card>
  </div>;
}
