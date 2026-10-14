import React from 'react';
import { Empty, Table } from 'antd';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useApiData from '../../hooks/useApiData';
import { Metric, money, ReportShell, useReportRange } from './AccountingUI';
import { reportData } from './reportDownloads';

export default function ManagementReport({ embedded = false }) {
  const period = useReportRange();
  const query = useApiData(`/reports/management?from=${period.from}&to=${period.to}`, { initialData: {} });
  const summary = query.data.summary || {};
  const trend = query.data.trend || [];
  const expenses = query.data.accounts?.operating_expenses || [];
  const columns = [{ title: 'Month', dataIndex: 'label', fixed: 'left', width: 110 },
    ...[['revenue','Income'],['cogs','Direct costs'],['gross_profit','Gross profit'],['operating_expenses','Operating expenses'],['net_profit','Net profit / loss']].map(([key,title]) => ({ title, dataIndex: key, align: 'right', render: value => <span className={value < 0 ? 'ar-negative' : ''}>{money(value)}</span> }))];
  return <ReportShell title="Management report" subtitle="Monthly performance and expense composition for decisions grounded in your accounts." embedded={embedded} query={query} controls={period.controls} onExport={() => reportData(`management-${period.from}-${period.to}.csv`, [['MIS',period.from,period.to],['Month','Income','Direct costs','Gross profit','Operating expenses','Net profit'],...trend.map(row=>[row.period,row.revenue,row.cogs,row.gross_profit,row.operating_expenses,row.net_profit])])}>
    <div className="ar-metrics"><Metric label="Income" value={summary.revenue} /><Metric label="Gross profit" value={summary.gross_profit} detail={`${summary.gross_margin_pct || 0}% margin`} /><Metric label="Operating expenses" value={summary.operating_expenses} /><Metric label="Net profit / loss" value={summary.net_profit} detail={`${summary.net_margin_pct || 0}% margin`} tone={summary.net_profit < 0 ? 'negative' : 'positive'} /></div>
    <div className="ar-split"><div className="ar-table-card"><h2>Income & profitability</h2><div className="ar-chart"><ResponsiveContainer><LineChart data={trend} margin={{ left: 10, right: 20, top: 10, bottom: 5 }}><CartesianGrid stroke="#eee5d8" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis width={65} tick={{ fontSize: 11 }} tickFormatter={value=>`${value/1000}k`} /><Tooltip formatter={money} /><Legend /><Line type="monotone" dataKey="revenue" name="Income" stroke="#ac6848" strokeWidth={2} /><Line type="monotone" dataKey="net_profit" name="Net profit" stroke="#327350" strokeWidth={2} /></LineChart></ResponsiveContainer></div></div>
      <div className="ar-table-card"><h2>Where operating expenses go</h2>{expenses.length ? expenses.map(row=><div key={row.id}><div className="ar-statement-line"><span>{row.name}</span><strong>{money(row.amount)}</strong></div><div className="ar-progress-bar"><div style={{ width: `${summary.operating_expenses > 0 ? Math.min(100,Math.max(0,row.amount/summary.operating_expenses*100)) : 0}%` }} /></div></div>) : <Empty description="No operating expenses posted" />}</div></div>
    <div className="ar-table-card"><h2>Month by month</h2><Table rowKey="period" columns={columns} dataSource={trend} pagination={false} scroll={{ x: 950 }} /></div>
    <p className="ar-footnote">This MIS uses posted revenue and expense journals. Inventory purchases and production transfers affect assets until their cost is recognised as an expense.</p>
  </ReportShell>;
}
