import React from 'react';
import { Card, Breadcrumb, Descriptions, Steps, Table, Tag, Button, Space, message } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams, Link } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import './ProductionOrders.css';

export default function ProductionOrderDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: orderData, reload } = useApiData(id ? `/production-orders/${id}` : null, { enabled: Boolean(id), initialData: {} });
  const order = {
    ...orderData,
    product: orderData.finishedGood?.product?.name || '—',
    variant: orderData.finishedGood?.size_label || orderData.finishedGood?.name || orderData.finished_good_id || '—',
    sku: orderData.finishedGood?.sku || '—',
    formula: orderData.formula?.name || orderData.formula_id || '—',
    sourceSale: orderData.retailSale?.sale_number || null,
    batch: orderData.batch_number || '—',
    planned: Number(orderData.planned_qty || 0),
    actual: orderData.actual_qty == null ? null : Number(orderData.actual_qty),
    date: orderData.planned_date || '—',
    status: orderData.status === 'in_progress' ? 'In Progress'
      : orderData.status ? orderData.status[0].toUpperCase() + orderData.status.slice(1) : 'Planned',
    materials: (orderData.productionMaterials || []).map(item => ({
      ...item,
      key: item.id,
      name: item.material_name || 'Material not found',
      type: item.material_type === 'raw' ? 'Raw Material' : 'Packaging',
      unit: item.material_unit || (item.material_type === 'packaging' ? 'pcs' : 'units'),
      required: Number(item.required_qty || 0),
      available: Number(item.available_qty || 0),
      status: item.is_available ? 'Available' : 'Low Stock'
    })),
    outputs: orderData.productionOutputs || []
  };

  const handleStart = async () => {
    await client.post(`/production-orders/${id}/start`);
    await reload();
    message.success('Production started successfully!');
  };

  const handleComplete = async () => {
    const { data: availability } = await client.get(`/production-orders/${id}/availability`);
    const shortages = availability.filter(item => !item.is_available);
    if (shortages.length) {
      message.error(`Cannot complete: ${shortages.map(item => `${item.material_type === 'raw' ? 'Raw material' : 'Packaging'} needs ${item.required_qty}, only ${item.current_stock} available`).join('; ')}`, 8);
      return;
    }
    await client.post(`/production-orders/${id}/complete`, { actual_qty: order.outputs.map(output => ({ finished_good_id: output.finished_good_id, actual_qty: Number(output.planned_qty) })) });
    await reload();
    message.success('Production order marked as Completed!');
  };

  const getStepCurrent = () => {
    if (order.status === 'Planned') return 0;
    if (order.status === 'In Progress') return 1;
    if (order.status === 'Completed') return 2;
    return -1;
  };

  const materialColumns = [
    { title: 'Material Name', dataIndex: 'name', key: 'name', render: text => <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{text}</span> },
    { title: 'Type', dataIndex: 'type', key: 'type', render: t => <Tag color={t === 'Raw Material' ? 'cyan' : 'blue'}>{t}</Tag> },
    { title: 'Required', dataIndex: 'required', key: 'required', align: 'right', render: (v, r) => `${v} ${r.unit}` },
    { title: 'Available Stock', dataIndex: 'available', key: 'available', align: 'right', render: (v, r) => `${v} ${r.unit}` },
    { title: 'Status', dataIndex: 'status', key: 'status', render: status => <Tag color={status === 'Available' ? 'success' : 'warning'}>{status}</Tag> }
  ];

  return (
    <div className="production-page production-detail-page">
      <Breadcrumb style={{ marginBottom: 16 }}>
        <Breadcrumb.Item><Link to="/app/dashboard" style={{ color: 'var(--color-text-secondary)' }}>Dashboard</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to="/app/production" style={{ color: 'var(--color-text-secondary)' }}>Production</Link></Breadcrumb.Item>
        <Breadcrumb.Item><span style={{ color: 'var(--color-gold)' }}>{order.id}</span></Breadcrumb.Item>
      </Breadcrumb>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space size="middle">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/production')} />
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>Production Order Detail</h1>
        </Space>
        <Space>
          {order.status === 'Planned' && (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStart}>Start Production</Button>
          )}
          {order.status === 'In Progress' && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleComplete}>Complete Production</Button>
          )}
        </Space>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <Steps
          current={getStepCurrent()}
          items={[
            { title: 'Planned', description: `Scheduled for ${order.date}` },
            { title: 'In Progress', description: 'Mixing & Formulation' },
            { title: 'Completed', description: 'Packaged & Stored' }
          ]}
          style={{ padding: '12px 0' }}
        />
      </Card>

      <Card title="Order Specifications" style={{ marginBottom: 24 }}>
        <Descriptions column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}>
          <Descriptions.Item label="Order ID" labelStyle={{ color: 'var(--color-text-secondary)' }}>{order.id}</Descriptions.Item>
          <Descriptions.Item label="Product" labelStyle={{ color: 'var(--color-text-secondary)' }}>{order.product}</Descriptions.Item>
          <Descriptions.Item label="Variant / SKU" labelStyle={{ color: 'var(--color-text-secondary)' }}>{order.variant} ({order.sku})</Descriptions.Item>
          <Descriptions.Item label="Recipe Formula" labelStyle={{ color: 'var(--color-text-secondary)' }}>{order.formula}</Descriptions.Item>
          <Descriptions.Item label="Batch Code" labelStyle={{ color: 'var(--color-text-secondary)' }}>{order.batch}</Descriptions.Item>
          {order.sourceSale && <Descriptions.Item label="Created by Sale" labelStyle={{ color: 'var(--color-text-secondary)' }}><Button type="link" onClick={() => navigate(`/app/retail-sales/${order.retail_sale_id}`)}>{order.sourceSale}</Button></Descriptions.Item>}
          <Descriptions.Item label="Planned Quantity" labelStyle={{ color: 'var(--color-text-secondary)' }}>{order.planned} units</Descriptions.Item>
          <Descriptions.Item label="Actual Output" labelStyle={{ color: 'var(--color-text-secondary)' }}>{order.actual != null ? `${order.actual} units` : '-'}</Descriptions.Item>
          <Descriptions.Item label="Planned Date" labelStyle={{ color: 'var(--color-text-secondary)' }}>{order.date}</Descriptions.Item>
          <Descriptions.Item label="Status" labelStyle={{ color: 'var(--color-text-secondary)' }}>
            <Tag color={order.status === 'Completed' ? 'success' : (order.status === 'In Progress' ? 'processing' : 'warning')}>{order.status}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {order.outputs.length > 0 && <Card title="Variants & Packaging Output" style={{ marginBottom: 24 }}>
        <div className="desktop-only">
          <Table pagination={false} rowKey="id" dataSource={order.outputs} columns={[
            { title: 'Variant / SKU', render: (_, output) => `${output.finishedGood?.product?.name || output.finishedGood?.name || 'Variant'} — ${output.finishedGood?.size_label || ''} (${output.finishedGood?.sku || '—'})` },
            { title: 'Planned Units', dataIndex: 'planned_qty', align: 'right', render: value => `${Number(value)} units` },
            { title: 'Actual Units', dataIndex: 'actual_qty', align: 'right', render: value => value == null ? '—' : `${Number(value)} units` }
          ]} />
        </div>
        <div className="mobile-only">
          {order.outputs.map((output) => (
            <Card 
              key={output.id} 
              size="small" 
              style={{ marginBottom: 12, borderColor: 'var(--color-border)' }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--color-text-primary)' }}>
                {output.finishedGood?.product?.name || output.finishedGood?.name || 'Variant'} — {output.finishedGood?.size_label || ''} ({output.finishedGood?.sku || '—'})
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                <span>Planned: <strong style={{ color: 'var(--color-text-primary)' }}>{Number(output.planned_qty)} units</strong></span>
                <span>Actual: <strong style={{ color: 'var(--color-text-primary)' }}>{output.actual_qty == null ? '—' : `${Number(output.actual_qty)} units`}</strong></span>
              </div>
            </Card>
          ))}
        </div>
      </Card>}

      <Card title="Material Requirements Check">
        <div className="desktop-only">
          <Table dataSource={order.materials} columns={materialColumns} pagination={false} />
        </div>
        <div className="mobile-only">
          {order.materials.map((mat) => (
            <Card 
              key={mat.key} 
              size="small" 
              style={{ marginBottom: 12, borderColor: 'var(--color-border)' }}
              title={<span style={{ fontSize: 13, fontWeight: 600 }}>{mat.name}</span>}
              extra={<Tag color={mat.status === 'Available' ? 'success' : 'warning'}>{mat.status}</Tag>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Type:</span>
                  <Tag color={mat.type === 'Raw Material' ? 'cyan' : 'blue'} style={{ marginRight: 0 }}>{mat.type}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Required Quantity:</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{mat.required} {mat.unit}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Available Stock:</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{mat.available} {mat.unit}</strong>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}
