import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Button, Descriptions, Input, Modal, Segmented, Table, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';
import client from '../../api/client';
import { exportCsv, money, ReportShell, useReportRange } from '../reports/AccountingUI';
import usePrintPagination from '../reports/usePrintPagination';
import { AuthContext } from '../../context/AuthContext';

export default function JournalEntries() {
  const navigate=useNavigate();
  const [params]=useSearchParams();
  const { user }=useContext(AuthContext);
  const canManage=['admin','super_admin','accountant'].includes(user?.role);
  const period=useReportRange();
  const pagination=usePrintPagination();
  const query=useApiData('/journal-entries');
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('All');
  const [selected,setSelected]=useState(null);
  const [posting,setPosting]=useState(null);
  const rows=query.data.filter(row=>row.entry_date>=period.from && row.entry_date<=period.to);
  const filtered=rows.filter(row=>(status==='All' || row.status===status.toLowerCase()) && (row.entry_number+' '+row.narration+' '+row.reference_type).toLowerCase().includes(search.toLowerCase()));
  const view=useCallback(async row=>{try {setSelected((await client.get('/journal-entries/'+row.id)).data);}catch(error){message.error(error.response?.data?.message || 'Could not load journal');}},[]);
  useEffect(()=>{ const id=params.get('entry'); if(id) view({id}); },[params,view]);
  const post=async row=>{setPosting(row.id);try{await client.post('/journal-entries/'+row.id+'/post');message.success('Journal posted');setSelected(null);await query.reload();}catch(error){message.error(error.response?.data?.message || 'Could not post journal');}finally{setPosting(null);}};
  const columns=[{title:'Entry',dataIndex:'entry_number',width:170,render:(_,row)=><button className="ar-ledger-link" onClick={()=>view(row)}>{row.entry_number}</button>},{title:'Date',dataIndex:'entry_date',width:110},{title:'Source',dataIndex:'reference_type',render:value=>value?.replaceAll('_',' ')},{title:'Narration',dataIndex:'narration'},{title:'Debit',dataIndex:'total_debit',align:'right',render:money},{title:'Credit',dataIndex:'total_credit',align:'right',render:money},{title:'Status',dataIndex:'status',render:value=><Tag color={value==='posted'?'success':'warning'}>{value==='posted'?'Posted':'Draft'}</Tag>}];
  return <><ReportShell title="Journal entries" subtitle="Inspect every debit and credit, follow its source, and review drafts before posting." query={query} periodLabel={period.from+' to '+period.to} basis="Draft & posted journals · INR" controls={<>{period.controls}{canManage && <Button type="primary" icon={<PlusOutlined/>} onClick={()=>navigate('/app/journal-entries/new')}>New journal entry</Button>}</>} onExport={()=>exportCsv('journals-'+period.from+'-'+period.to+'.csv',[['Journal entries',period.from,period.to],['Entry','Date','Source','Narration','Debit','Credit','Status'],...filtered.map(row=>[row.entry_number,row.entry_date,row.reference_type,row.narration,Number(row.total_debit),Number(row.total_credit),row.status])])}>
    <div className="ar-metrics">{[['Total entries',rows.length],['Posted',rows.filter(row=>row.status==='posted').length],['Drafts',rows.filter(row=>row.status==='draft').length],['Source types',new Set(rows.map(row=>row.reference_type)).size]].map(([label,count])=><div key={label} className="ar-metric"><span>{label}</span><strong>{count}</strong><small>In the selected period</small></div>)}</div>
    <div className="ar-table-card"><div className="ar-table-tools"><Input.Search aria-label="Search journals" value={search} onChange={event=>setSearch(event.target.value)} allowClear placeholder="Search entry, source or narration"/><Segmented value={status} options={['All','Posted','Draft']} onChange={setStatus}/></div><Table rowKey="id" columns={columns} dataSource={filtered} pagination={pagination} scroll={{x:1100}}/></div>
  </ReportShell><Modal title={selected?.entry_number || 'Journal entry'} open={!!selected} onCancel={()=>setSelected(null)} width={800} footer={canManage && selected?.status==='draft' ? <Button type="primary" loading={posting===selected.id} onClick={()=>post(selected)}>Post journal</Button> : null}>
    {selected && <><Descriptions column={2} items={[{key:'date',label:'Date',children:selected.entry_date},{key:'status',label:'Status',children:selected.status},{key:'narration',label:'Narration',span:2,children:selected.narration}]}/><Table style={{marginTop:20}} rowKey="id" dataSource={selected.journalEntryLines || []} pagination={false} scroll={{x:600}} columns={[{title:'Account',render:(_,row)=>row.account ? row.account.code+' · '+row.account.name : 'Account unavailable'},{title:'Description',dataIndex:'description'},{title:'Debit',dataIndex:'debit',align:'right',render:money},{title:'Credit',dataIndex:'credit',align:'right',render:money}]}/></>}
  </Modal></>;
}
