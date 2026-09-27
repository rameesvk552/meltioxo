import React, { useContext, useMemo, useState } from 'react';
import { BookOutlined, EditOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Form, Input, InputNumber, Modal, Row, Segmented, Select, Space, Spin, Statistic, Switch, Table, Tag, Tooltip, Tree, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import PureProfitAndLoss from '../reports/PureProfitAndLoss';
import LedgerDrawer from '../reports/LedgerDrawer';
import { fyRange, Metric, money } from '../reports/AccountingUI';
import { AuthContext } from '../../context/AuthContext';
import { hasViewPermission, getViewPermissionsForPath, hasAnyViewPermission } from '../../config/permissions';
import dayjs from 'dayjs';
import './ChartOfAccounts.css';
import './AccountsWorkspace.css';

const typeLabel = value => value ? value[0].toUpperCase() + value.slice(1) : '—';
const MAIN_TABS = ['Overview', 'Money', 'Invoices', 'P&L', 'Reports', 'Reconcile', 'Ledgers'];
const LEDGER_TABS = ['Chart of accounts', 'Journal entries', 'Payment methods'];
const METHOD_TYPES = ['CASH', 'BANK', 'UPI', 'CARD', 'WALLET', 'GATEWAY', 'OTHER'];

function buildTree(accounts, search, openLedger, addChild, editAccount, typeFilter) {
  const query = search.trim().toLowerCase();
  const byParent = new Map();
  accounts.forEach(account => {
    const key = account.parent_id || null;
    byParent.set(key, [...(byParent.get(key) || []), account]);
  });
  const node = (account, trail = new Set()) => {
    if (trail.has(account.id)) return null;
    const nextTrail = new Set([...trail, account.id]);
    const children = (byParent.get(account.id) || []).map(child => node(child, nextTrail)).filter(Boolean);
    const matches = (!query || `${account.code} ${account.name}`.toLowerCase().includes(query)) && (typeFilter === 'all' || account.type === typeFilter);
    if (!matches && !children.length) return null;
    return {
      key: account.id,
      title: <div className="account-tree-title"><span className="ledger-code">{account.code}</span>{account.is_group ? <strong>{account.name}</strong> : <button className="ar-ledger-link" onClick={event => { event.stopPropagation(); openLedger(account); }}>{account.name}</button>}{account.is_group ? <Tag>GROUP</Tag> : <Tag color={account.type === 'asset' ? 'blue' : account.type === 'liability' ? 'orange' : account.type === 'revenue' ? 'green' : 'purple'}>{typeLabel(account.type)}</Tag>}{account.is_active === false && <Tag>Inactive</Tag>}{account.is_group && addChild && <Tooltip title="Add child ledger or group"><Button aria-label={`Add child under ${account.name}`} type="text" size="small" icon={<PlusOutlined />} onClick={event=>{event.stopPropagation();addChild(account);}} /></Tooltip>}{editAccount && <Tooltip title="Edit account"><Button aria-label={`Edit ${account.name}`} type="text" size="small" icon={<EditOutlined />} onClick={event=>{event.stopPropagation();editAccount(account);}} /></Tooltip>}{!account.is_group && <span className="account-tree-balance">{money(account.balance)}</span>}</div>,
      children
    };
  };
  const ids = new Set(accounts.map(account=>account.id));
  return accounts.filter(account => !account.parent_id || !ids.has(account.parent_id)).map(account => node(account)).filter(Boolean);
}

export default function AccountsWorkspace() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState('Overview');
  const [selectedLedger, setSelectedLedger] = useState(null);
  const { user } = useContext(AuthContext);
  const allowed = permission => hasViewPermission(user, permission);
  const [ledgerTab, setLedgerTab] = useState('Chart of accounts');
  const [search, setSearch] = useState('');
  const [ledgerModal, setLedgerModal] = useState(false);
  const [methodModal, setMethodModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [editingLedger, setEditingLedger] = useState(null);
  const [accountView, setAccountView] = useState('Tree');
  const [accountType, setAccountType] = useState('all');
  const [saving, setSaving] = useState(false);
  const [ledgerForm] = Form.useForm();
  const [methodForm] = Form.useForm();
  const ledgerType = Form.useWatch('type', ledgerForm) || 'asset';
  const isGroup = Form.useWatch('is_group', ledgerForm) || false;
  const canManage = ['admin','super_admin','accountant'].includes(user?.role);
  const accountsQuery = useApiData('/accounts');
  const methodsQuery = useApiData('/accounts/payment-methods?active_only=false');
  const cashQuery = useApiData('/accounts/payment-method-ledgers');
  const paymentsQuery = useApiData('/payments', { enabled: allowed('finance.payments') });
  const journalsQuery = useApiData('/journal-entries', { enabled: allowed('finance.journal_entries') });
  const payablesQuery = useApiData('/reports/aging-payables', { initialData: {}, enabled: allowed('finance.payables') });
  const receivablesQuery = useApiData('/reports/aging-receivables', { initialData: {}, enabled: allowed('finance.receivables') });
  const balancesQuery = useApiData('/reports/account-balances');
  const healthQuery = useApiData('/reports/accounting-health', { initialData: {} });
  const fyProfitQuery = useApiData(`/reports/profit-loss-statement?from=${fyRange()[0].format('YYYY-MM-DD')}&to=${dayjs().format('YYYY-MM-DD')}`, { initialData: {}, enabled: allowed('reports.profit_loss') });

  const postedById = new Map(balancesQuery.data.map(row => [row.id, Number(row.balance)]));
  const accounts = useMemo(() => accountsQuery.data.map(row => ({ ...row, balance: balancesQuery.data.find(balance => balance.id === row.id)?.balance || 0 })), [accountsQuery.data, balancesQuery.data]);
  const methods = methodsQuery.data;
  const cashLedgers = cashQuery.data.map(row => ({ ...row, balance: postedById.get(row.id) || 0 }));
  const treeData = buildTree(accounts, search, setSelectedLedger, canManage ? parent => openLedger(parent) : null, canManage ? row => editLedger(row) : null, accountType);
  const groups = accounts.filter(account => account.is_group && account.type === ledgerType && account.is_active !== false);
  const byCode = code => accounts.find(account => account.code === code);
  const cashIds = new Set(accounts.filter(row => row.code === '1002').map(row => row.id));
  for (let i = 0; i < accounts.length; i++) accounts.forEach(row => { if (cashIds.has(row.parent_id)) cashIds.add(row.id); });
  const cashTotal = accounts.filter(row => cashIds.has(row.id) && !row.is_group).reduce((sum, ledger) => sum + Math.round(Number(ledger.balance || 0)*100), 0)/100;
  const receivable = Number(byCode('1005')?.balance || 0);
  const payableIds = new Set(accounts.filter(row => row.code === '2001').map(row => row.id));
  for (let i = 0; i < accounts.length; i++) accounts.forEach(row => { if (payableIds.has(row.parent_id)) payableIds.add(row.id); });
  const payable = accounts.filter(row => payableIds.has(row.id)).reduce((sum,row) => sum+Number(row.balance),0);
  const errors = [accountsQuery.error, methodsQuery.error, cashQuery.error, paymentsQuery.error, journalsQuery.error, balancesQuery.error, payablesQuery.error, receivablesQuery.error, healthQuery.error, fyProfitQuery.error].filter(Boolean);
  const visibleTabs = MAIN_TABS.filter(tab => tab !== 'Money' || allowed('finance.payments')).filter(tab => tab !== 'Invoices' || allowed('finance.payables') || allowed('finance.receivables')).filter(tab => tab !== 'P&L' || allowed('reports.profit_loss'));

  const paymentColumns = [
    { title: 'Number', dataIndex: 'payment_number' }, { title: 'Date', dataIndex: 'payment_date' },
    { title: 'Party', render: (_, row) => row.party_name || (row.party_id ? typeLabel(row.party_type) : 'Walk-in customer') },
    { title: 'Method', render: (_, row) => row.paymentMethod?.name || typeLabel(row.payment_mode?.replaceAll('_', ' ')) },
    { title: 'Direction', render: (_, row) => <Tag color={row.payment_type === 'incoming' ? 'success' : 'error'}>{row.payment_type === 'incoming' ? 'Receipt' : 'Payment'}</Tag> },
    { title: 'Amount', align: 'right', render: (_, row) => <strong>{money(row.amount)}</strong> }
  ];
  const journalColumns = [
    { title: 'Entry', dataIndex: 'entry_number' }, { title: 'Date', dataIndex: 'entry_date' },
    { title: 'Source', dataIndex: 'reference_type', render: value => typeLabel(value?.replaceAll('_', ' ')) },
    { title: 'Narration', dataIndex: 'narration' }, { title: 'Debit', align: 'right', render: (_, row) => money(row.total_debit) },
    { title: 'Status', render: (_, row) => <Tag color={row.status === 'posted' ? 'success' : 'warning'}>{row.status.toUpperCase()}</Tag> }
  ];
  const methodColumns = [
    { title: 'Payment method', render: (_, row) => <Space><strong>{row.name}</strong>{row.is_default && <Tag color="success">DEFAULT</Tag>}</Space> },
    { title: 'Type', dataIndex: 'method_type', render: value => <Tag>{value}</Tag> },
    { title: 'Posts to ledger', render: (_, row) => row.account ? `${row.account.code} — ${row.account.name}` : 'Missing ledger' },
    { title: 'Status', render: (_, row) => <Tag color={row.is_active ? 'success' : 'default'}>{row.is_active ? 'Active' : 'Inactive'}</Tag> },
    { title: '', align: 'right', render: (_, row) => <Button icon={<EditOutlined />} onClick={() => openMethod(row)}>Edit</Button> }
  ];

  const openMethod = method => {
    setEditingMethod(method || null);
    methodForm.setFieldsValue(method ? { name: method.name, method_type: method.method_type, account_id: method.account_id, is_default: method.is_default, is_active: method.is_active, sort_order: method.sort_order } : { method_type: 'BANK', is_active: true, is_default: false, sort_order: 0 });
    setMethodModal(true);
  };
  const suggestLedgerCode = async (parentId, type = ledgerType) => {
    try {
      const { data } = await client.get('/accounts/next-code', { params: { type, ...(parentId ? { parent_id: parentId } : {}) } });
      ledgerForm.setFieldValue('code', data.code);
    } catch (error) {
      ledgerForm.setFieldValue('code', '');
      message.error(error.response?.data?.message || 'Could not generate a ledger code');
    }
  };
  const openLedger = parent => {
    setEditingLedger(null);
    ledgerForm.setFieldsValue({ type: parent?.type || 'asset', parent_id: parent?.id, name: '', code: '', is_group: false, is_active: true });
    setLedgerModal(true);
    suggestLedgerCode(parent?.id, parent?.type || 'asset');
  };
  const editLedger = row => {
    setEditingLedger(row);
    ledgerForm.setFieldsValue({ name: row.name, code: row.code, type: row.type, parent_id: row.parent_id || undefined, is_group: row.is_group, is_active: row.is_active !== false });
    setLedgerModal(true);
  };
  const saveLedger = async values => {
    setSaving(true);
    try {
      if (editingLedger) await client.put(`/accounts/${editingLedger.id}`, { name: values.name, ...(editingLedger.is_system ? {} : { is_active: values.is_active }) });
      else await client.post('/accounts', { ...values, is_group: Boolean(values.is_group) });
      message.success(editingLedger ? 'Account updated' : values.is_group ? 'Account group created' : 'Ledger created'); setLedgerModal(false); ledgerForm.resetFields(); await accountsQuery.reload(); await balancesQuery.reload();
    }
    catch (error) { message.error(error.response?.data?.message || 'Could not create ledger'); }
    finally { setSaving(false); }
  };
  const saveMethod = async values => {
    setSaving(true);
    try {
      if (editingMethod) await client.patch(`/accounts/payment-methods/${editingMethod.id}`, values);
      else await client.post('/accounts/payment-methods', values);
      message.success(editingMethod ? 'Payment method updated' : 'Payment method created');
      setMethodModal(false); await methodsQuery.reload();
    } catch (error) { message.error(error.response?.data?.message || 'Could not save payment method'); }
    finally { setSaving(false); }
  };
  const totalAging = report => ['current', '1-30', '31-60', '60+'].reduce((sum, key) => sum + Number(report[key] || 0), 0);

  const renderContent = () => {
    if (mainTab === 'Overview') return <>{balancesQuery.loading || healthQuery.loading ? <div className="ar-loading"><Spin /> Preparing your accounts…</div> : balancesQuery.error ? <Empty description="Account balances are unavailable. Refresh to try again." /> : <>
      <div className="ar-metrics"><Metric label="Cash & bank" value={cashTotal} detail="Posted balances, including inactive ledgers" /><Metric label="Trade receivables" value={receivable} detail="Customer ledger balance" /><Metric label="Trade payables" value={payable} detail="Supplier ledger balances" /><div className="ar-metric"><span>Posted journals</span><strong>{healthQuery.data.posted_journals ?? '—'}</strong><small>From sales, purchases, production & finance</small></div></div>
      {!healthQuery.error && <div className="ar-health-status"><Tag color={healthQuery.data.balanced ? 'success' : 'error'}>{healthQuery.data.balanced ? 'Journals balance' : 'Review required'}</Tag><span>{healthQuery.data.stored_balance_mismatches?.length ? healthQuery.data.stored_balance_mismatches.length+' company ledger caches need review. Reports use posted balances.' : 'Reports are calculated from posted entries.'}</span><Button type="link" onClick={() => setMainTab('Reconcile')}>Review</Button></div>}
      <div className="accounting-overview-grid"><div className="ar-table-card"><h2>Connected business workflows</h2><div className="ar-report-grid">{[['Purchases','Invoices, supplier balances & stock cost','/app/purchases'],['Production','Materials → work in progress → finished goods','/app/production'],['Sales','Income, tax, collections & cost of goods','/app/retail-sales'],['Expenses','Operating costs and payment records','/app/expenses'],['Inventory','Stock quantities and valuation','/app/reports/stock'],['Reports','Financial statements and monthly MIS',null]].filter(([, ,route])=>!route || hasAnyViewPermission(user,getViewPermissionsForPath(route))).map(([title,description,route])=><button className="ar-report-tile" key={title} onClick={()=>route ? navigate(route) : setMainTab('Reports')}><strong>{title}</strong><span>{description}</span></button>)}</div></div>
        <aside><div className="ar-table-card"><div className="accounting-card-heading"><h2>Recent journal entries</h2>{allowed('finance.journal_entries') && <Button type="link" onClick={()=>navigate('/app/journal-entries')}>View all</Button>}</div>
          {!allowed('finance.journal_entries') ? <p className="ar-empty">Journal access is not enabled for your account.</p> : journalsQuery.loading ? <Spin/> : journalsQuery.data.length ? <div className="recent-journals">{[...journalsQuery.data].sort((a,b)=>String(b.entry_date).localeCompare(String(a.entry_date))||String(b.created_at).localeCompare(String(a.created_at))).slice(0,5).map(row=><button key={row.id} className="recent-journal" onClick={()=>navigate('/app/journal-entries?entry='+row.id)}><span className="journal-icon"><BookOutlined/></span><span className="journal-info"><strong>{row.entry_number}</strong><small>{row.entry_date} · {row.narration || typeLabel(row.reference_type?.replaceAll('_',' '))}</small></span><Tag color={row.status==='posted'?'success':'warning'}>{typeLabel(row.status)}</Tag></button>)}</div> : <Empty description="No journal entries yet"/>}
        </div><div className="ar-table-card"><h2>At a glance</h2><div className="overview-stat"><span>Accounts configured</span><strong>{accounts.length}</strong></div><div className="overview-stat"><span>Posted journals</span><strong>{healthQuery.data.posted_journals ?? '—'}</strong></div>{allowed('reports.profit_loss') && <><div className="overview-stat"><span>Net profit · Current FY</span><strong className={fyProfitQuery.data.summary?.net_profit<0?'ar-negative':''}>{fyProfitQuery.loading?'Loading…':fyProfitQuery.error?'Unavailable':money(fyProfitQuery.data.summary?.net_profit)}</strong></div><div className="overview-stat"><span>Net profit margin</span><strong>{fyProfitQuery.loading||fyProfitQuery.error?'—':(fyProfitQuery.data.summary?.net_margin_pct || 0)+'%'}</strong></div></>}</div></aside>
      </div>
      {allowed('finance.payments') && <Card title="Recent receipts & payments" extra={<Button type="link" onClick={() => setMainTab('Money')}>View register</Button>}><Table rowKey="id" size="small" columns={paymentColumns} dataSource={[...paymentsQuery.data].sort((a,b)=>String(b.payment_date).localeCompare(String(a.payment_date))||String(b.created_at).localeCompare(String(a.created_at))).slice(0,6)} loading={paymentsQuery.loading} pagination={false} scroll={{ x: 750 }} /></Card>}
    </>}</>;
    if (mainTab === 'Money') return <Card title="Money register" extra={<Button icon={<PlusOutlined />} onClick={() => navigate('/app/payments/new')}>Record receipt / payment</Button>}><Table rowKey="id" dataSource={paymentsQuery.data} columns={paymentColumns} loading={paymentsQuery.loading} scroll={{ x: 750 }} /></Card>;
    if (mainTab === 'Invoices') return <Row gutter={[16,16]}>{allowed('finance.receivables') && <Col xs={24} lg={12}><Card title="Receivables">{receivablesQuery.loading?<Spin/>:receivablesQuery.error?<Empty description="Unavailable"/>:<Statistic title="Outstanding from customers" value={totalAging(receivablesQuery.data)} prefix="₹" precision={2}/>}<Button style={{marginTop:16}} onClick={()=>navigate('/app/receivables')}>Open receivables</Button></Card></Col>}{allowed('finance.payables') && <Col xs={24} lg={12}><Card title="Payables">{payablesQuery.loading?<Spin/>:payablesQuery.error?<Empty description="Unavailable"/>:<Statistic title="Outstanding to suppliers" value={totalAging(payablesQuery.data)} prefix="₹" precision={2}/>}<Button style={{marginTop:16}} onClick={()=>navigate('/app/payables')}>Open payables</Button></Card></Col>}</Row>;
    if (mainTab === 'P&L') return <PureProfitAndLoss embedded />;
    if (mainTab === 'Reports') return <div className="ar-report-grid">{[
      ['Profit & loss','Income, direct costs and net profit','/app/reports/profit-loss'],
      ['Balance sheet','Assets, liabilities and equity','/app/reports/balance-sheet'],
      ['Trial balance','Debit and credit balances across ledgers','/app/reports/trial-balance'],
      ['Management / MIS','Monthly profitability and expense analysis','/app/reports/management'],
      ['Cash & bank movements','Opening balance, receipts and payments','/app/reports/cash-bank'],
      ['Daily sales & profit','Sales performance and product margins','/app/reports/sales-profit'],
      ['Stock valuation','Material and finished goods valuation','/app/reports/stock'],
      ['Production costs','Output, consumption, yield and waste','/app/reports/production'],
      ['Receivables aging','Outstanding customer invoices','/app/receivables'],
      ['Payables aging','Outstanding supplier invoices','/app/payables'],
      ['Audit trail','Track actions across the business','/app/reports/audit-log']
    ].filter(([, ,route])=>hasAnyViewPermission(user,getViewPermissionsForPath(route))).map(([title,description,route])=><button className="ar-report-tile" key={route} onClick={()=>navigate(route)}><FileTextOutlined /><strong>{title}</strong><span>{description}</span></button>)}</div>;
    if (mainTab === 'Reconcile') return <><Card title="Accounting health" extra={<Button icon={<ReloadOutlined />} loading={healthQuery.loading} onClick={() => { healthQuery.reload(); balancesQuery.reload(); cashQuery.reload(); }}>Run checks</Button>}>
      {healthQuery.loading ? <Spin /> : healthQuery.error ? <Empty description="Checks are unavailable" /> : <>
        <Alert type={healthQuery.data.balanced && !healthQuery.data.unbalanced_journals?.length && !healthQuery.data.header_mismatches?.length ? 'success' : 'error'} showIcon message={healthQuery.data.balanced ? 'Trial balance agrees' : 'Trial balance needs review'} description={'Difference: '+money(healthQuery.data.difference)+' · '+healthQuery.data.posted_journals+' posted journals checked'} />
        <div className="ar-metrics" style={{ marginTop: 18 }}><Metric label="Debit balances" value={healthQuery.data.total_debit} /><Metric label="Credit balances" value={healthQuery.data.total_credit} /><div className="ar-metric"><span>Unbalanced journals</span><strong>{healthQuery.data.unbalanced_journals?.length || 0}</strong></div><div className="ar-metric"><span>Header discrepancies</span><strong>{healthQuery.data.header_mismatches?.length || 0}</strong></div></div>
        {!!healthQuery.data.stored_balance_mismatches?.length && <><Alert type="warning" showIcon message="Stored company balances differ from journals" description="These cached balances cover the whole company. Reports and this workspace calculate the selected branch directly from posted entries." /><Table style={{ marginTop:16 }} rowKey="id" scroll={{ x: 600 }} dataSource={healthQuery.data.stored_balance_mismatches} columns={[{title:'Code',dataIndex:'code'},{title:'Account',dataIndex:'name'},{title:'Stored balance',dataIndex:'stored',align:'right',render:money},{title:'Posted balance',dataIndex:'posted',align:'right',render:money}]} /></>}
        {[['Unbalanced journals','unbalanced_journals'],['Journal header discrepancies','header_mismatches']].map(([title,key])=>healthQuery.data[key]?.length ? <div key={key}><h3 style={{ marginTop:18 }}>{title}</h3><Table rowKey="id" dataSource={healthQuery.data[key]} columns={[{title:'Reference',dataIndex:'reference'},{title:'Debit',dataIndex:'debit',render:money},{title:'Credit',dataIndex:'credit',render:money}]} /></div> : null)}
      </>}
    </Card><Card title="Cash & bank ledgers" style={{ marginTop:18 }}><Table rowKey="id" loading={balancesQuery.loading} pagination={false} dataSource={cashLedgers} columns={[{title:'Ledger',render:(_,row)=><button className="ar-ledger-link" onClick={()=>setSelectedLedger(row)}>{row.code+' · '+row.name}</button>},{title:'Posted balance',align:'right',render:(_,row)=>money(row.balance)}]} /></Card><p className="ar-footnote">Checks compare journal debit / credit lines, journal header totals, and stored company balances. These checks do not constitute bank statement reconciliation.</p></>;
    return <><nav className="ledger-tabs">{LEDGER_TABS.filter(tab=>tab!=='Journal entries'||allowed('finance.journal_entries')).map(tab=><button key={tab} className={ledgerTab===tab?'active':''} onClick={()=>setLedgerTab(tab)}>{tab}</button>)}</nav>
      {ledgerTab==='Chart of accounts' && <><div className="account-counts">{['asset','liability','equity','revenue','expense'].map(type=><button key={type} className={'account-count '+type+(accountType===type?' selected':'')} aria-pressed={accountType===type} onClick={()=>setAccountType(accountType===type?'all':type)}><strong>{accounts.filter(row=>row.type===type).length}</strong><span>{typeLabel(type)}</span></button>)}</div>
      <Card className="account-chart-card" title="Chart of accounts" extra={<Space><Segmented aria-label="Account view" value={accountView} options={['Tree','List']} onChange={setAccountView}/>{canManage && <Button type="primary" icon={<PlusOutlined/>} onClick={()=>openLedger()}>New account</Button>}</Space>}>
        <div className="ar-table-tools"><Input.Search value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search by code or account name" allowClear/><span>{accounts.length} accounts · Click a ledger to inspect entries</span></div>
        {accountsQuery.loading||balancesQuery.loading ? <Spin/> : accountsQuery.error||balancesQuery.error ? <Empty description="Accounts are unavailable"/> : accountView==='Tree' ? treeData.length ? <Tree key={search+'-'+accountType} treeData={treeData} defaultExpandAll blockNode/> : <Empty description="No matching accounts"/> :
          <Table rowKey="id" scroll={{x:650}} dataSource={accounts.filter(row=>(accountType==='all'||row.type===accountType)&&(row.code+' '+row.name).toLowerCase().includes(search.toLowerCase()))} columns={[{title:'Code',dataIndex:'code'},{title:'Account',render:(_,row)=>row.is_group?<strong>{row.name}</strong>:<button className="ar-ledger-link" onClick={()=>setSelectedLedger(row)}>{row.name}</button>},{title:'Type',dataIndex:'type',render:typeLabel},{title:'Kind',render:(_,row)=><Tag>{row.is_group?'Group':'Ledger'}</Tag>},{title:'Posted balance',align:'right',render:(_,row)=>row.is_group?'—':money(row.balance)},...(canManage?[{title:'',render:(_,row)=><Button aria-label={'Edit '+row.name} icon={<EditOutlined/>} onClick={()=>editLedger(row)}/>}]:[])]}/>}
      </Card></>}
      {ledgerTab==='Journal entries' && <Card title="Journal entries" extra={<Button onClick={()=>navigate('/app/journal-entries')}>Open journal register</Button>}><Table rowKey="id" dataSource={journalsQuery.data} columns={journalColumns} loading={journalsQuery.loading} scroll={{x:800}}/></Card>}
      {ledgerTab==='Payment methods' && <Card title="Payment methods" extra={canManage && <Button type="primary" icon={<PlusOutlined/>} onClick={()=>openMethod(null)}>New payment method</Button>}><Alert type="info" showIcon message="Map each payment method to a posting ledger under Cash & Bank." style={{marginBottom:16}}/><Table rowKey="id" dataSource={methods} columns={canManage?methodColumns:methodColumns.slice(0,-1)} loading={methodsQuery.loading} scroll={{x:700}}/></Card>}
    </>;
  };

  return <main className="accounts-page"><div className="accounts-heading"><div><span className="eyebrow">CONNECTED FINANCE</span><h1>Accounting</h1><p className="accounts-subtitle">One ledger. A clear view of your business.</p></div><div className="quick-actions"><Button icon={<ReloadOutlined />} onClick={() => { balancesQuery.reload(); healthQuery.reload(); paymentsQuery.reload(); journalsQuery.reload(); fyProfitQuery.reload(); accountsQuery.reload(); }}>Refresh</Button>{canManage && allowed('finance.expenses') && <Button onClick={()=>navigate('/app/expenses/new')}>Expense</Button>}{canManage && allowed('finance.payments') && <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/payments/new?type=incoming')}>Receipt</Button>}{canManage && allowed('finance.journal_entries') && <Button icon={<BookOutlined/>} onClick={()=>navigate('/app/journal-entries/new')}>New journal</Button>}<Button onClick={()=>{setMainTab('Ledgers');setLedgerTab('Chart of accounts');}}>Chart of accounts</Button></div></div><nav aria-label="Accounting sections" className="accounts-nav">{visibleTabs.map(tab => <button key={tab} aria-current={mainTab === tab ? 'page' : undefined} className={mainTab === tab ? 'active' : ''} onClick={() => setMainTab(tab)}>{tab}</button>)}</nav>{errors.length > 0 && <Alert type="error" showIcon message="Some accounting data could not be loaded" description={errors[0]?.response?.data?.message || errors[0]?.message} style={{ marginBottom: 16 }} />}{renderContent()}<LedgerDrawer account={selectedLedger} from={fyRange()[0].format('YYYY-MM-DD')} to={dayjs().format('YYYY-MM-DD')} onClose={() => setSelectedLedger(null)} />
    <Modal title={editingLedger?'Edit account':'New account'} open={ledgerModal} onCancel={()=>setLedgerModal(false)} onOk={()=>ledgerForm.submit()} confirmLoading={saving} destroyOnHidden><Form form={ledgerForm} layout="vertical" onFinish={saveLedger} onValuesChange={(changed,values)=>{if(!editingLedger&&(changed.type!==undefined||changed.parent_id!==undefined)){if(changed.type!==undefined)ledgerForm.setFieldValue('parent_id',undefined);suggestLedgerCode(changed.type!==undefined?undefined:values.parent_id,values.type);}}}>
      <Row gutter={12}><Col span={8}><Form.Item name="code" label="Code (automatic)" rules={[{required:true}]}><Input readOnly/></Form.Item></Col><Col span={16}><Form.Item name="name" label="Account name" rules={[{required:true,whitespace:true}]}><Input autoFocus/></Form.Item></Col></Row>
      <Form.Item name="type" label="Account type" rules={[{required:true}]}><Select disabled={!!editingLedger} options={['asset','liability','equity','revenue','expense'].map(value=>({value,label:typeLabel(value)}))}/></Form.Item>
      <Form.Item name="is_group" label="Account group" valuePropName="checked" extra="Groups organise the chart. Entries post to ledgers."><Switch disabled={!!editingLedger}/></Form.Item>
      <Form.Item name="parent_id" label="Parent group" rules={[{required:!isGroup&&!editingLedger,message:'Select the group for this ledger'}]}><Select disabled={!!editingLedger} showSearch allowClear optionFilterProp="label" options={groups.map(group=>({value:group.id,label:group.code+' — '+group.name}))}/></Form.Item>
      {editingLedger && <Form.Item name="is_active" label="Active" valuePropName="checked" extra={editingLedger.is_system?'System accounts remain active.':'Inactive ledgers remain in historical reports.'}><Switch disabled={editingLedger.is_system}/></Form.Item>}
    </Form></Modal>
    <Modal title={editingMethod ? 'Edit payment method' : 'New payment method'} open={methodModal} onCancel={() => setMethodModal(false)} onOk={() => methodForm.submit()} confirmLoading={saving} destroyOnHidden><Form form={methodForm} layout="vertical" onFinish={saveMethod}><Form.Item name="name" label="Name" rules={[{ required: true }]}><Input placeholder="e.g. HDFC Current Account" /></Form.Item><Row gutter={12}><Col span={12}><Form.Item name="method_type" label="Type" rules={[{ required: true }]}><Select options={METHOD_TYPES.map(value => ({ value, label: typeLabel(value.toLowerCase()) }))} /></Form.Item></Col><Col span={12}><Form.Item name="sort_order" label="Sort order"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col></Row><Form.Item name="account_id" label="Posts to ledger" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={cashLedgers.map(ledger => ({ value: ledger.id, label: `${ledger.code} — ${ledger.name}` }))} /></Form.Item><Space size="large"><Form.Item name="is_default" label="Default" valuePropName="checked"><Switch /></Form.Item><Form.Item name="is_active" label="Active" valuePropName="checked"><Switch /></Form.Item></Space></Form></Modal>
  </main>;
}
