import React, { useState } from 'react';
import { Table, Card, Row, Col, Statistic, Tag, Button, Space, Tabs, Modal, Form, Input, InputNumber, Select, DatePicker, message, Radio, Alert } from 'antd';
import { ExperimentOutlined, PlusOutlined, EyeOutlined, CheckCircleOutlined, PlayCircleOutlined, CloseCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import ResponsiveDataTable from '../../components/common/ResponsiveDataTable';
import ResponsiveListPageHeader from '../../components/common/ResponsiveListPageHeader';

const { Option } = Select;

export default function ProductionOrders() {
  const navigate = useNavigate();
  const { data: orderData, loading, reload } = useApiData('/production-orders');
  const { data: finishedGoods } = useApiData('/finished-goods');
  const variants = finishedGoods.filter(item => item.product_id && item.is_active !== false && item.source_type !== 'ready_made');
  const orders = orderData.map(item => ({
    ...item,
    product: item.finishedGood?.product?.name || '—',
    variant: item.finishedGood?.size_label || item.finishedGood?.name || item.finished_good_id || '—',
    sku: item.finishedGood?.sku || '—',
    formula: item.formula?.name || item.formula_id || '—',
    sourceSale: item.retailSale?.sale_number || null,
    batch: item.batch_number,
    planned: Number(item.planned_qty || 0),
    actual: item.actual_qty == null ? null : Number(item.actual_qty),
    outputs: item.productionOutputs || [],
    date: item.planned_date,
    status: item.status === 'in_progress' ? 'In Progress'
      : item.status ? item.status[0].toUpperCase() + item.status.slice(1) : 'Planned'
  }));
  const [activeTab, setActiveTab] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [form] = Form.useForm();
  const [completeForm] = Form.useForm();

  const handleCreateOrder = async (values) => {
    await client.post('/production-orders', {
      outputs: values.outputs.map(row => ({ finished_good_id: row.finishedGoodId, planned_qty: row.planned })),
      batch_number: values.batch,
      planned_qty: values.planned,
      planned_date: values.date.format('YYYY-MM-DD')
    });
    await reload();
    setIsAddModalOpen(false);
    form.resetFields();
    message.success('Production Order planned successfully!');
  };

  const handleStartOrder = async (id) => {
    await client.post(`/production-orders/${id}/start`);
    await reload();
    message.success('Production order started');
  };

  const handleOpenCompleteModal = async (id, planned) => {
    const { data: availability } = await client.get(`/production-orders/${id}/availability`);
    const shortages = availability.filter(item => !item.is_available);
    if (shortages.length) {
      message.error(`Cannot complete: insufficient stock (${shortages.map(item => `${item.required_qty - item.current_stock} short`).join(', ')})`, 8);
      return;
    }
    setSelectedOrderId(id);
    const order = orders.find(item => item.id === id);
    completeForm.setFieldsValue({ outputs: (order?.outputs || []).map(output => ({ finishedGoodId: output.finished_good_id, actual: Number(output.planned_qty) })) });
    setIsCompleteModalOpen(true);
  };

  const handleCompleteOrder = async (values) => {
    await client.post(`/production-orders/${selectedOrderId}/complete`, { actual_qty: values.outputs.map(row => ({ finished_good_id: row.finishedGoodId, actual_qty: row.actual })) });
    await reload();
    setIsCompleteModalOpen(false);
    message.success(`Production Order ${selectedOrderId} completed successfully!`);
  };

  const handleCancelOrder = async (id) => {
    await client.post(`/production-orders/${id}/cancel`);
    await reload();
    message.warning('Production order cancelled');
  };

  const filteredOrders = activeTab === 'All' ? orders : orders.filter(o => o.status === activeTab);
  const statusOptions = ['All', 'Planned', 'In Progress', 'Completed', 'Cancelled'];
  const summary = (
    <Row gutter={[12, 12]}>
      <Col span={12}><Card size="small"><Statistic title="Total Orders" value={orders.length} prefix={<ExperimentOutlined />} /></Card></Col>
      <Col span={12}><Card size="small"><Statistic title="Planned" value={orders.filter(x => x.status === 'Planned').length} /></Card></Col>
      <Col span={12}><Card size="small"><Statistic title="In Progress" value={orders.filter(x => x.status === 'In Progress').length} /></Card></Col>
      <Col span={12}><Card size="small"><Statistic title="Completed" value={orders.filter(x => x.status === 'Completed').length} /></Card></Col>
      <Col span={24}><Card size="small"><Statistic title="Total Output" value={orders.filter(x => x.status === 'Completed').reduce((s, x) => s + (x.actual || 0), 0)} suffix="units" /></Card></Col>
    </Row>
  );

  const columns = [
    { title: 'Order#', dataIndex: 'id', key: 'id', render: text => <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{text}</span> },
    { title: 'Product', dataIndex: 'product', key: 'product' },
    { title: 'Variants', dataIndex: 'variant', key: 'variant', render: (value, row) => row.outputs.length > 1 ? <Tag color="blue">{row.outputs.length} variants</Tag> : `${value} (${row.sku})` },
    { title: 'Formula', dataIndex: 'formula', key: 'formula', responsive: ['lg'] },
    { title: 'Batch Number', dataIndex: 'batch', key: 'batch' },
    { title: 'Source', dataIndex: 'sourceSale', key: 'sourceSale', render: value => value ? <Tag color="gold">Create Now · {value}</Tag> : <Tag>Manual</Tag> },
    { title: 'Planned Units', dataIndex: 'planned', key: 'planned', align: 'right', render: v => `${v} units` },
    { title: 'Actual Units', dataIndex: 'actual', key: 'actual', align: 'right', render: v => v != null ? `${v} units` : '-' },
    { title: 'Planned Date', dataIndex: 'date', key: 'date' },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status', 
      render: status => {
        let color = 'default';
        if (status === 'Planned') color = 'warning';
        if (status === 'In Progress') color = 'processing';
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
          <Button type="text" icon={<EyeOutlined />} style={{ color: 'var(--color-gold)' }} onClick={() => navigate(`/app/production/${record.id}`)} />
          {record.status === 'Planned' && (
            <Button type="text" icon={<PlayCircleOutlined />} style={{ color: '#1677ff' }} onClick={() => handleStartOrder(record.id)}>Start</Button>
          )}
          {record.status === 'In Progress' && (
            <Button type="text" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }} onClick={() => handleOpenCompleteModal(record.id, record.planned)}>Complete</Button>
          )}
          {record.status !== 'Completed' && record.status !== 'Cancelled' && (
            <Button type="text" icon={<CloseCircleOutlined />} style={{ color: '#ff4d4f' }} onClick={() => handleCancelOrder(record.id)}>Cancel</Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <ResponsiveListPageHeader title="Production Orders" summary={summary} activeFilterCount={activeTab === 'All' ? 0 : 1} onReset={() => setActiveTab('All')}
        filters={<Radio.Group value={activeTab} onChange={event => setActiveTab(event.target.value)} optionType="button" buttonStyle="solid" style={{ display: 'grid', gap: 8 }} options={statusOptions.map(value => ({ label: value === 'All' ? 'All orders' : value, value }))} />}
        primaryAction={<Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAddModalOpen(true)}>Plan Production</Button>} />

      <Row className="page-summary-inline" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} lg={5}>
          <Card>
            <Statistic title="Total Orders" value={orders.length} prefix={<ExperimentOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card>
            <Statistic title="Planned" value={orders.filter(x => x.status === 'Planned').length} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card>
            <Statistic title="In Progress" value={orders.filter(x => x.status === 'In Progress').length} styles={{ content: { color: '#1677ff' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={5}>
          <Card>
            <Statistic title="Completed" value={orders.filter(x => x.status === 'Completed').length} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={4}>
          <Card>
            <Statistic title="Total Output" value={orders.filter(x => x.status === 'Completed').reduce((s, x) => s + (x.actual || 0), 0)} suffix="units" />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          items={[
            { key: 'All', label: 'All Orders' },
            { key: 'Planned', label: 'Planned' },
            { key: 'In Progress', label: 'In Progress' },
            { key: 'Completed', label: 'Completed' },
            { key: 'Cancelled', label: 'Cancelled' },
          ]} 
        />
        <ResponsiveDataTable
          columns={columns}
          dataSource={filteredOrders}
          loading={loading}
          emptyText="No production orders found"
          mobileRenderItem={(order) => {
            const color = order.status === 'Completed' ? 'success' : order.status === 'In Progress' ? 'processing' : order.status === 'Cancelled' ? 'error' : 'warning';
            return <>
              <div style={{ display: 'grid', gridTemplateColumns: order.status === 'Planned' || order.status === 'In Progress' ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 12 }}>
                <Button icon={<EyeOutlined />} onClick={() => navigate(`/app/production/${order.id}`)}>View details</Button>
                {order.status === 'Planned' && <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleStartOrder(order.id)}>Start</Button>}
                {order.status === 'In Progress' && <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleOpenCompleteModal(order.id, order.planned)}>Complete</Button>}
              </div>
              {order.status !== 'Completed' && order.status !== 'Cancelled' && <Button danger block icon={<CloseCircleOutlined />} onClick={() => handleCancelOrder(order.id)} style={{ marginBottom: 12 }}>Cancel production</Button>}
              <div className="mobile-data-list__title-row"><strong>{order.product}</strong><Tag color={color}>{order.status}</Tag></div>
              {order.sourceSale && <Tag color="gold" style={{ marginBottom: 6 }}>Create Now · {order.sourceSale}</Tag>}
              <span className="mobile-data-list__code">{order.batch || order.id} · {order.variant}</span>
              <div className="mobile-data-list__metrics"><span>Planned <strong>{order.planned} units</strong></span><span>Actual <strong>{order.actual ?? '—'}{order.actual != null ? ' units' : ''}</strong></span></div>
            </>;
          }}
        />
      </Card>

      <Modal
        title="Plan New Production"
        open={isAddModalOpen}
        onCancel={() => setIsAddModalOpen(false)}
        footer={null}
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateOrder} initialValues={{ outputs: [{}] }}>
          <Alert type="info" showIcon style={{ marginBottom: 16 }} message="One batch can produce several variants. Select variants that use the same formula." />
          <Form.Item
            name="finishedGoodId"
            label="Product Variant to Manufacture"
            hidden
          >
            <Select showSearch optionFilterProp="label" placeholder="White Oud — 100ml">
              {variants.map(variant => (
                <Option
                  key={variant.id}
                  value={variant.id}
                  label={`${variant.product?.name || variant.name} ${variant.size_label || ''} ${variant.sku || ''}`}
                >
                  {variant.product?.name || variant.name} — {variant.size_label || variant.name} ({variant.sku})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="batch" label="Batch Number" rules={[{ required: true }]}>
                <Input placeholder="e.g. B-OU-103" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="date" label="Planned Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.List name="outputs">
            {(fields, { add, remove }) => <>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>What are you making?</div>
              {fields.map((field, index) => (
                <div key={field.key} style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 12px 0', marginBottom: 8 }}>
                  <Row gutter={12} align="middle">
                    <Col flex="auto"><Form.Item {...field} name={[field.name, 'finishedGoodId']} label={index === 0 ? 'Product variant' : 'Another variant'} rules={[{ required: true, message: 'Select a variant' }]}><Select showSearch optionFilterProp="label" placeholder="Select variant">{variants.map(variant => <Option key={variant.id} value={variant.id} label={`${variant.product?.name || variant.name} ${variant.size_label || ''} ${variant.sku || ''}`}>{variant.product?.name || variant.name} ({variant.size_label || variant.name})</Option>)}</Select></Form.Item></Col>
                    <Col xs={19} sm={7}><Form.Item {...field} name={[field.name, 'planned']} label="Units" rules={[{ required: true, message: 'Enter quantity' }]}><InputNumber min={1} style={{ width: '100%' }} placeholder="Qty" /></Form.Item></Col>
                    {fields.length > 1 && <Col xs={5} sm={2} style={{ paddingTop: 3 }}><Button type="text" danger aria-label="Remove variant" icon={<DeleteOutlined />} onClick={() => remove(field.name)} /></Col>}
                  </Row>
                </div>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({})} block>Add variant</Button>
            </>}
          </Form.List>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Plan</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Complete Production Yield"
        open={isCompleteModalOpen}
        onCancel={() => setIsCompleteModalOpen(false)}
        footer={null}
      >
        <Form form={completeForm} layout="vertical" onFinish={handleCompleteOrder}>
          <Form.List name="outputs">{fields => fields.map(field => {
            const variant = variants.find(item => item.id === completeForm.getFieldValue(['outputs', field.name, 'finishedGoodId']));
            return <Card key={field.key} size="small" title={variant ? `${variant.product?.name || variant.name} — ${variant.size_label || variant.name}` : 'Variant output'} style={{ marginBottom: 10 }}><Form.Item {...field} name={[field.name, 'finishedGoodId']} hidden><Input /></Form.Item><Form.Item {...field} name={[field.name, 'actual']} label="Actual finished units" rules={[{ required: true }]} style={{ marginBottom: 0 }}><InputNumber min={0.1} style={{ width: '100%' }} /></Form.Item></Card>;
          })}</Form.List>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsCompleteModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Submit Yield</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
