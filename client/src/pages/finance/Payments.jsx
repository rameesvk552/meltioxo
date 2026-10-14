import React, { useState } from 'react';
import { Button, Input, Segmented, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';
import { Metric, money, ReportShell, useReportRange } from '../reports/AccountingUI';
import { reportData } from '../reports/reportDownloads';
import usePrintPagination from '../reports/usePrintPagination';

export default function Payments() {
  const navigate = useNavigate();
  const period = useReportRange();
  const pagination = usePrintPagination();
  const [direction, setDirection] = useState('All');
  const [search, setSearch] = useState('');
  const query = useApiData('/payments');
  const rows = query.data.filter(row => row.payment_date >= period.from && row.payment_date <= period.to);
  const filtered = rows.filter(row => (direction === 'All' || row.payment_type === (direction === 'Receipts' ? 'incoming' : 'outgoing')) && (row.payment_number+' '+row.party_name+' '+row.reference_number).toLowerCase().includes(search.toLowerCase()));
  const sum = type => rows.filter(row=>row.payment_type===type).reduce((total,row)=>total+Math.round(Number(row.amount)*100),0)/100;
  const columns=[{title:'Number',dataIndex:'payment_number',width:160},{title:'Date',dataIndex:'payment_date',width:110},{title:'Party',dataIndex:'party_name',render:value=>value || 'Walk-in customer'},{title:'Method',render:(_,row)=>row.paymentMethod?.name || row.payment_mode?.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase())},{title:'Direction',dataIndex:'payment_type',render:value=><Tag color={value==='incoming'?'success':'default'}>{value==='incoming'?'Receipt':'Payment'}</Tag>},{title:'Amount',dataIndex:'amount',align:'right',render:money},{title:'Reference',dataIndex:'reference_number'}];
  return <ReportShell title="Receipts & payments" subtitle="A searchable money register with party, payment method, and reference details." query={query} periodLabel={period.from+' to '+period.to} basis="Payment records · INR" controls={<>{period.controls}<Button type="primary" icon={<PlusOutlined/>} onClick={()=>navigate('/app/payments/new')}>Record receipt / payment</Button></>} onExport={()=>reportData('payments-'+period.from+'-'+period.to+'.csv',[['Payments',period.from,period.to],['Number','Date','Party','Direction','Method','Amount','Reference'],...filtered.map(row=>[row.payment_number,row.payment_date,row.party_name,row.payment_type,row.paymentMethod?.name || row.payment_mode,Number(row.amount),row.reference_number])])}>
    <div className="ar-metrics"><Metric label="Receipts" value={sum('incoming')} tone="positive"/><Metric label="Payments" value={sum('outgoing')}/><Metric label="Net receipts less payments" value={sum('incoming')-sum('outgoing')}/><div className="ar-metric"><span>Recorded movements</span><strong>{rows.length}</strong><small>In the selected period</small></div></div>
    <div className="ar-table-card"><div className="ar-table-tools"><Input.Search aria-label="Search payments" value={search} onChange={event=>setSearch(event.target.value)} allowClear placeholder="Search number, party or reference"/><Segmented value={direction} options={['All','Receipts','Payments']} onChange={setDirection}/></div><Table rowKey="id" columns={columns} dataSource={filtered} pagination={pagination} scroll={{x:950}}/></div>
    <p className="ar-footnote">This register lists payment records. POS collections and other direct cash postings are included in the Cash & Bank Movements report.</p>
  </ReportShell>;
}
