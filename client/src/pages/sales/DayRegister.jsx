import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, InputNumber, Modal, Row, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, LockOutlined, PlayCircleOutlined, ReloadOutlined, WalletOutlined } from '@ant-design/icons';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import './DayRegister.css';

const { Text, Title } = Typography;
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
const dateLabel = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' }).format(new Date(`${value}T12:00:00+05:30`)) : '—';
const timeLabel = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value)) : '—';

export default function DayRegister() {
  const [openForm] = Form.useForm();
  const [closeForm] = Form.useForm();
  const [openVisible, setOpenVisible] = useState(false);
  const [closeVisible, setCloseVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const countedCash = Form.useWatch('counted_cash', closeForm);
  const stateQuery = useApiData('/business-days/current', { initialData: {} });
  const historyQuery = useApiData('/business-days?limit=30');
  const current = stateQuery.data.current;
  const expectedCash = Number(current?.expected_cash || 0);
  const variance = Number(countedCash || 0) - expectedCash;

  const refresh = async () => Promise.all([stateQuery.reload(), historyQuery.reload()]);

  const openDay = async values => {
    setSaving(true);
    try {
      await client.post('/business-days/open', values);
      message.success('Business day opened. POS sales are now enabled.');
      setOpenVisible(false);
      openForm.resetFields();
      await refresh();
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not open the business day');
    } finally { setSaving(false); }
  };

  const closeDay = async values => {
    setSaving(true);
    try {
      await client.post('/business-days/close', values);
      message.success('Business day closed and totals locked.');
      setCloseVisible(false);
      closeForm.resetFields();
      await refresh();
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not close the business day');
    } finally { setSaving(false); }
  };

  const historyColumns = useMemo(() => [
    { title: 'Business date', dataIndex: 'business_date', render: value => dateLabel(value) },
    { title: 'Status', dataIndex: 'status', render: value => <Tag color={value === 'open' ? 'processing' : 'success'}>{String(value).toUpperCase()}</Tag> },
    { title: 'Sales', dataIndex: 'sales_count', align: 'right' },
    { title: 'Net sales', dataIndex: 'total_sales', align: 'right', render: money },
    { title: 'Expected cash', dataIndex: 'expected_cash', align: 'right', render: value => value == null ? '—' : money(value) },
    { title: 'Counted cash', dataIndex: 'counted_cash', align: 'right', render: value => value == null ? '—' : money(value) },
    { title: 'Variance', dataIndex: 'cash_variance', align: 'right', render: value => value == null ? '—' : <Text type={Number(value) === 0 ? 'success' : 'danger'} strong>{money(value)}</Text> },
    { title: 'Closed by', render: (_, row) => row.closedBy?.name || '—' }
  ], []);

  if (stateQuery.loading && !stateQuery.data.business_date) return <div className="day-register-loading"><Spin size="large" /></div>;

  return <main className="day-register-page">
    <header className="day-register-heading">
      <div><span className="day-register-eyebrow">POS CONTROL</span><Title level={2}>Day register</Title><Text type="secondary">Open the till, monitor collections, and reconcile cash before closing.</Text></div>
      <Button icon={<ReloadOutlined />} onClick={refresh} loading={stateQuery.loading || historyQuery.loading}>Refresh</Button>
    </header>

    {current ? <>
      {current.business_date !== stateQuery.data.business_date && <Alert showIcon type="warning" message={`The register for ${dateLabel(current.business_date)} is still open`} description="Sales will continue under that business date until you close it." />}
      <Card className="day-register-hero">
        <div className="day-register-status"><span><ClockCircleOutlined /></span><div><Text>REGISTER OPEN</Text><Title level={3}>{dateLabel(current.business_date)}</Title><small>Opened {timeLabel(current.opened_at)} by {current.openedBy?.name || 'User'}</small></div></div>
        <Button danger size="large" icon={<LockOutlined />} onClick={() => { closeForm.setFieldsValue({ counted_cash: current.expected_cash, closing_note: '' }); setCloseVisible(true); }}>Close day</Button>
      </Card>
      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}><Card><Statistic title="Opening cash" value={Number(current.opening_cash)} precision={2} prefix="₹" /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Net sales" value={Number(current.total_sales)} precision={2} prefix="₹" suffix={<small>{current.sales_count} bills · {current.return_count || 0} returns</small>} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Cash collected" value={Number(current.cash_movement)} precision={2} prefix="₹" /></Card></Col>
        <Col xs={12} lg={6}><Card className="expected-card"><Statistic title="Expected in drawer" value={expectedCash} precision={2} prefix="₹" /></Card></Col>
      </Row>
      <Card title="Net movement by payment method" className="day-register-payments">
        {(current.payment_summary || []).length ? <div className="payment-summary-grid">{current.payment_summary.map(row => <div key={row.payment_method_id || row.name}><span>{row.name}<small>{row.count} payment{row.count === 1 ? '' : 's'}</small></span><strong>{money(row.amount)}</strong></div>)}</div> : <div className="day-register-empty">No sales have been recorded in this register.</div>}
      </Card>
    </> : <Card className="day-register-closed-state">
      <span className="closed-state-icon"><WalletOutlined /></span>
      <Title level={3}>{stateQuery.data.today_record?.status === 'closed' ? 'Today’s register is closed' : 'Register is closed'}</Title>
      <Text type="secondary">{stateQuery.data.today_record?.status === 'closed' ? 'Today has already been reconciled. A closed day cannot be reopened.' : `Enter the cash currently in the drawer to open ${dateLabel(stateQuery.data.business_date)}.`}</Text>
      {stateQuery.data.can_open ? <Button type="primary" size="large" icon={<PlayCircleOutlined />} onClick={() => { openForm.setFieldsValue({ opening_cash: 0, opening_note: '' }); setOpenVisible(true); }}>Open business day</Button> : <Tag color="success" icon={<CheckCircleOutlined />}>DAY CLOSED</Tag>}
    </Card>}

    <Card title={<Space><CalendarOutlined /> Recent day closures</Space>} className="day-register-history">
      <Table rowKey="id" dataSource={historyQuery.data} columns={historyColumns} loading={historyQuery.loading} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 950 }} />
    </Card>

    <Modal title="Open business day" open={openVisible} onCancel={() => !saving && setOpenVisible(false)} onOk={() => openForm.submit()} okText="Open day" confirmLoading={saving} destroyOnHidden>
      <Alert type="info" showIcon message={dateLabel(stateQuery.data.business_date)} description="Opening cash is the float physically present before the first sale." />
      <Form form={openForm} layout="vertical" onFinish={openDay} className="day-register-form">
        <Form.Item name="opening_cash" label="Opening cash in drawer" rules={[{ required: true, message: 'Enter the opening cash' }]}><InputNumber min={0} precision={2} prefix="₹" style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="opening_note" label="Opening note (optional)"><Input.TextArea rows={3} maxLength={500} /></Form.Item>
      </Form>
    </Modal>

    <Modal title="Close and reconcile day" open={closeVisible} onCancel={() => !saving && setCloseVisible(false)} onOk={() => closeForm.submit()} okText="Close day permanently" okButtonProps={{ danger: true }} confirmLoading={saving} width={560} destroyOnHidden>
      <Alert type="warning" showIcon message="Count the physical cash before closing" description="Closing locks this register. It cannot be reopened." />
      <div className="close-reconciliation"><div><span>Opening cash</span><strong>{money(current?.opening_cash)}</strong></div><div><span>Net cash movement</span><strong>{money(current?.cash_movement)}</strong></div><div className="expected"><span>Expected cash</span><strong>{money(expectedCash)}</strong></div></div>
      <Form form={closeForm} layout="vertical" onFinish={closeDay} className="day-register-form">
        <Form.Item name="counted_cash" label="Cash counted in drawer" rules={[{ required: true, message: 'Enter counted cash' }]}><InputNumber min={0} precision={2} prefix="₹" style={{ width: '100%' }} /></Form.Item>
        <div className={`variance-preview ${variance === 0 ? 'balanced' : 'different'}`}><span>Variance</span><strong>{money(variance)}</strong></div>
        <Form.Item name="closing_note" label="Closing note (optional)"><Input.TextArea rows={3} maxLength={500} placeholder={variance ? 'Explain the cash difference' : ''} /></Form.Item>
      </Form>
    </Modal>
  </main>;
}
