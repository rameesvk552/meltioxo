import React, { useMemo, useState } from 'react';
import { BookOutlined, EditOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Spin, Statistic, Switch, Table, Tag, Tree, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import PureProfitAndLoss from '../reports/PureProfitAndLoss';
import './ChartOfAccounts.css';
import './AccountsWorkspace.css';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const typeLabel = value => value ? value[0].toUpperCase() + value.slice(1) : '—';
const MAIN_TABS = ['Today', 'Money', 'Invoices', 'P&L', 'Reports', 'Reconcile', 'Ledger'];
const LEDGER_TABS = ['Chart of accounts', 'Journal entries', 'Payment methods'];
const METHOD_TYPES = ['CASH', 'BANK', 'UPI', 'CARD', 'WALLET', 'GATEWAY', 'OTHER'];

function buildTree(accounts, search) {
  const query = search.trim().toLowerCase();
  const byParent = new Map();
  accounts.forEach(account => {
    const key = account.parent_id || null;
    byParent.set(key, [...(byParent.get(key) || []), account]);
  });
  const node = account => {
    const children = (byParent.get(account.id) || []).map(node).filter(Boolean);
    const matches = !query || `${account.code} ${account.name}`.toLowerCase().includes(query);
    if (!matches && !children.length) return null;
    return {
      key: account.id,
      title: <div className="account-tree-title"><span className="ledger-code">{account.code}</span><strong>{account.name}</strong>{account.is_group ? <Tag>GROUP</Tag> : <Tag color={account.type === 'asset' ? 'blue' : account.type === 'liability' ? 'orange' : account.type === 'revenue' ? 'green' : 'purple'}>{typeLabel(account.type)}</Tag>}{!account.is_group && <span className="account-tree-balance">{money(account.balance)}</span>}</div>,
      children
    };
  };
  return accounts.filter(account => !account.parent_id).map(node).filter(Boolean);
}

export default function AccountsWorkspace() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState('Today');
  const [ledgerTab, setLedgerTab] = useState('Chart of accounts');
  const [search, setSearch] = useState('');
  const [ledgerModal, setLedgerModal] = useState(false);
  const [methodModal, setMethodModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ledgerForm] = Form.useForm();
  const [methodForm] = Form.useForm();
  const ledgerType = Form.useWatch('type', ledgerForm) || 'asset';
  const accountsQuery = useApiData('/accounts');
  const methodsQuery = useApiData('/accounts/payment-methods?active_only=false');
  const cashQuery = useApiData('/accounts/payment-method-ledgers');
  const paymentsQuery = useApiData('/payments');
  const journalsQuery = useApiData('/journal-entries');
  const payablesQuery = useApiData('/reports/aging-payables', { initialData: {} });
  const receivablesQuery = useApiData('/reports/aging-receivables', { initialData: {} });

  const accounts = accountsQuery.data;
  const methods = methodsQuery.data;
  const cashLedgers = cashQuery.data;
  const treeData = useMemo(() => buildTree(accounts, search), [accounts, search]);
  const groups = accounts.filter(account => account.is_group && account.type === ledgerType);
  const byCode = code => accounts.find(account => account.code === code);
  const cashTotal = cashLedgers.reduce((sum, ledger) => sum + Number(ledger.balance || 0), 0);
  const receivable = Number(byCode('1005')?.balance || 0);
  const payable = Number(byCode('2001')?.balance || 0);
  const errors = [accountsQuery.error, methodsQuery.error, paymentsQuery.error, journalsQuery.error].filter(Boolean);

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
  const openLedger = () => {
    ledgerForm.setFieldsValue({ type: 'asset', parent_id: undefined, name: '', code: '' });
    setLedgerModal(true);
    suggestLedgerCode(null, 'asset');
  };
  const saveLedger = async values => {
    setSaving(true);
    try { await client.post('/accounts', { ...values, is_group: false }); message.success('Ledger created'); setLedgerModal(false); ledgerForm.resetFields(); await accountsQuery.reload(); }
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
    if (mainTab === 'Today') return <><Row gutter={[14, 14]}><Col xs={24} sm={12} xl={6}><Card><Statistic title="Cash & bank" value={cashTotal} prefix="₹" precision={2} /></Card></Col><Col xs={24} sm={12} xl={6}><Card><Statistic title="Receivable" value={receivable} prefix="₹" precision={2} /></Card></Col><Col xs={24} sm={12} xl={6}><Card><Statistic title="Payable" value={payable} prefix="₹" precision={2} /></Card></Col><Col xs={24} sm={12} xl={6}><Card><Statistic title="Posted entries" value={journalsQuery.data.filter(item => item.status === 'posted').length} prefix={<BookOutlined />} /></Card></Col></Row><Card title="Recent money movements" style={{ marginTop: 16 }} extra={<Button type="link" onClick={() => setMainTab('Money')}>View all</Button>}><Table size="small" rowKey="id" pagination={false} dataSource={paymentsQuery.data.slice(0, 6)} columns={paymentColumns} locale={{ emptyText: 'No money movements yet' }} scroll={{ x: 650 }} /></Card></>;
    if (mainTab === 'Money') return <Card title="Money register" extra={<Button icon={<PlusOutlined />} onClick={() => navigate('/app/payments/new')}>Record receipt / payment</Button>}><Table rowKey="id" dataSource={paymentsQuery.data} columns={paymentColumns} loading={paymentsQuery.loading} scroll={{ x: 750 }} /></Card>;
    if (mainTab === 'Invoices') return <Row gutter={[16, 16]}><Col xs={24} lg={12}><Card title="Receivables"><Statistic title="Outstanding from customers" value={totalAging(receivablesQuery.data)} prefix="₹" precision={2} /><Button style={{ marginTop: 16 }} onClick={() => navigate('/app/receivables')}>Open receivables</Button></Card></Col><Col xs={24} lg={12}><Card title="Payables"><Statistic title="Outstanding to suppliers" value={totalAging(payablesQuery.data)} prefix="₹" precision={2} /><Button style={{ marginTop: 16 }} onClick={() => navigate('/app/payables')}>Open payables</Button></Card></Col></Row>;
    if (mainTab === 'P&L') return <PureProfitAndLoss embedded />;
    if (mainTab === 'Reports') return <Row gutter={[16, 16]}>{[['Profit & loss', '/app/reports/profit-loss'], ['Daily sales & profit', '/app/reports/sales-profit'], ['Balance sheet', '/app/reports/balance-sheet'], ['Trial balance', '/app/reports/trial-balance'], ['Stock valuation', '/app/reports/stock']].map(([title, route]) => <Col xs={24} sm={12} key={route}><Card hoverable onClick={() => navigate(route)}><FileTextOutlined /> <strong style={{ marginLeft: 8 }}>{title}</strong></Card></Col>)}</Row>;
    if (mainTab === 'Reconcile') return <Card title="Cash & bank overview" extra={<Button icon={<ReloadOutlined />} onClick={() => { cashQuery.reload(); accountsQuery.reload(); }}>Refresh</Button>}><Alert type="info" showIcon message="These balances come only from posted double-entry journals." style={{ marginBottom: 16 }} /><Table rowKey="id" pagination={false} dataSource={cashLedgers} columns={[{ title: 'Ledger', render: (_, row) => `${row.code} — ${row.name}` }, { title: 'Balance', align: 'right', render: (_, row) => <strong>{money(row.balance)}</strong> }]} /></Card>;
    return <><nav className="ledger-tabs">{LEDGER_TABS.map(tab => <button key={tab} className={ledgerTab === tab ? 'active' : ''} onClick={() => setLedgerTab(tab)}>{tab}</button>)}</nav>{ledgerTab === 'Chart of accounts' && <Card title="Ledger tree" extra={<Button type="primary" icon={<PlusOutlined />} onClick={openLedger}>New ledger</Button>}><Input.Search value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by code or ledger name" allowClear style={{ maxWidth: 420, marginBottom: 16 }} />{accountsQuery.loading ? <Spin /> : treeData.length ? <Tree treeData={treeData} defaultExpandAll blockNode /> : <Empty description="No accounts configured" />}</Card>}{ledgerTab === 'Journal entries' && <Card title="Journal entries" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/journal-entries/new')}>New journal</Button>}><Table rowKey="id" dataSource={journalsQuery.data} columns={journalColumns} loading={journalsQuery.loading} scroll={{ x: 800 }} /></Card>}{ledgerTab === 'Payment methods' && <Card title="Payment methods" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openMethod(null)}>New payment method</Button>}><Alert type="info" showIcon message="Every payment method must map to an active posting ledger under Cash & Bank. Groups are never selectable." style={{ marginBottom: 16 }} /><Table rowKey="id" dataSource={methods} columns={methodColumns} loading={methodsQuery.loading} scroll={{ x: 700 }} /></Card>}</>;
  };

  return <main className="accounts-page"><div className="accounts-heading"><div><span className="eyebrow">ACCOUNTING</span><h1>Accounts</h1></div><div className="quick-actions"><Button className="receipt-button" onClick={() => navigate('/app/payments/new')}>↙ Receipt</Button><Button className="payment-button" onClick={() => navigate('/app/payments/new')}>↗ Payment</Button></div></div><nav className="accounts-nav">{MAIN_TABS.map(tab => <button key={tab} className={mainTab === tab ? 'active' : ''} onClick={() => setMainTab(tab)}>{tab}</button>)}</nav>{errors.length > 0 && <Alert type="error" showIcon message="Some accounting data could not be loaded" description={errors[0]?.response?.data?.message || errors[0]?.message} style={{ marginBottom: 16 }} />}{renderContent()}
    <Modal title="New ledger" open={ledgerModal} onCancel={() => setLedgerModal(false)} onOk={() => ledgerForm.submit()} confirmLoading={saving} destroyOnHidden><Form form={ledgerForm} layout="vertical" onFinish={saveLedger} initialValues={{ type: 'asset' }} onValuesChange={(changed, values) => { if (changed.type !== undefined || changed.parent_id !== undefined) suggestLedgerCode(values.parent_id, values.type); }}><Row gutter={12}><Col span={8}><Form.Item name="code" label="Code (automatic)" rules={[{ required: true }]}><Input readOnly /></Form.Item></Col><Col span={16}><Form.Item name="name" label="Ledger name" rules={[{ required: true }]}><Input /></Form.Item></Col></Row><Form.Item name="type" label="Account type" rules={[{ required: true }]}><Select options={['asset', 'liability', 'equity', 'revenue', 'expense'].map(value => ({ value, label: typeLabel(value) }))} /></Form.Item><Form.Item name="parent_id" label="Parent group" rules={[{ required: true, message: 'Select the group for this ledger' }]}><Select showSearch optionFilterProp="label" options={groups.map(group => ({ value: group.id, label: `${group.code} — ${group.name}` }))} /></Form.Item></Form></Modal>
    <Modal title={editingMethod ? 'Edit payment method' : 'New payment method'} open={methodModal} onCancel={() => setMethodModal(false)} onOk={() => methodForm.submit()} confirmLoading={saving} destroyOnHidden><Form form={methodForm} layout="vertical" onFinish={saveMethod}><Form.Item name="name" label="Name" rules={[{ required: true }]}><Input placeholder="e.g. HDFC Current Account" /></Form.Item><Row gutter={12}><Col span={12}><Form.Item name="method_type" label="Type" rules={[{ required: true }]}><Select options={METHOD_TYPES.map(value => ({ value, label: typeLabel(value.toLowerCase()) }))} /></Form.Item></Col><Col span={12}><Form.Item name="sort_order" label="Sort order"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col></Row><Form.Item name="account_id" label="Posts to ledger" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={cashLedgers.map(ledger => ({ value: ledger.id, label: `${ledger.code} — ${ledger.name}` }))} /></Form.Item><Space size="large"><Form.Item name="is_default" label="Default" valuePropName="checked"><Switch /></Form.Item><Form.Item name="is_active" label="Active" valuePropName="checked"><Switch /></Form.Item></Space></Form></Modal>
  </main>;
}
