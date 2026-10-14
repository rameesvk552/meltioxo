import React, { useContext, useState } from 'react';
import { Alert, Button, DatePicker, Segmented, Skeleton, Space, Tag } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { AuthContext } from '../../context/AuthContext';
import './AccountingReports.css';
import { downloadReport } from './reportDownloads';

export const money = value => {
  const amount = Number(value || 0);
  const formatted = Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount < 0 ? `(₹${formatted})` : `₹${formatted}`;
};
export const fyRange = (date = dayjs()) => [dayjs(`${date.month() >= 3 ? date.year() : date.year()-1}-04-01`), date];
export function useReportRange() {
  const [range, setRange] = useState(() => fyRange());
  const [preset, setPreset] = useState('This FY');
  const choosePreset = value => {
    const today = dayjs();
    setPreset(value);
    setRange(value === 'This month' ? [today.startOf('month'), today] : value === 'Last month'
      ? [today.subtract(1, 'month').startOf('month'), today.subtract(1, 'month').endOf('month')] : fyRange());
  };
  return { range, setRange, from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'),
    controls: <><Segmented aria-label="Reporting period" value={preset} options={['This month', 'Last month', 'This FY']} onChange={choosePreset} />
      <DatePicker.RangePicker aria-label="Custom reporting period" value={range} allowClear={false} format="DD MMM YYYY" onChange={value => { if (value?.[0] && value?.[1]) { setRange(value); setPreset('Custom'); } }} /></> };
}
export function exportCsv(filename, rows) {
  const cell = value => {
    // Prevent spreadsheet formula execution when a user-controlled name is exported.
    const text = String(value ?? '');
    const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const url = URL.createObjectURL(new Blob(['\uFEFF', rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}
export function ReportShell({ title, subtitle, query, controls, onExport, children, embedded = false, basis = 'Accrual basis · Posted entries · INR', periodLabel }) {
  const navigate = useNavigate();
  const { branches = [], branchId } = useContext(AuthContext) || {};
  const branch = branches.find(item => item.id === branchId) || branches.find(item => item.is_default);
  return <main className={`accounting-report${embedded ? ' accounting-report--embedded' : ''}`}>
    <header className="ar-heading no-print"><div>
      {!embedded && <Button className="ar-back" type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/accounts')}>Accounting workspace</Button>}
      <span className="ar-eyebrow">FINANCIAL REPORTS</span><h1>{title}</h1><p>{subtitle}</p>
    </div><Space wrap><Button icon={<DownloadOutlined />} onClick={() => downloadReport(onExport(), 'xlsx')} disabled={query.loading || !!query.error}>Excel</Button><Button icon={<DownloadOutlined />} onClick={() => downloadReport(onExport(), 'pdf')} disabled={query.loading || !!query.error}>PDF</Button><Button icon={<PrinterOutlined />} onClick={() => window.print()} disabled={query.loading || !!query.error}>Print</Button></Space></header>
    <div className="ar-toolbar no-print"><div className="ar-filter-controls">{controls}</div><Button icon={<ReloadOutlined />} onClick={query.reload} loading={query.loading}>Refresh</Button></div>
    <div className="ar-scope"><Tag>{branch?.name || 'Company'}</Tag><span>{basis}</span></div>
    {query.error ? <Alert showIcon type="error" message={`Could not load ${title.toLowerCase()}`} description={query.error.response?.data?.message || query.error.message} action={<Button onClick={query.reload}>Retry</Button>} />
      : query.loading ? <div className="ar-loading"><Skeleton active paragraph={{ rows: 8 }} /></div> : <div className="accounting-print-area"><div className="ar-print-heading"><h1>{title}</h1><p>{branch?.name || 'Company'} · {periodLabel || (query.data.period ? `${query.data.period.from} to ${query.data.period.to}` : query.data.as_of || dayjs().format('DD MMM YYYY'))}</p><p>{basis}</p></div>{children}</div>}
  </main>;
}
export function Metric({ label, value, detail, tone = '' }) {
  return <div className={`ar-metric ${tone}`}><span>{label}</span><strong>{money(value)}</strong>{detail && <small>{detail}</small>}</div>;
}
export function StatementLine({ label, value, code, total = false, onClick }) {
  return <div className={`ar-statement-line${total ? ' is-total' : ''}`}><div>{code && <span className="ar-code">{code}</span>}{onClick ? <button className="ar-ledger-link" onClick={onClick}>{label}</button> : <span>{label}</span>}</div><strong className={Number(value) < 0 ? 'ar-negative' : ''}>{money(value)}</strong></div>;
}
