import React, { useState } from 'react';
import { Input, Table, Tag } from 'antd';
import useApiData from '../../hooks/useApiData';
import usePrintPagination from './usePrintPagination';
import { Metric, money, ReportShell, useReportRange } from './AccountingUI';
import { reportData } from './reportDownloads';

export default function CashMovements({ embedded = false }) {
  const period = useReportRange();
  const pagination = usePrintPagination();
  const [search, setSearch] = useState('');
  const query = useApiData(`/reports/cash-flow?from=${period.from}&to=${period.to}`, { initialData: {} });
  const summary = query.data.summary || {};
  const rows = (query.data.data || []).filter(row => `${row.reference} ${row.description} ${row.account}`.toLowerCase().includes(search.toLowerCase()));
  const columns = [{ title: 'Date', dataIndex: 'date', width: 110 },{ title: 'Reference', dataIndex: 'reference', width: 160 },{ title: 'Account / description', render: (_,row)=><div><strong>{row.account}</strong><div style={{ color: '#8b7e6e', fontSize: 12 }}>{row.description}</div></div> },
    { title: 'Inflow', dataIndex: 'inflow', align: 'right', render: value => value ? money(value) : '—' },{ title: 'Outflow', dataIndex: 'outflow', align: 'right', render: value => value ? money(value) : '—' },{ title: 'Internal transfer', dataIndex: 'transfer', align: 'right', render: value => value ? <Tag>{money(value)}</Tag> : '—' }];
  return <ReportShell title="Cash & bank movements" subtitle="Opening balance, money in, money out, and closing balance for the selected period." embedded={embedded} query={query} controls={period.controls} onExport={() => reportData(`cash-bank-${period.from}-${period.to}.csv`, [['Cash & bank movements',period.from,period.to],['Date','Reference','Account','Description','Inflow','Outflow','Internal transfer','Cash & bank balance'],['Opening balance','','','','','','',Number(summary.opening_balance || 0)],...rows.map(row=>[row.date,row.reference,row.account,row.description,row.inflow,row.outflow,row.transfer,'']),['Closing balance','','','','','','',Number(summary.closing_balance || 0)]])}>
    <div className="ar-metrics"><Metric label="Opening cash & bank" value={summary.opening_balance} /><Metric label="Money in" value={summary.inflow} tone="positive" /><Metric label="Money out" value={summary.outflow} /><Metric label="Closing cash & bank" value={summary.closing_balance} detail={`Net movement ${money(summary.net)}`} /></div>
    <div className="ar-table-card"><div className="ar-table-tools"><Input.Search aria-label="Search cash movements" placeholder="Search reference, account or description" value={search} allowClear onChange={event=>setSearch(event.target.value)} /><span>{rows.length} movements</span></div><Table rowKey="id" columns={columns} dataSource={rows} pagination={pagination} scroll={{ x: 950 }} /></div>
    <p className="ar-footnote">Cash and bank legs are netted within each journal so internal transfers do not inflate inflows or outflows. This is a cash movement register; it does not classify operating, investing, and financing cash flows.</p>
  </ReportShell>;
}
