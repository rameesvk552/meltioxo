import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Modal, Select, Space, Table, Tag, Typography, DatePicker, Empty, message } from 'antd';
import { ReloadOutlined, SearchOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../../api/client';
import { downloadReport, reportData } from './reportDownloads';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const labelFor = value => String(value || '—').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
const actionColor = { create: 'green', update: 'blue', delete: 'red', login: 'purple', logout: 'gold', login_failed: 'red', register: 'cyan' };

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ search: '', action: undefined, entity_type: undefined, dates: null });
  const [filterOptions, setFilterOptions] = useState({ actions: [], entity_types: [] });
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(pagination.current), page_size: String(pagination.pageSize) });
    if (filters.search) params.set('search', filters.search);
    if (filters.action) params.set('action', filters.action);
    if (filters.entity_type) params.set('entity_type', filters.entity_type);
    if (filters.dates?.[0]) params.set('from', filters.dates[0].format('YYYY-MM-DD'));
    if (filters.dates?.[1]) params.set('to', filters.dates[1].format('YYYY-MM-DD'));
    return params.toString();
  }, [filters, pagination]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await client.get(`/audit-logs?${queryString}`);
      setRows(response.data?.data || []);
      const next = response.data?.pagination || {};
      setPagination(current => ({ ...current, current: next.page || current.current, pageSize: next.page_size || current.pageSize, total: next.total || 0 }));
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    client.get('/audit-logs/filters').then(response => setFilterOptions(response.data || {})).catch(() => {});
  }, []);

  const updateFilter = (name, value) => {
    setPagination(current => ({ ...current, current: 1 }));
    setFilters(current => ({ ...current, [name]: value }));
  };

  const exportAudit = async format => {
    setExporting(true);
    try {
      const params = new URLSearchParams(queryString);
      params.set('page', '1');
      params.set('page_size', '100');
      const first = (await client.get(`/audit-logs?${params}`)).data;
      const events = [...(first.data || [])];
      for (let page = 2; page <= Number(first.pagination?.total_pages || 1); page++) {
        params.set('page', String(page));
        events.push(...((await client.get(`/audit-logs?${params}`)).data.data || []));
      }
      if (events.length !== Number(first.pagination?.total ?? events.length)) {
        throw new Error('Audit events changed while exporting. Please retry.');
      }
      const spec = reportData(`audit-log-${dayjs().format('YYYY-MM-DD')}`, [
        ['Audit log', filters.dates?.[0]?.format('YYYY-MM-DD') || 'All dates', filters.dates?.[1]?.format('YYYY-MM-DD') || 'Today'],
        ['When', 'Actor', 'Email', 'Action', 'Record type', 'Record ID', 'Route', 'Changed fields', 'Changes', 'Before', 'After'],
        ...events.map(row => [dayjs(row.created_at).format('YYYY-MM-DD HH:mm:ss'), row.actor_name || 'System', row.actor_email || '', row.action, row.entity_type, row.entity_id, row.route,
          Object.keys(row.changes || {}).join(', '), JSON.stringify(row.changes || {}), JSON.stringify(row.before_data ?? null), JSON.stringify(row.after_data ?? null)])
      ]);
      downloadReport(spec, format);
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not export the audit log');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { title: 'When', dataIndex: 'created_at', key: 'created_at', width: 180, render: value => dayjs(value).format('DD/MM/YYYY HH:mm:ss') },
    { title: 'Who', key: 'actor', width: 180, render: (_, row) => <Space direction="vertical" size={0}><Text strong>{row.actor_name || 'System'}</Text><Text type="secondary" style={{ fontSize: 12 }}>{row.actor_email || row.actor_role || 'Automated process'}</Text></Space> },
    { title: 'Action', dataIndex: 'action', key: 'action', width: 110, render: value => <Tag color={actionColor[value] || 'default'}>{labelFor(value)}</Tag> },
    { title: 'Record', key: 'record', render: (_, row) => <Space direction="vertical" size={0}><Text>{labelFor(row.entity_type)}</Text><Text type="secondary" copyable={row.entity_id ? { text: row.entity_id } : false}>{row.entity_id || '—'}</Text></Space> },
    { title: 'Changed fields', key: 'changes', render: (_, row) => { const fields = Object.keys(row.changes || {}); return fields.length ? fields.join(', ') : '—'; } },
    { title: '', key: 'view', width: 80, render: (_, row) => <Button type="text" icon={<EyeOutlined />} onClick={() => setSelected(row)} aria-label="View audit details" /> }
  ];

  return (
    <div className="standard-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div><Title level={2} style={{ margin: 0 }}>Audit Log</Title><Text type="secondary">Who did what, when, and exactly what changed.</Text></div>
        <Space wrap><Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button><Button icon={<DownloadOutlined />} loading={exporting} disabled={loading} onClick={() => exportAudit('xlsx')}>Excel</Button><Button icon={<DownloadOutlined />} loading={exporting} disabled={loading} onClick={() => exportAudit('pdf')}>PDF</Button></Space>
      </div>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Search user, record, route..." value={filters.search} onChange={event => updateFilter('search', event.target.value)} style={{ width: 260 }} />
          <Select allowClear placeholder="All actions" value={filters.action} onChange={value => updateFilter('action', value)} style={{ width: 150 }} options={filterOptions.actions.map(value => ({ value, label: labelFor(value) }))} />
          <Select allowClear showSearch placeholder="All record types" value={filters.entity_type} onChange={value => updateFilter('entity_type', value)} style={{ width: 190 }} options={filterOptions.entity_types.map(value => ({ value, label: labelFor(value) }))} />
          <RangePicker value={filters.dates} onChange={value => updateFilter('dates', value)} />
        </Space>
      </Card>
      <Card>
        <Table columns={columns} dataSource={rows} loading={loading} rowKey="id" scroll={{ x: 1050 }} locale={{ emptyText: <Empty description="No audit events found" /> }} pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true, pageSizeOptions: [25, 50, 100], showTotal: total => `${total} events` }} onChange={next => setPagination(current => ({ ...current, current: next.current, pageSize: next.pageSize }))} />
      </Card>
      <Modal open={Boolean(selected)} title="Audit event details" onCancel={() => setSelected(null)} footer={<Button onClick={() => setSelected(null)}>Close</Button>} width={900}>
        {selected && <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space wrap><Tag color={actionColor[selected.action] || 'default'}>{labelFor(selected.action)}</Tag><Text strong>{labelFor(selected.entity_type)}</Text><Text type="secondary">{selected.entity_id || 'No record id'}</Text></Space>
          <Text type="secondary">{dayjs(selected.created_at).format('DD/MM/YYYY HH:mm:ss')} · {selected.actor_name || 'System'} · {selected.route || 'Background process'}</Text>
          <div><Text strong>Field changes</Text><pre style={{ whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto', marginTop: 8 }}>{JSON.stringify(selected.changes || {}, null, 2)}</pre></div>
          <div><Text strong>Before</Text><pre style={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', marginTop: 8 }}>{JSON.stringify(selected.before_data || null, null, 2)}</pre></div>
          <div><Text strong>After</Text><pre style={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', marginTop: 8 }}>{JSON.stringify(selected.after_data || null, null, 2)}</pre></div>
        </Space>}
      </Modal>
    </div>
  );
}
