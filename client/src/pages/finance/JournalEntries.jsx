import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Tag, DatePicker, Button, Space, Modal, Descriptions, Table, message } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, BookOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';
import ResponsiveDataTable from '../../components/common/ResponsiveDataTable';
import ResponsiveListPageHeader from '../../components/common/ResponsiveListPageHeader';
import client from '../../api/client';

const { RangePicker } = DatePicker;

const JournalEntries = () => {
  const navigate = useNavigate();
  const { data: entries, loading, reload } = useApiData('/journal-entries');
  const [selected, setSelected] = useState(null);
  const viewEntry = async id => {
    try { setSelected((await client.get(`/journal-entries/${id}`)).data); }
    catch (error) { message.error(error.response?.data?.message || 'Could not load journal'); }
  };
  const postEntry = async id => {
    try { await client.post(`/journal-entries/${id}/post`); message.success('Journal posted'); await reload(); }
    catch (error) { message.error(error.response?.data?.message || 'Could not post journal'); }
  };
  const journalRows = entries.map(item => ({
    ...item,
    date: item.entry_date,
    reference: item.reference_type || '—',
    debit: Number(item.total_debit || 0),
    credit: Number(item.total_credit || 0),
    status: item.status ? item.status[0].toUpperCase() + item.status.slice(1) : 'Draft'
  }));

  const columns = [
    { title: 'Entry#', dataIndex: 'id', key: 'id' },
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Reference', dataIndex: 'reference', key: 'reference', responsive: ['md'] },
    { title: 'Narration', dataIndex: 'narration', key: 'narration', responsive: ['lg'], ellipsis: true },
    { 
      title: 'Total Debit', 
      dataIndex: 'debit', 
      key: 'debit',
      align: 'right',
      render: (val) => `₹${val.toLocaleString('en-IN')}`
    },
    { 
      title: 'Total Credit', 
      dataIndex: 'credit', 
      key: 'credit',
      align: 'right',
      render: (val) => `₹${val.toLocaleString('en-IN')}`
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => (
        <Tag color={status === 'Posted' ? 'green' : 'amber'}>{status}</Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="text" icon={<EyeOutlined />} style={{ color: 'var(--color-gold)' }} onClick={() => viewEntry(record.id)} />
          {record.status === 'Draft' && <Button type="link" size="small" onClick={() => postEntry(record.id)}>Post</Button>}
        </Space>
      ),
    }
  ];
  const summary = <Row gutter={[12, 12]}><Col span={12}><Card size="small"><Statistic title="Total Entries" value={journalRows.length} /></Card></Col><Col span={12}><Card size="small"><Statistic title="Draft" value={journalRows.filter(item => item.status === 'Draft').length} /></Card></Col><Col span={24}><Card size="small"><Statistic title="Posted" value={journalRows.filter(item => item.status === 'Posted').length} /></Card></Col></Row>;
  const filters = <RangePicker style={{ width: '100%' }} />;

  return (
    <div style={{ padding: 24 }}>
      <ResponsiveListPageHeader title="Journal Entries" summary={summary} filters={filters} primaryAction={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/journal-entries/new')}>New Entry</Button>} />

      <Row className="page-summary-inline" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Total Entries</span>} value={journalRows.length} prefix={<BookOutlined />} styles={{ content: { color: 'var(--color-text-primary)' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Draft</span>} value={journalRows.filter(item => item.status === 'Draft').length} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Posted</span>} value={journalRows.filter(item => item.status === 'Posted').length} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
      </Row>

      <Card >
        <div style={{ marginBottom: 16 }}>
          <RangePicker  />
        </div>
        
        <ResponsiveDataTable columns={columns} dataSource={journalRows} loading={loading} emptyText="No journal entries found" mobileRenderItem={(entry) => <><div className="mobile-data-list__title-row"><strong>{entry.id}</strong><Tag color={entry.status === 'Posted' ? 'success' : 'warning'}>{entry.status}</Tag></div><span className="mobile-data-list__code">{entry.reference}</span><div className="mobile-data-list__metrics"><span>Debit <strong>₹{entry.debit.toLocaleString('en-IN')}</strong></span><span>Credit <strong>₹{entry.credit.toLocaleString('en-IN')}</strong></span></div></>} />
      </Card>
      <Modal title={selected?.entry_number || 'Journal entry'} open={Boolean(selected)} onCancel={() => setSelected(null)} footer={null} width={760}>
        {selected && <><Descriptions size="small" column={2} items={[{ key: 'date', label: 'Date', children: selected.entry_date }, { key: 'status', label: 'Status', children: <Tag color={selected.status === 'posted' ? 'success' : 'warning'}>{selected.status}</Tag> }, { key: 'narration', label: 'Narration', children: selected.narration, span: 2 }]} /><Table style={{ marginTop: 16 }} size="small" pagination={false} rowKey="id" dataSource={selected.journalEntryLines || []} columns={[{ title: 'Description', dataIndex: 'description' }, { title: 'Debit', align: 'right', render: (_, row) => `₹${Number(row.debit || 0).toLocaleString('en-IN')}` }, { title: 'Credit', align: 'right', render: (_, row) => `₹${Number(row.credit || 0).toLocaleString('en-IN')}` }]} /></>}
      </Modal>
    </div>
  );
};

export default JournalEntries;
