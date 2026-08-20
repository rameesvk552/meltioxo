import React from 'react';
import { Card, Descriptions, Table, Tag, Typography, Breadcrumb, Space, Button } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, EditOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';

const { Title, Text } = Typography;

export default function RawMaterialDetail() {
  const { id } = useParams();
  const { data: material } = useApiData(`/raw-materials/${id}`, { initialData: {} });
  const movementData = (material.stockMovements || []).map(item => ({
    ...item,
    date: item.createdAt,
    type: item.movement_type,
    dir: item.direction,
    qty: Number(item.quantity || 0),
    bal: item.balance_after == null ? '—' : Number(item.balance_after),
    ref: item.reference_id
  }));
  const batchData = (material.stockBatches || []).map(item => ({
    ...item,
    batch: item.batch_number,
    supplier: item.supplier_id || '—',
    qty: Number(item.quantity || 0),
    remaining: Number(item.remaining_qty || 0),
    cost: Number(item.cost_per_unit || 0),
    date: item.received_date,
    expiry: item.expiry_date || '—'
  }));
  const stock = Number(material.current_stock || 0);
  const reserved = Number(material.reserved_stock || 0);
  const reorder = Number(material.reorder_level || 0);
  const averageCost = Number(material.avg_cost || 0);
  const cardStyle = { background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 24 };

  return (
    <div style={{ padding: '24px' }}>
      <Breadcrumb style={{ marginBottom: 16 }}>
        <Breadcrumb.Item><Link to="/app/raw-materials" style={{ color: 'var(--color-text-secondary)' }}>Inventory</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to="/app/raw-materials" style={{ color: 'var(--color-text-secondary)' }}>Raw Materials</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Text style={{ color: 'var(--color-gold)' }}>{material.name || 'Material'}</Text></Breadcrumb.Item>
      </Breadcrumb>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space align="center">
          <Link to="/app/raw-materials">
            <Button type="text" icon={<ArrowLeftOutlined />} style={{ color: 'inherit' }} />
          </Link>
          <Title level={2} style={{ color: 'var(--color-gold)', fontFamily: 'Playfair Display', margin: 0 }}>{material.name || 'Material'} ({material.sku || '—'})</Title>
          <Tag color={stock <= reorder ? 'warning' : 'success'}>{stock <= 0 ? 'Out of Stock' : stock <= reorder ? 'Low Stock' : 'In Stock'}</Tag>
        </Space>
        <Space>
          <Button icon={<PrinterOutlined />} style={{ background: 'transparent', color: 'inherit', borderColor: '#2d3748' }}>Print</Button>
          <Button type="primary" icon={<EditOutlined />} >Edit</Button>
        </Space>
      </div>

      <Card style={cardStyle}>
        <Descriptions column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }} labelStyle={{ color: 'var(--color-text-secondary)' }} contentStyle={{ color: 'inherit', fontWeight: 500 }}>
          <Descriptions.Item label="Category"><Tag color="blue">{material.category || '—'}</Tag></Descriptions.Item>
          <Descriptions.Item label="Base Unit">{material.unit || '—'}</Descriptions.Item>
          <Descriptions.Item label="Current Stock"><Text style={{ color: '#48bb78', fontSize: 16 }}>{stock} {material.unit}</Text></Descriptions.Item>
          <Descriptions.Item label="Reserved (Orders)">{reserved} {material.unit}</Descriptions.Item>
          <Descriptions.Item label="Available Stock">{stock - reserved} {material.unit}</Descriptions.Item>
          <Descriptions.Item label="Reorder Level"><Text style={{ color: '#ed8936' }}>{reorder} {material.unit}</Text></Descriptions.Item>
          <Descriptions.Item label="Average Cost">₹{averageCost.toLocaleString('en-IN')} / {material.unit}</Descriptions.Item>
          <Descriptions.Item label="Last Purchase Cost">₹{Number(material.last_cost || 0).toLocaleString('en-IN')} / {material.unit}</Descriptions.Item>
          <Descriptions.Item label="Total Value"><Text style={{ color: 'var(--color-gold)' }}>₹{(stock * averageCost).toLocaleString('en-IN')}</Text></Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={cardStyle} title={<Text style={{ color: 'var(--color-gold)' }}>Batch Details</Text>}>
        <Table 
          dataSource={batchData}
          pagination={false}
          scroll={{ x: 600 }}
          rowKey="batch"
          columns={[
            { title: 'Batch #', dataIndex: 'batch', render: t => <Text style={{ color: '#4299e1' }}>{t}</Text> },
            { title: 'Supplier', dataIndex: 'supplier', render: t => <Text style={{ color: 'inherit' }}>{t}</Text> },
            { title: 'Original Qty', dataIndex: 'qty', render: t => <Text style={{ color: 'inherit' }}>{t} kg</Text> },
            { title: 'Remaining', dataIndex: 'remaining', render: t => <Text style={{ color: '#48bb78', fontWeight: 600 }}>{t} kg</Text> },
            { title: 'Cost/Unit', dataIndex: 'cost', render: v => <Text style={{ color: 'inherit' }}>₹{v.toLocaleString()}</Text> },
            { title: 'Received', dataIndex: 'date', render: t => <Text style={{ color: 'var(--color-text-secondary)' }}>{t}</Text> },
            { title: 'Expiry', dataIndex: 'expiry', render: t => <Text style={{ color: 'var(--color-text-secondary)' }}>{t}</Text> },
          ]}
        />
      </Card>

      <Card style={cardStyle} title={<Text style={{ color: 'var(--color-gold)' }}>Stock Movement Ledger</Text>}>
        <Table 
          dataSource={movementData}
          pagination={{ pageSize: 5 }}
          scroll={{ x: 800 }}
          rowKey="id"
          columns={[
            { title: 'Date', dataIndex: 'date', render: t => <Text style={{ color: 'var(--color-text-secondary)' }}>{t}</Text> },
            { title: 'Type', dataIndex: 'type', render: t => <Text style={{ color: 'inherit' }}>{t}</Text> },
            { title: 'Direction', dataIndex: 'dir', render: d => <Tag color={d === 'In' ? 'success' : 'error'}>{d}</Tag> },
            { title: 'Qty', dataIndex: 'qty', render: t => <Text style={{ color: 'inherit' }}>{t} kg</Text> },
            { title: 'Balance', dataIndex: 'bal', render: t => <Text style={{ color: 'var(--color-gold)', fontWeight: 600 }}>{t} kg</Text> },
            { title: 'Reference', dataIndex: 'ref', render: t => <Text style={{ color: '#4299e1' }}>{t}</Text> },
            { title: 'Notes', dataIndex: 'notes', render: t => <Text style={{ color: 'var(--color-text-secondary)' }}>{t}</Text> },
          ]}
        />
      </Card>
    </div>
  );
}
