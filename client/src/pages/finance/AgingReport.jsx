import React, { useContext, useState } from 'react';
import { Button, Input, Select, Table, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import useApiData from '../../hooks/useApiData';
import { AuthContext } from '../../context/AuthContext';
import { hasViewPermission } from '../../config/permissions';
import { exportCsv, Metric, money, ReportShell } from '../reports/AccountingUI';
import usePrintPagination from '../reports/usePrintPagination';

export default function AgingReport({ payable = false }) {
  const pagination = usePrintPagination();
  const [search, setSearch] = useState('');
  const [bucket, setBucket] = useState('all');
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const query = useApiData(`/reports/aging-${payable ? 'payables' : 'receivables'}`, { initialData: {} });
  const report = query.data;
  const key = payable ? 'supplier' : 'customer';
  const rows = (report.invoices || []).filter(row => `${row.id} ${row[key]}`.toLowerCase().includes(search.toLowerCase()) && (bucket === 'all' || row.status === bucket));
  const total = ['current','1-30','31-60','60+'].reduce((sum,key) => sum+Math.round(Number(report[key] || 0)*100),0)/100;
  const columns = [{ title: payable ? 'Supplier' : 'Customer', dataIndex: key },{ title: 'Invoice', dataIndex: 'id' },{ title: 'Due date', dataIndex: 'due' },{ title: 'Invoice total', dataIndex: 'amount', align: 'right', render: money },{ title: 'Outstanding', dataIndex: 'balance', align: 'right', render: value=><strong>{money(value)}</strong> },{ title: 'Age', dataIndex: 'status', render: value=><Tag color={value==='Current' ? 'success' : value==='60+ Days' ? 'error' : 'warning'}>{value==='Current' ? 'Not overdue' : value}</Tag> },
    ...(hasViewPermission(user,'finance.payments') ? [{ title:'',render:(_,row)=><Button size="small" onClick={()=>navigate(`/app/payments/new?type=${payable ? 'outgoing' : 'incoming'}&party_id=${row.party_id || ''}`)}>{payable ? 'Pay supplier' : 'Record receipt'}</Button> }] : [])];
  return <ReportShell title={payable ? 'Accounts payable' : 'Accounts receivable'} subtitle={payable ? 'Outstanding supplier invoices, ordered by due date.' : 'Outstanding customer invoices and collections to follow up.'} query={query} basis="Open invoice balances · INR" controls={<span>Current position · {dayjs().format('DD MMM YYYY')}</span>} onExport={()=>exportCsv(`${payable ? 'payables' : 'receivables'}-${dayjs().format('YYYY-MM-DD')}.csv`, [['Outstanding invoices',dayjs().format('YYYY-MM-DD')],['Party','Invoice','Due date','Invoice total','Outstanding','Days overdue'],...rows.map(row=>[row[key],row.id,row.due,row.amount,row.balance,row.daysOverdue])])}>
    <div className="ar-metrics"><Metric label="Total outstanding" value={total} /><Metric label="Not overdue" value={report.current} /><Metric label="Overdue" value={total-Number(report.current || 0)} tone={total-Number(report.current || 0)>0 ? 'negative' : ''} /><Metric label="Over 60 days overdue" value={report['60+']} detail="Priority follow-up" /></div>
    <div className="ar-table-card"><div className="ar-table-tools"><Input.Search aria-label="Search outstanding invoices" placeholder="Search party or invoice" value={search} onChange={event=>setSearch(event.target.value)} allowClear /><Select aria-label="Filter invoice aging" value={bucket} onChange={setBucket} style={{ minWidth:170 }} options={['all','Current','1-30 Days','31-60 Days','60+ Days'].map(value=>({value,label:value==='all' ? 'All aging buckets' : value==='Current' ? 'Not overdue' : value}))} /><span>{rows.length} invoices</span></div><Table rowKey="invoice_id" dataSource={rows} columns={columns} scroll={{x:950}} pagination={pagination} /></div>
    <p className="ar-footnote">Outstanding balances are invoice totals less amounts paid, as of today. This subledger excludes draft and fully paid invoices. It should be reconciled to the general ledger.</p>
  </ReportShell>;
}
