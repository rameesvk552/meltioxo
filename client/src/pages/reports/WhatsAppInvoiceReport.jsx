import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, DatePicker, Empty, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import { DownloadOutlined, ReloadOutlined, WhatsAppOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../../api/client';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const statusColors = { sent: 'success', failed: 'error', skipped: 'warning', disabled: 'default' };
const statusLabel = value => String(value || '—').replace(/_/g, ' ').toUpperCase();
const csvValue = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

export default function WhatsAppInvoiceReport() {
  const [range, setRange] = useState(() => [dayjs().subtract(29, 'day'), dayjs()]);
  const [status, setStatus] = useState();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, sent: 0, failed: 0, skipped: 0, disabled: 0 });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      from: range[0].format('YYYY-MM-DD'),
      to: range[1].format('YYYY-MM-DD'),
      page: String(pagination.current),
      page_size: String(pagination.pageSize)
    });
    if (status) params.set('status', status);
    return params.toString();
  }, [pagination.current, pagination.pageSize, range, status]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await client.get(`/reports/whatsapp-invoices?${query}`);
      setRows(response.data?.rows || []);
      setSummary(response.data?.summary || { total: 0, sent: 0, failed: 0, skipped: 0, disabled: 0 });
      const next = response.data?.pagination || {};
      setPagination(current => ({ ...current, current: next.page || current.current, pageSize: next.page_size || current.pageSize, total: next.total || 0 }));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const updateFilter = (setter, value) => {
    setPagination(current => ({ ...current, current: 1 }));
    setter(value);
  };

  const exportCsv = () => {
    const header = ['When', 'Invoice', 'Customer', 'Phone last 4', 'Status', 'Template', 'Provider message ID', 'Error'];
    const body = rows.map(row => [
      (row.created_at || row.createdAt) ? dayjs(row.created_at || row.createdAt).format('YYYY-MM-DD HH:mm:ss') : '',
      row.sale_number,
      row.customer_name,
      row.customer_phone_last4,
      statusLabel(row.status),
      row.template_name,
      row.provider_message_id,
      row.error_message
    ]);
    const csv = [header, ...body].map(line => line.map(csvValue).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `whatsapp-invoice-report-${range[0].format('YYYY-MM-DD')}-${range[1].format('YYYY-MM-DD')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const columns = [
    { title: 'When', key: 'created_at', width: 170, render: (_, row) => (row.created_at || row.createdAt) ? dayjs(row.created_at || row.createdAt).format('DD/MM/YYYY HH:mm') : '—' },
    { title: 'Invoice', dataIndex: 'sale_number', key: 'sale_number', width: 140, render: value => <Text strong>{value || '—'}</Text> },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name', width: 190, render: value => value || 'Walk-in customer' },
    { title: 'Phone', dataIndex: 'customer_phone_last4', key: 'customer_phone_last4', width: 100, render: value => value ? `••••${value}` : '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110, render: value => <Tag color={statusColors[value] || 'default'}>{statusLabel(value)}</Tag> },
    { title: 'Template', dataIndex: 'template_name', key: 'template_name', width: 150 },
    { title: 'Reason / provider ID', key: 'details', width: 260, render: (_, row) => row.error_message || row.provider_message_id || '—' }
  ];

  return <div className="standard-page">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      <div>
        <Title level={2} style={{ margin: 0 }}><WhatsAppOutlined style={{ color: '#25D366', marginRight: 8 }} />WhatsApp Invoice Report</Title>
        <Text type="secondary">Invoice delivery attempts recorded by the ERP.</Text>
      </div>
      <Space>
        <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!rows.length}>Export visible rows</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
      </Space>
    </div>

    <Card style={{ marginBottom: 16 }}>
      <Space wrap>
        <RangePicker value={range} onChange={value => value && updateFilter(setRange, value)} allowClear={false} />
        <Select allowClear placeholder="All statuses" value={status} onChange={value => updateFilter(setStatus, value)} style={{ width: 160 }} options={['sent', 'failed', 'skipped', 'disabled'].map(value => ({ value, label: statusLabel(value) }))} />
      </Space>
    </Card>

    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      <Col xs={12} sm={6}><Card><Statistic title="Total attempts" value={summary.total || 0} /></Card></Col>
      <Col xs={12} sm={6}><Card><Statistic title="Sent" value={summary.sent || 0} valueStyle={{ color: '#389e0d' }} /></Card></Col>
      <Col xs={12} sm={6}><Card><Statistic title="Failed" value={summary.failed || 0} valueStyle={{ color: '#cf1322' }} /></Card></Col>
      <Col xs={12} sm={6}><Card><Statistic title="Skipped / disabled" value={Number(summary.skipped || 0) + Number(summary.disabled || 0)} valueStyle={{ color: '#d48806' }} /></Card></Col>
    </Row>

    <Card>
      <Table
        columns={columns}
        dataSource={rows}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1080 }}
        locale={{ emptyText: <Empty description="No WhatsApp invoice attempts found" /> }}
        pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true, pageSizeOptions: [25, 50, 100, 200], showTotal: total => `${total} attempts` }}
        onChange={next => setPagination(current => ({ ...current, current: next.current, pageSize: next.pageSize }))}
      />
    </Card>
  </div>;
}
