import React, { useState } from 'react';
import { Card, Table, Row, Col, Statistic, Tag, Select, Typography } from 'antd';
import { AppstoreOutlined, AlertOutlined, DollarOutlined } from '@ant-design/icons';
import useApiData from '../../hooks/useApiData';

const { Title } = Typography;
const { Option } = Select;

const StockReport = () => {
  const [filterType, setFilterType] = useState('All');
  const { data: rawMaterials, loading: loadingRaw } = useApiData('/raw-materials');
  const { data: packaging, loading: loadingPackaging } = useApiData('/packaging-materials');
  const { data: finished, loading: loadingFinished } = useApiData('/finished-goods');
  const stockRows = [
    ...rawMaterials.map(item => ({ ...item, type: 'Raw Material', current: Number(item.current_stock || 0), reserved: Number(item.reserved_stock || 0), avgCost: Number(item.avg_cost || 0) })),
    ...packaging.map(item => ({ ...item, type: 'Packaging', current: Number(item.current_stock || 0), reserved: Number(item.reserved_stock || 0), avgCost: Number(item.avg_cost || 0) })),
    ...finished.map(item => ({ ...item, type: 'Finished Goods', unit: item.unit || 'pcs', current: Number(item.current_stock || 0), reserved: 0, avgCost: Number(item.cost_price || 0) }))
  ];

  const processedData = stockRows.map(item => ({
    ...item,
    available: item.current - item.reserved,
    totalValue: item.current * item.avgCost,
    isLow: item.current < 50
  }));

  const filteredData = filterType === 'All' ? processedData : processedData.filter(d => d.type === filterType);
  
  const totalItems = filteredData.length;
  const totalValue = filteredData.reduce((sum, item) => sum + item.totalValue, 0);
  const lowStockCount = filteredData.filter(item => item.isLow).length;

  const columns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Item Name', dataIndex: 'name', key: 'name' },
    { 
      title: 'Type', 
      dataIndex: 'type', 
      key: 'type',
      render: (type) => {
        let color = 'default';
        if (type === 'Raw Material') color = 'purple';
        if (type === 'Packaging') color = 'cyan';
        if (type === 'Finished Goods') color = 'green';
        return <Tag color={color}>{type}</Tag>;
      }
    },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', responsive: ['lg'] },
    { 
      title: 'Current Stock', 
      dataIndex: 'current', 
      key: 'current',
      align: 'right',
      render: (val, record) => (
        <span style={{ color: record.isLow ? '#ff4d4f' : 'inherit', fontWeight: record.isLow ? 'bold' : 'normal' }}>
          {val}
        </span>
      )
    },
    { title: 'Reserved', dataIndex: 'reserved', key: 'reserved', align: 'right', responsive: ['md'] },
    { 
      title: 'Available', 
      dataIndex: 'available', 
      key: 'available',
      align: 'right',
      render: val => <span style={{ fontWeight: 'bold' }}>{val}</span>
    },
    { 
      title: 'Avg Cost', 
      dataIndex: 'avgCost', 
      key: 'avgCost',
      align: 'right',
      render: val => `₹${val.toLocaleString('en-IN')}`,
      responsive: ['xl']
    },
    { 
      title: 'Total Value', 
      dataIndex: 'totalValue', 
      key: 'totalValue',
      align: 'right',
      render: val => `₹${val.toLocaleString('en-IN')}`
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <Title level={2} style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>Stock Valuation Report</Title>
        <Select 
          value={filterType} 
          onChange={setFilterType} 
          style={{ width: 200 }}
        >
          <Option value="All">All Material Types</Option>
          <Option value="Raw Material">Raw Materials</Option>
          <Option value="Packaging">Packaging</Option>
          <Option value="Finished Goods">Finished Goods</Option>
        </Select>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Total Items</span>} value={totalItems} prefix={<AppstoreOutlined />} styles={{ content: { color: 'var(--color-text-primary)' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Total Inventory Value</span>} value={totalValue} prefix={<DollarOutlined />} styles={{ content: { color: '#1677ff' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Low Stock Items</span>} value={lowStockCount} prefix={<AlertOutlined />} styles={{ content: { color: '#ff4d4f' } }} />
          </Card>
        </Col>
      </Row>

      <Card >
        <Table 
          columns={columns} 
          dataSource={filteredData}
          loading={loadingRaw || loadingPackaging || loadingFinished}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default StockReport;
