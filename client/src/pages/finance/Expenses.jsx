import React, { useState } from 'react';
import { Button, Input, Segmented, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';
import { exportCsv, Metric, money, ReportShell, useReportRange } from '../reports/AccountingUI';
import usePrintPagination from '../reports/usePrintPagination';

export default function Expenses() {
  const navigate = useNavigate();
  const period = useReportRange();
  const pagination = usePrintPagination();
  const [search,setSearch] = useState('');
  const [status,setStatus] = useState('All');
  const query = useApiData('/expenses');
  const rows=query.data.filter(row=>row.expense_date>=period.from && row.expense_date<=period.to);
  const filtered=rows.filter(row=>(status==='All' || row.status===(status==='Posted'?'approved':'draft')) && (row.expense_number+' '+row.description+' '+row.category).toLowerCase().includes(search.toLowerCase()));
  const sum=state=>rows.filter(row=>row.status===state).reduce((total,row)=>total+Math.round(Number(row.amount)*100),0)/100;
  const columns=[{title:'Number',dataIndex:'expense_number',width:160},{title:'Date',dataIndex:'expense_date',width:110},{title:'Description',dataIndex:'description'},{title:'Category',dataIndex:'category'},{title:'Payment method',render:(_,row)=>row.paymentMethod?.name || row.payment_mode?.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase())},{title:'Amount',dataIndex:'amount',align:'right',render:money},{title:'Status',dataIndex:'status',render:value=><Tag color={value==='approved'?'success':'warning'}>{value==='approved'?'Posted':'Draft'}</Tag>}];
  return <ReportShell title="Expenses" subtitle="Track operating costs, payment methods, and which entries affect your accounts." query={query} periodLabel={period.from+' to '+period.to} basis="Expense records · INR" controls={<>{period.controls}<Button type="primary" icon={<PlusOutlined/>} onClick={()=>navigate('/app/expenses/new')}>Record expense</Button></>} onExport={()=>exportCsv('expenses-'+period.from+'-'+period.to+'.csv',[['Expenses',period.from,period.to],['Number','Date','Description','Category','Method','Amount','Status'],...filtered.map(row=>[row.expense_number,row.expense_date,row.description,row.category,row.paymentMethod?.name || row.payment_mode,Number(row.amount),row.status])])}>
    <div className="ar-metrics"><Metric label="Posted expenses" value={sum('approved')}/><Metric label="Draft expenses" value={sum('draft')} detail="Not included in financial statements"/><div className="ar-metric"><span>Expense records</span><strong>{rows.length}</strong><small>In the selected period</small></div><div className="ar-metric"><span>Drafts awaiting review</span><strong>{rows.filter(row=>row.status==='draft').length}</strong></div></div>
    <div className="ar-table-card"><div className="ar-table-tools"><Input.Search aria-label="Search expenses" value={search} onChange={event=>setSearch(event.target.value)} allowClear placeholder="Search number, description or category"/><Segmented value={status} options={['All','Posted','Draft']} onChange={setStatus}/></div><Table rowKey="id" columns={columns} dataSource={filtered} pagination={pagination} scroll={{x:950}}/></div>
  </ReportShell>;
}
