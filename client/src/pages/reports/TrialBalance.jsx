import React, { useContext, useState } from 'react';
import { Alert, DatePicker, Input, Select, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import useApiData from '../../hooks/useApiData';
import { AuthContext } from '../../context/AuthContext';
import { hasViewPermission } from '../../config/permissions';
import { fyRange, Metric, money, ReportShell } from './AccountingUI';
import { reportData } from './reportDownloads';
import LedgerDrawer from './LedgerDrawer';

export default function TrialBalance({ embedded = false }) {
  const [date, setDate] = useState(dayjs());
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [ledger, setLedger] = useState(null);
  const { user } = useContext(AuthContext);
  const query = useApiData('/reports/trial-balance?as_of='+date.format('YYYY-MM-DD'));
  const rows = query.data;
  const cents = value => Math.round(Number(value || 0)*100);
  const debit = rows.reduce((sum, row) => sum+cents(row.debit), 0)/100;
  const credit = rows.reduce((sum, row) => sum+cents(row.credit), 0)/100;
  const difference = (cents(debit)-cents(credit))/100;
  const filtered = rows.filter(row => (type === 'all' || row.type === type) && (row.code+' '+row.name).toLowerCase().includes(search.toLowerCase()));
  const columns = [{ title: 'Code', dataIndex: 'code', width: 100 }, { title: 'Account', dataIndex: 'name', render: (_, row) => hasViewPermission(user, 'finance.accounts') ? <button className="ar-ledger-link" onClick={() => setLedger(row)}>{row.name}</button> : row.name },
    { title: 'Type', dataIndex: 'type', render: value => <Tag>{value}</Tag> },
    { title: 'Debit balance', dataIndex: 'debit', align: 'right', render: value => value ? money(value) : '—' },
    { title: 'Credit balance', dataIndex: 'credit', align: 'right', render: value => value ? money(value) : '—' }];
  const sum = key => filtered.reduce((total,row)=>total+cents(row[key]),0)/100;
  return <><ReportShell title="Trial balance" subtitle="All account balances from posted journals. Debits and credits should agree." embedded={embedded} query={query} periodLabel={date.format('DD MMM YYYY')} controls={<><span>As of</span><DatePicker aria-label="Trial balance date" value={date} allowClear={false} onChange={setDate} format="DD MMM YYYY" /></>} onExport={() => reportData('trial-balance-'+date.format('YYYY-MM-DD')+'.csv', [['Trial balance', date.format('YYYY-MM-DD')], ['Code','Account','Type','Debit','Credit'], ...filtered.map(row => [row.code,row.name,row.type,row.debit,row.credit]), ['Filtered total','','',sum('debit'),sum('credit')]])}>
    <div className="ar-metrics"><Metric label="Debit balances" value={debit} /><Metric label="Credit balances" value={credit} /><Metric label="Difference" value={difference} tone={difference === 0 ? 'positive' : 'negative'} detail={difference === 0 ? 'Debits and credits agree' : 'Review journal postings'} /><div className="ar-metric"><span>Accounts with a balance</span><strong>{rows.length}</strong><small>Zero balances excluded</small></div></div>
    {difference !== 0 && <Alert className="ar-health-banner" type="error" showIcon message="Debits and credits do not agree" />}
    <div className="ar-table-card"><div className="ar-table-tools"><Input.Search aria-label="Search trial balance" placeholder="Search account name or code" value={search} onChange={event => setSearch(event.target.value)} allowClear /><Select aria-label="Filter account type" value={type} onChange={setType} style={{ minWidth: 170 }} options={['all','asset','liability','equity','revenue','expense'].map(value=>({ value,label:value==='all'?'All account types':value[0].toUpperCase()+value.slice(1) }))} /><span>{filtered.length} of {rows.length} accounts</span></div>
      <Table rowKey="id" columns={columns} dataSource={filtered} pagination={false} scroll={{ x: 690 }} locale={{ emptyText: 'No posted balances match this date and filter' }} summary={() => <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={3}>Displayed accounts total</Table.Summary.Cell><Table.Summary.Cell index={3} align="right">{money(sum('debit'))}</Table.Summary.Cell><Table.Summary.Cell index={4} align="right">{money(sum('credit'))}</Table.Summary.Cell></Table.Summary.Row>} />
    </div>
  </ReportShell><LedgerDrawer account={ledger} from={fyRange(date)[0].format('YYYY-MM-DD')} to={date.format('YYYY-MM-DD')} onClose={() => setLedger(null)} /></>;
}
