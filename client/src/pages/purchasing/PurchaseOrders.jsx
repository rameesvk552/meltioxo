import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Tag, Button, Space, Tabs, message, Radio } from 'antd';
import { ShoppingCartOutlined, PlusOutlined, EyeOutlined, CheckCircleOutlined, CarOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import ResponsiveDataTable from '../../components/common/ResponsiveDataTable';
import ResponsiveListPageHeader from '../../components/common/ResponsiveListPageHeader';

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const { data, loading, reload } = useApiData('/purchase-orders');
  const pos = data.map(item => ({
    ...item,
    supplier: item.supplier?.name || item.supplier_id || '—',
    date: item.order_date,
    expected: item.expected_date,
    items: item.purchaseOrderItems?.length || 0,
    total: Number(item.total_amount || 0),
    status: item.status === 'sent' || item.status === 'partial' ? 'In Transit'
      : item.status ? item.status[0].toUpperCase() + item.status.slice(1) : 'Draft'
  }));
  const [activeTab, setActiveTab] = useState('All');

  const updatePOStatus = async (id, newStatus) => {
    if (newStatus === 'In Transit') {
      await client.put(`/purchase-orders/${id}`, { status: 'sent' });
      await reload();
      message.success('Purchase order marked as sent');
      return;
    }
    const action = newStatus === 'Approved' ? 'approve' : newStatus === 'Completed' ? 'receive' : 'cancel';
    await client.post(`/purchase-orders/${id}/${action}`);
    await reload();
    message.success(`Purchase order action completed`);
  };

  const filteredPOs = activeTab === 'All' ? pos : pos.filter(po => po.status === activeTab);
  const statusOptions = ['All', 'Draft', 'Approved', 'In Transit', 'Completed', 'Cancelled'];
  const summary = (
    <Row gutter={[12, 12]}>
      <Col span={12}><Card size="small"><Statistic title="Total POs" value={pos.length} prefix={<ShoppingCartOutlined />} /></Card></Col>
      <Col span={12}><Card size="small"><Statistic title="Draft" value={pos.filter(x => x.status === 'Draft').length} /></Card></Col>
      <Col span={12}><Card size="small"><Statistic title="Approved" value={pos.filter(x => x.status === 'Approved').length} /></Card></Col>
      <Col span={12}><Card size="small"><Statistic title="In Transit" value={pos.filter(x => x.status === 'In Transit').length} /></Card></Col>
      <Col span={24}><Card size="small"><Statistic title="Completed" value={pos.filter(x => x.status === 'Completed').length} /></Card></Col>
    </Row>
  );

  const columns = [
    { title: 'PO#', dataIndex: 'id', key: 'id', render: text => <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{text}</span> },
    { title: 'Supplier', dataIndex: 'supplier', key: 'supplier' },
    { title: 'Order Date', dataIndex: 'date', key: 'date' },
    { title: 'Expected Date', dataIndex: 'expected', key: 'expected', responsive: ['md'] },
    { title: 'Items', dataIndex: 'items', key: 'items', align: 'center', responsive: ['lg'] },
    { title: 'Total Amount', dataIndex: 'total', key: 'total', align: 'right', render: v => `₹${v.toLocaleString()}` },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: status => {
        let color = 'default';
        if (status === 'Draft') color = 'warning';
        if (status === 'Approved') color = 'processing';
        if (status === 'In Transit') color = 'purple';
        if (status === 'Completed') color = 'success';
        if (status === 'Cancelled') color = 'error';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button type="text" icon={<EyeOutlined />} style={{ color: 'var(--color-gold)' }} onClick={() => message.info(`Viewing details of ${record.id}`)} />
          {record.status === 'Draft' && (
            <Button type="text" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }} onClick={() => updatePOStatus(record.id, 'Approved')}>Approve</Button>
          )}
          {record.status === 'Approved' && (
            <Button type="text" icon={<CarOutlined />} style={{ color: 'var(--color-gold)' }} onClick={() => updatePOStatus(record.id, 'In Transit')}>Ship</Button>
          )}
          {record.status === 'In Transit' && (
            <Button type="text" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }} onClick={() => updatePOStatus(record.id, 'Completed')}>Receive</Button>
          )}
          {record.status !== 'Completed' && record.status !== 'Cancelled' && (
            <Button type="text" icon={<CloseCircleOutlined />} style={{ color: '#ff4d4f' }} onClick={() => updatePOStatus(record.id, 'Cancelled')}>Cancel</Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <ResponsiveListPageHeader title="Purchase Orders" summary={summary} activeFilterCount={activeTab === 'All' ? 0 : 1} onReset={() => setActiveTab('All')}
        filters={<Radio.Group value={activeTab} onChange={event => setActiveTab(event.target.value)} optionType="button" buttonStyle="solid" style={{ display: 'grid', gap: 8 }} options={statusOptions.map(value => ({ label: value === 'All' ? 'All orders' : value, value }))} />}
        primaryAction={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/purchase-orders/new')}>New PO</Button>} />

      <Row className="page-summary-inline" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic title="Total POs" value={pos.length} prefix={<ShoppingCartOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card>
            <Statistic title="Draft" value={pos.filter(x => x.status === 'Draft').length} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card>
            <Statistic title="Approved" value={pos.filter(x => x.status === 'Approved').length} styles={{ content: { color: '#1677ff' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={5}>
          <Card>
            <Statistic title="In Transit" value={pos.filter(x => x.status === 'In Transit').length} styles={{ content: { color: '#722ed1' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={5}>
          <Card>
            <Statistic title="Completed" value={pos.filter(x => x.status === 'Completed').length} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          items={[
            { key: 'All', label: 'All Orders' },
            { key: 'Draft', label: 'Draft' },
            { key: 'Approved', label: 'Approved' },
            { key: 'In Transit', label: 'In Transit' },
            { key: 'Completed', label: 'Completed' },
            { key: 'Cancelled', label: 'Cancelled' },
          ]} 
        />
        <ResponsiveDataTable
          columns={columns}
          dataSource={filteredPOs}
          loading={loading}
          emptyText="No purchase orders found"
          mobileRenderItem={(po) => {
            const color = po.status === 'Completed' ? 'success' : po.status === 'In Transit' ? 'purple' : po.status === 'Approved' ? 'processing' : po.status === 'Cancelled' ? 'error' : 'warning';
            return <>
              <div style={{ display: 'grid', gridTemplateColumns: po.status === 'Completed' || po.status === 'Cancelled' ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <Button icon={<EyeOutlined />} onClick={() => message.info(`Purchase order ${po.id}`)}>View details</Button>
                {po.status === 'Draft' && <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => updatePOStatus(po.id, 'Approved')}>Approve</Button>}
                {po.status === 'Approved' && <Button type="primary" icon={<CarOutlined />} onClick={() => updatePOStatus(po.id, 'In Transit')}>Ship</Button>}
                {po.status === 'In Transit' && <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => updatePOStatus(po.id, 'Completed')}>Receive</Button>}
              </div>
              {po.status !== 'Completed' && po.status !== 'Cancelled' && <Button danger block icon={<CloseCircleOutlined />} onClick={() => updatePOStatus(po.id, 'Cancelled')} style={{ marginBottom: 12 }}>Cancel purchase order</Button>}
              <div className="mobile-data-list__title-row"><strong>{po.id}</strong><Tag color={color}>{po.status}</Tag></div>
              <span className="mobile-data-list__code">{po.supplier} · {po.items} item{po.items === 1 ? '' : 's'}</span>
              <div className="mobile-data-list__metrics"><span>Total <strong>₹{po.total.toLocaleString('en-IN')}</strong></span><span>Expected <strong>{po.expected || '—'}</strong></span></div>
            </>;
          }}
        />
      </Card>
    </div>
  );
}
