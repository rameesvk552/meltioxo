import React, { useMemo, useState } from 'react';
import { Alert, Card, Col, Empty, Progress, Row, Select, Spin, Statistic, Table, Tag, Typography } from 'antd';
import { ExperimentOutlined, FallOutlined, InboxOutlined, RiseOutlined, WarningOutlined } from '@ant-design/icons';
import useApiData from '../../hooks/useApiData';

const { Title, Text } = Typography;
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const litres = ml => `${(Number(ml || 0) / 1000).toLocaleString('en-IN', { maximumFractionDigits: 3 })} L`;

export default function ProductionOwnerReport() {
  const { data: report, loading } = useApiData('/reports/production', { initialData: { batches: [] } });
  const batches = report.batches || [];
  const [batchId, setBatchId] = useState();
  const batch = useMemo(() => batches.find(item => item.id === batchId) || batches[0], [batches, batchId]);

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}><Spin size="large" /></div>;
  if (!batch) return <div style={{ padding: 24 }}><Empty description="No production batches yet" /></div>;

  const actualCost = batch.estimated_cost;
  const costPerMl = batch.planned_ml ? actualCost / batch.planned_ml : 0;
  const statusColor = batch.status === 'completed' ? 'success' : batch.status === 'in_progress' ? 'processing' : 'warning';
  const outputRows = batch.outputs.map(output => ({ ...output, cost: output.planned_ml * costPerMl, cost_per_bottle: output.fill_ml ? output.fill_ml * costPerMl : 0 }));
  const alerts = [
    ...(batch.shortages ? [{ type: 'warning', text: `${batch.shortages} material${batch.shortages > 1 ? 's are' : ' is'} below the required quantity.` }] : []),
    ...(batch.waste_ml != null && batch.waste_ml > 0 ? [{ type: 'warning', text: `Recorded yield is ${litres(batch.waste_ml)} below plan.` }] : []),
    ...(!batch.shortages ? [{ type: 'success', text: 'All materials are currently available for this batch.' }] : [])
  ];

  return <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
    <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
      <div>
        <Text type="secondary" style={{ letterSpacing: 1, fontSize: 11 }}>OWNER VIEW · PRODUCTION</Text>
        <Title level={2} style={{ margin: '4px 0', fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)' }}>Batch Profit & Yield</Title>
        <Text type="secondary">A clear view of output, cost, yield and material risk.</Text>
      </div>
      <Select value={batch.id} onChange={setBatchId} style={{ width: 280, maxWidth: '100%' }} options={batches.map(item => ({ value: item.id, label: `${item.order_number} · ${item.formula}` }))} />
    </div>

    <Card style={{ marginBottom: 16, background: 'linear-gradient(135deg, #162238, #263b59)', color: '#fff', border: 0 }} bodyStyle={{ padding: 20 }}>
      <Row gutter={[20, 16]} align="middle">
        <Col xs={24} md={14}>
          <div style={{ fontSize: 12, opacity: .72, marginBottom: 4 }}>PRODUCTION BATCH</div>
          <div style={{ fontSize: 23, fontWeight: 700 }}>{batch.formula}</div>
          <div style={{ marginTop: 8, opacity: .86 }}>{batch.order_number} · Batch {batch.batch_number} · Planned {litres(batch.planned_ml)}</div>
        </Col>
        <Col xs={24} md={10} style={{ textAlign: 'right' }}>
          <Tag color={statusColor} style={{ margin: 0 }}>{batch.status.replace('_', ' ').toUpperCase()}</Tag>
          <div style={{ fontSize: 13, marginTop: 16, opacity: .72 }}>ESTIMATED BATCH COST</div>
          <div style={{ fontSize: 29, fontWeight: 800, color: '#f6cf75' }}>{money(actualCost)}</div>
        </Col>
      </Row>
    </Card>

    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={12} md={6}><Card><Statistic title="Planned output" value={batch.planned_ml / 1000} precision={3} suffix="L" prefix={<ExperimentOutlined />} /></Card></Col>
      <Col xs={12} md={6}><Card><Statistic title="Actual output" value={batch.actual_ml == null ? 'Pending' : batch.actual_ml / 1000} precision={3} suffix={batch.actual_ml == null ? '' : 'L'} prefix={<InboxOutlined />} /></Card></Col>
      <Col xs={12} md={6}><Card><Statistic title="Yield" value={batch.yield_percent == null ? 'Pending' : batch.yield_percent} precision={1} suffix={batch.yield_percent == null ? '' : '%'} prefix={<RiseOutlined />} /></Card></Col>
      <Col xs={12} md={6}><Card><Statistic title="Cost / ml" value={costPerMl} precision={2} prefix="₹" suffix="/ml" /></Card></Col>
    </Row>

    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      {alerts.map((alert, index) => <Col xs={24} key={index}><Alert showIcon type={alert.type} message={alert.text} /></Col>)}
    </Row>

    <Card title="Bottle-size output & cost" style={{ marginBottom: 16 }}>
      <div className="desktop-only"><Table rowKey="id" pagination={false} dataSource={outputRows} columns={[
        { title: 'Variant', dataIndex: 'variant', render: (value, row) => <><strong>{value}</strong><br /><Text type="secondary">{row.sku} · {row.fill_ml} ml</Text></> },
        { title: 'Planned', dataIndex: 'planned_qty', align: 'right', render: value => `${value} bottles` },
        { title: 'Actual', dataIndex: 'actual_qty', align: 'right', render: value => value == null ? 'Pending' : `${value} bottles` },
        { title: 'Liquid', dataIndex: 'planned_ml', align: 'right', render: litres },
        { title: 'Batch cost share', dataIndex: 'cost', align: 'right', render: money },
        { title: 'Cost / bottle', dataIndex: 'cost_per_bottle', align: 'right', render: money }
      ]} /></div>
      <div className="mobile-only">{outputRows.map(row => <Card key={row.id} size="small" style={{ marginBottom: 10 }}><strong>{row.variant}</strong><div style={{ color: 'var(--color-text-secondary)', margin: '4px 0 10px' }}>{row.fill_ml} ml · {row.sku}</div><Row gutter={[8, 8]}><Col span={12}>Planned<br /><strong>{row.planned_qty} bottles</strong></Col><Col span={12}>Liquid<br /><strong>{litres(row.planned_ml)}</strong></Col><Col span={12}>Cost / bottle<br /><strong>{money(row.cost_per_bottle)}</strong></Col><Col span={12}>Actual<br /><strong>{row.actual_qty == null ? 'Pending' : row.actual_qty}</strong></Col></Row></Card>)}</div>
    </Card>

    <Card title="Material readiness & cost">
      <div className="desktop-only"><Table rowKey="id" pagination={false} dataSource={batch.materials} columns={[
        { title: 'Material', dataIndex: 'name', render: (value, row) => <><strong>{value}</strong><br /><Text type="secondary">{row.type === 'raw' ? 'Raw material' : 'Packaging'}</Text></> },
        { title: 'Required', dataIndex: 'required_qty', align: 'right', render: (value, row) => `${value} ${row.unit}` },
        { title: 'Live stock', dataIndex: 'available_qty', align: 'right', render: (value, row) => `${value} ${row.unit}` },
        { title: 'Cost', dataIndex: 'estimated_cost', align: 'right', render: money },
        { title: 'Status', dataIndex: 'is_available', render: value => <Tag color={value ? 'success' : 'warning'}>{value ? 'Available' : 'Shortage'}</Tag> }
      ]} /></div>
      <div className="mobile-only">{batch.materials.map(row => <Card key={row.id} size="small" style={{ marginBottom: 10 }} title={row.name} extra={<Tag color={row.is_available ? 'success' : 'warning'}>{row.is_available ? 'Available' : 'Shortage'}</Tag>}><Row><Col span={12}>Required<br /><strong>{row.required_qty} {row.unit}</strong></Col><Col span={12}>In stock<br /><strong>{row.available_qty} {row.unit}</strong></Col></Row><div style={{ marginTop: 10, color: 'var(--color-text-secondary)' }}>Estimated cost <strong style={{ color: 'var(--color-text-primary)' }}>{money(row.estimated_cost)}</strong></div></Card>)}</div>
    </Card>
  </div>;
}
