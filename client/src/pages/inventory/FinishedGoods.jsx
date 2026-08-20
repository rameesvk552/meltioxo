import React, { useState, useEffect } from 'react';
import { Table, Card, Row, Col, Tag, Button, Input, Select, Space, Typography, Modal, Form, message } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, ShareAltOutlined } from '@ant-design/icons';
import useApiData from '../../hooks/useApiData';
import client from '../../api/client';
import PageDrawerControls from '../../components/common/PageDrawerControls';

const { Title, Text } = Typography;
const { Option } = Select;

export default function FinishedGoods() {
  const { data, loading, reload } = useApiData('/finished-goods');
  const { data: formulas } = useApiData('/formulas');
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (data) {
      setProducts(data.map(item => ({
        ...item,
        sp: Number(item.selling_price || 0),
        cp: Number(item.cost_price || 0),
        stock: Number(item.current_stock || 0),
        reorder: Number(item.reorder_level || 50),
        formula: item.formula_id || '—',
        size: item.size || '',
        status: Number(item.current_stock || 0) <= 0 ? 'Out of Stock'
          : Number(item.current_stock || 0) <= Number(item.reorder_level || 50) ? 'Low Stock' : 'In Stock'
      })));
    }
  }, [data]);

  const [searchText, setSearchText] = useState('');
  const [sizeFilter, setSizeFilter] = useState('All Sizes');
  const [stockFilter, setStockFilter] = useState('All Stock');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleSearch = (e) => {
    setSearchText(e.target.value);
  };

  const handleSizeChange = (value) => {
    setSizeFilter(value);
  };

  const handleStockChange = (value) => {
    setStockFilter(value);
  };

  const handleAddProduct = async (values) => {
    const nextId = (products.length > 0 ? Math.max(...products.map(p => parseInt(p.id) || 0)) + 1 : 1).toString();
    const nextSku = `FG-${String(nextId).padStart(3, '0')}`;
    const stock = parseFloat(values.stock);
    const reorder = parseFloat(values.reorder || 50);
    const sp = parseFloat(values.sp);
    const cp = parseFloat(values.cp);
    
    let status = 'In Stock';
    if (stock === 0) {
      status = 'Out of Stock';
    } else if (stock <= reorder) {
      status = 'Low Stock';
    }

    const newProduct = {
      id: nextId,
      sku: nextSku,
      name: values.name,
      size: values.size || '100ml',
      formula: values.formula || '—',
      sp: sp,
      cp: cp,
      stock: stock,
      reorder: reorder,
      status: status
    };

    await client.post('/finished-goods', {
      sku: values.sku || undefined,
      name: newProduct.name,
      formula_id: values.formula || null,
      selling_price: newProduct.sp,
      cost_price: newProduct.cp,
      current_stock: newProduct.stock,
      reorder_level: newProduct.reorder
    });
    await reload();
    setIsModalOpen(false);
    form.resetFields();
    message.success('Finished product added successfully!');
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchText.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchText.toLowerCase()) ||
                          p.formula.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesSize = sizeFilter === 'All Sizes' || p.size === sizeFilter;
    
    let matchesStock = true;
    const currentStatus = p.stock === 0 ? 'Out of Stock' : (p.stock <= p.reorder ? 'Low Stock' : 'In Stock');
    if (stockFilter === 'Low Stock') {
      matchesStock = currentStatus === 'Low Stock';
    } else if (stockFilter === 'Out of Stock') {
      matchesStock = currentStatus === 'Out of Stock';
    }

    return matchesSearch && matchesSize && matchesStock;
  });

  const totalSKUs = products.length;
  
  // Calculate average margin, handle division by zero
  const totalMarginSum = products.reduce((sum, p) => sum + (p.sp > 0 ? ((p.sp - p.cp) / p.sp * 100) : 0), 0);
  const avgMargin = products.length > 0 ? (totalMarginSum / products.length) : 0;
  
  const totalInventoryValue = products.reduce((sum, p) => sum + (p.stock * p.cp), 0);
  const outOfStockCount = products.filter(p => p.stock === 0).length;

  const columns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', render: t => <Text style={{ color: 'var(--color-gold)' }}>{t}</Text> },
    { title: 'Product Name', dataIndex: 'name', key: 'name', render: (t, r) => (
      <div>
        <Text style={{ color: 'inherit', fontWeight: 600, display: 'block' }}>{t}</Text>
        <Text style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{r.size}</Text>
      </div>
    )},
    { title: 'Formula', dataIndex: 'formula', key: 'formula', render: t => <Text style={{ color: '#4299e1' }}>{t}</Text> },
    { title: 'Cost Price', dataIndex: 'cp', key: 'cp', render: v => <Text style={{ color: 'var(--color-text-secondary)' }}>₹{v.toLocaleString()}</Text> },
    { title: 'Selling Price', dataIndex: 'sp', key: 'sp', render: v => <Text style={{ color: 'inherit' }}>₹{v.toLocaleString()}</Text> },
    { title: 'Margin', key: 'margin', render: (_, r) => {
      const margin = r.sp > 0 ? (((r.sp - r.cp) / r.sp) * 100) : 0;
      const color = margin > 60 ? '#48bb78' : margin > 40 ? '#ed8936' : '#f56565';
      return <Text style={{ color, fontWeight: 600 }}>{margin.toFixed(1)}%</Text>;
    }},
    { title: 'Stock', dataIndex: 'stock', key: 'stock', render: v => <Text style={{ color: 'inherit' }}>{v} units</Text> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: s => {
      let color = s === 'In Stock' ? 'success' : s === 'Low Stock' ? 'warning' : 'error';
      return <Tag color={color}>{s}</Tag>;
    }},
    { title: 'Actions', key: 'actions', render: () => (
      <Space size="small">
        <Button type="text" icon={<EyeOutlined />} style={{ color: '#4299e1' }} />
        <Button type="text" icon={<EditOutlined />} style={{ color: 'var(--color-gold)' }} />
        <Button type="text" icon={<ShareAltOutlined />} style={{ color: 'var(--color-text-secondary)' }} />
      </Space>
    )}
  ];

  const statCardStyle = { background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16 };
  const summary = <Row gutter={[12, 12]}>{[['Total SKUs', totalSKUs], ['Avg Margin', `${avgMargin.toFixed(1)}%`], ['Inventory Value', `₹${Math.round(totalInventoryValue).toLocaleString()}`], ['Out of Stock', outOfStockCount]].map(([label, value]) => <Col span={12} key={label}><Card size="small"><Text>{label}</Text><Title level={3}>{value}</Title></Card></Col>)}</Row>;
  const filters = <><Input placeholder="Search products..." prefix={<SearchOutlined />} value={searchText} onChange={handleSearch} /><Select value={sizeFilter} onChange={handleSizeChange} options={['All Sizes', '50ml', '100ml'].map(value => ({ value, label: value }))} /><Select value={stockFilter} onChange={handleStockChange} options={['All Stock', 'Low Stock', 'Out of Stock'].map(value => ({ value, label: value }))} /></>;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ color: 'var(--color-gold)', fontFamily: 'Playfair Display', margin: 0 }}>Finished Goods</Title>
        </div>
        <Space><PageDrawerControls title="Finished goods" summary={summary} filters={filters} activeFilterCount={[searchText, sizeFilter !== 'All Sizes', stockFilter !== 'All Stock'].filter(Boolean).length} onReset={() => { setSearchText(''); setSizeFilter('All Sizes'); setStockFilter('All Stock'); }} /><Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>New Product</Button></Space>
      </div>

      <Row className="page-summary-inline" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}>
          <div style={statCardStyle}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Total SKUs</Text>
            <Text style={{ color: 'inherit', fontSize: 24, fontWeight: 600 }}>{totalSKUs}</Text>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div style={statCardStyle}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Avg Margin</Text>
            <Text style={{ color: '#48bb78', fontSize: 24, fontWeight: 600 }}>{avgMargin.toFixed(1)}%</Text>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div style={statCardStyle}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Total Inventory Value</Text>
            <Text style={{ color: 'var(--color-gold)', fontSize: 24, fontWeight: 600 }}>₹{Math.round(totalInventoryValue).toLocaleString()}</Text>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div style={statCardStyle}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Out of Stock</Text>
            <Text style={{ color: '#f56565', fontSize: 24, fontWeight: 600 }}>{outOfStockCount}</Text>
          </div>
        </Col>
      </Row>

      <Card >
        <Space className="page-filter-inline" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input 
            placeholder="Search products..." 
            prefix={<SearchOutlined />} 
            style={{ width: 250 }} 
            value={searchText}
            onChange={handleSearch}
          />
          <Select value={sizeFilter} onChange={handleSizeChange} style={{ width: 150 }}>
            <Option value="All Sizes">All Sizes</Option>
            <Option value="50ml">50ml</Option>
            <Option value="100ml">100ml</Option>
          </Select>
          <Select value={stockFilter} onChange={handleStockChange} style={{ width: 150 }}>
            <Option value="All Stock">All Stock</Option>
            <Option value="Low Stock">Low Stock</Option>
            <Option value="Out of Stock">Out of Stock</Option>
          </Select>
        </Space>
        
        <Table 
          columns={columns} 
          dataSource={filteredProducts}
          loading={loading}
          scroll={{ x: 1000 }} 
          pagination={{ pageSize: 10 }}
          rowKey="id"
          rowClassName={() => 'dark-table-row'}
          style={{ background: 'transparent' }}
        />
      </Card>

      <Modal
        title="Add New Finished Product"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={handleAddProduct}>
          <Form.Item name="name" label="Product Name" rules={[{ required: true, message: 'Please enter product name' }]}>
            <Input placeholder="e.g. Royal Oud Luxury" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="size" label="Size" initialValue="100ml" rules={[{ required: true }]}>
                <Select>
                  <Option value="50ml">50ml</Option>
                  <Option value="100ml">100ml</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="formula" label="Formula" initialValue="—">
                <Select>
                  <Option value="—">—</Option>
                  {formulas.map(formula => (
                    <Option key={formula.id} value={formula.id}>{formula.code} ({formula.name})</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cp" label="Cost Price (₹)" rules={[{ required: true, message: 'Please enter cost price' }]}>
                <Input type="number" step="any" min={0} prefix="₹" placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sp" label="Selling Price (₹)" rules={[{ required: true, message: 'Please enter selling price' }]}>
                <Input type="number" step="any" min={0} prefix="₹" placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="stock" label="Current Stock" rules={[{ required: true, message: 'Please enter stock' }]}>
                <Input type="number" min={0} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reorder" label="Reorder Level" initialValue={50} rules={[{ required: true, message: 'Please enter reorder level' }]}>
                <Input type="number" min={0} placeholder="50" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => {
                setIsModalOpen(false);
                form.resetFields();
              }}>Cancel</Button>
              <Button type="primary" htmlType="submit">Submit</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
