import React, { useState, useEffect } from 'react';
import { Table, Card, Row, Col, Tag, Button, Input, Select, Space, Typography, Progress, Modal, Form, message } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, ToolOutlined, DeleteOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';
import client from '../../api/client';
import MobileDataList from '../../components/common/MobileDataList';
import PageDrawerControls from '../../components/common/PageDrawerControls';
import SingleTagSelect from '../../components/common/SingleTagSelect';

const { Title, Text } = Typography;
const { Option } = Select;

export default function RawMaterials() {
  const { data, loading, reload } = useApiData('/raw-materials');
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    if (data) {
      setMaterials(data.map(item => ({
        ...item,
        stock: Number(item.current_stock || 0),
        reorder: Number(item.reorder_level || 0),
        avgCost: Number(item.avg_cost || 0),
        status: Number(item.current_stock || 0) <= 0 ? 'Out of Stock'
          : Number(item.current_stock || 0) <= Number(item.reorder_level || 0) ? 'Low Stock' : 'In Stock'
      })));
    }
  }, [data]);

  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [stockFilter, setStockFilter] = useState('All Stock');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [form] = Form.useForm();

  const handleSearch = (e) => {
    setSearchText(e.target.value);
  };

  const handleCategoryChange = (value) => {
    setCategoryFilter(value);
  };

  const handleStockChange = (value) => {
    setStockFilter(value);
  };

  const handleAddMaterial = async (values) => {
    const payload = {
      sku: values.sku,
      name: values.name,
      category: Array.isArray(values.category) ? values.category[0] : values.category,
      unit: values.unit,
      current_stock: Number(values.stock || 0),
      reorder_level: Number(values.reorder || 0),
      avg_cost: Number(values.avgCost || 0)
    };
    if (editingMaterial) await client.put(`/raw-materials/${editingMaterial.id}`, payload);
    else await client.post('/raw-materials', payload);
    await reload();
    setIsModalOpen(false);
    setEditingMaterial(null);
    form.resetFields();
    message.success(editingMaterial ? 'Raw material updated successfully!' : 'Raw material added successfully!');
  };

  const openEditMaterial = (material) => {
    setEditingMaterial(material);
    form.setFieldsValue({ sku: material.sku, name: material.name, category: material.category, unit: material.unit, stock: material.stock, reorder: material.reorder, avgCost: material.avgCost });
    setIsModalOpen(true);
  };
  const deleteMaterial = material => Modal.confirm({
    title: `Delete ${material.name}?`,
    content: 'A raw material must be removed from every formula before it can be deleted.',
    okText: 'Delete material', okButtonProps: { danger: true },
    onOk: async () => {
      try { await client.delete(`/raw-materials/${material.id}`); message.success('Raw material deleted successfully.'); await reload(); }
      catch (error) { message.error(error.response?.data?.message || 'Could not delete raw material.'); }
    }
  });

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchText.toLowerCase()) || 
                          m.sku.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesCategory = categoryFilter === 'All Categories' || m.category === categoryFilter;
    
    let matchesStock = true;
    const currentStatus = m.stock === 0 ? 'Out of Stock' : (m.stock <= m.reorder ? 'Low Stock' : 'In Stock');
    if (stockFilter === 'Low Stock') {
      matchesStock = currentStatus === 'Low Stock';
    } else if (stockFilter === 'Out of Stock') {
      matchesStock = currentStatus === 'Out of Stock';
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  const totalMaterials = materials.length;
  const lowStockMaterials = materials.filter(m => m.stock > 0 && m.stock <= m.reorder).length;
  const totalValue = materials.reduce((sum, m) => sum + (m.stock * m.avgCost), 0);
  const totalCategories = new Set(materials.map(m => m.category)).size;
  const categories = [...new Set(materials.map(m => m.category).filter(Boolean))].sort();

  const columns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', render: t => <Text style={{ color: 'var(--color-gold)' }}>{t}</Text> },
    { title: 'Name', dataIndex: 'name', key: 'name', render: t => <Text style={{ color: 'inherit', fontWeight: 600 }}>{t}</Text> },
    { title: 'Category', dataIndex: 'category', key: 'category', render: t => <Tag color="blue">{t}</Tag> },
    { title: 'Stock', key: 'stock', render: (_, r) => {
      const percent = r.reorder > 0 ? (r.stock / r.reorder) * 100 : 100;
      const strokeColor = r.stock === 0 ? '#f56565' : (percent <= 100 ? '#ed8936' : '#48bb78');
      return (
        <div style={{ width: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: 'inherit', fontSize: 12 }}>{r.stock} {r.unit}</Text>
          </div>
          <Progress percent={percent > 100 ? 100 : percent} showInfo={false} size="small" strokeColor={strokeColor} />
        </div>
      );
    }},
    { title: 'Avg Cost', dataIndex: 'avgCost', key: 'avgCost', render: v => <Text style={{ color: 'inherit' }}>₹{v.toLocaleString()}</Text> },
    { title: 'Value', key: 'value', render: (_, r) => <Text style={{ color: 'var(--color-gold)' }}>₹{(r.stock * r.avgCost).toLocaleString()}</Text> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: s => {
      let color = s === 'In Stock' ? 'success' : s === 'Low Stock' ? 'warning' : 'error';
      return <Tag color={color}>{s}</Tag>;
    }},
    { title: 'Actions', key: 'actions', render: (_, r) => (
      <Space size="small">
        <Link to={`/app/raw-materials/${r.id}`}>
          <Button type="text" icon={<EyeOutlined />} style={{ color: '#4299e1' }} />
        </Link>
        <Button type="text" icon={<EditOutlined />} style={{ color: 'var(--color-gold)' }} onClick={() => openEditMaterial(r)} />
        <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Delete ${r.name}`} onClick={() => deleteMaterial(r)} />
        <Button type="text" icon={<ToolOutlined />} style={{ color: 'var(--color-text-secondary)' }} />
      </Space>
    )}
  ];

  const statCardStyle = { border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, background: '#ffffff' };
  const summary = (
    <Row gutter={[12, 12]}>
      <Col span={12}><Card size="small"><Text>Total Materials</Text><Title level={3}>{totalMaterials}</Title></Card></Col>
      <Col span={12}><Card size="small"><Text>Low Stock</Text><Title level={3}>{lowStockMaterials}</Title></Card></Col>
      <Col span={12}><Card size="small"><Text>Total Value</Text><Title level={3}>₹{Math.round(totalValue).toLocaleString()}</Title></Card></Col>
      <Col span={12}><Card size="small"><Text>Categories</Text><Title level={3}>{totalCategories}</Title></Card></Col>
    </Row>
  );
  const filters = (
    <>
      <Input placeholder="Search materials..." prefix={<SearchOutlined />} value={searchText} onChange={handleSearch} />
      <Select value={categoryFilter} onChange={handleCategoryChange} options={[{ value: 'All Categories', label: 'All Categories' }, ...categories.map(category => ({ value: category, label: category }))]} />
      <Select value={stockFilter} onChange={handleStockChange} options={['All Stock', 'Low Stock', 'Out of Stock'].map(value => ({ value, label: value }))} />
    </>
  );

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title className="mobile-page-title" level={2} style={{ color: 'var(--color-gold)', fontFamily: 'Playfair Display', margin: 0 }}>Raw Materials</Title>
        </div>
        <Space>
          <PageDrawerControls title="Raw materials" summary={summary} filters={filters} activeFilterCount={[searchText, categoryFilter !== 'All Categories', stockFilter !== 'All Stock'].filter(Boolean).length} onReset={() => { setSearchText(''); setCategoryFilter('All Categories'); setStockFilter('All Stock'); }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>Add Material</Button>
        </Space>
      </div>

      <Row className="page-summary-inline" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}>
          <div style={statCardStyle}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Total Materials</Text>
            <Text style={{ color: 'inherit', fontSize: 24, fontWeight: 600 }}>{totalMaterials}</Text>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div style={statCardStyle}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Low Stock</Text>
            <Text style={{ color: '#f56565', fontSize: 24, fontWeight: 600 }}>{lowStockMaterials}</Text>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div style={statCardStyle}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Total Value</Text>
            <Text style={{ color: 'var(--color-gold)', fontSize: 24, fontWeight: 600 }}>₹{Math.round(totalValue).toLocaleString()}</Text>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div style={statCardStyle}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Categories</Text>
            <Text style={{ color: '#4299e1', fontSize: 24, fontWeight: 600 }}>{totalCategories}</Text>
          </div>
        </Col>
      </Row>

      <Card>
        <Space className="page-filter-inline" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input 
            placeholder="Search materials..." 
            prefix={<SearchOutlined />} 
            style={{ width: 250 }} 
            value={searchText}
            onChange={handleSearch}
          />
          <Select value={categoryFilter} onChange={handleCategoryChange} style={{ width: 150 }}>
            <Option value="All Categories">All Categories</Option>
            {categories.map(category => <Option key={category} value={category}>{category}</Option>)}
          </Select>
          <Select value={stockFilter} onChange={handleStockChange} style={{ width: 150 }}>
            <Option value="All Stock">All Stock</Option>
            <Option value="Low Stock">Low Stock</Option>
            <Option value="Out of Stock">Out of Stock</Option>
          </Select>
        </Space>
        
        <div className="mobile-table-alternative">
          <MobileDataList items={filteredMaterials} emptyText="No materials found" renderItem={(material) => (
            <>
              <div className="mobile-data-list__title-row"><strong>{material.name}</strong><Tag color={material.status === 'In Stock' ? 'success' : material.status === 'Low Stock' ? 'warning' : 'error'}>{material.status}</Tag></div>
              <span className="mobile-data-list__code">{material.sku}</span>
              <div className="mobile-data-list__metrics"><span>Stock <strong>{material.stock} {material.unit}</strong></span><span>Value <strong>₹{(material.stock * material.avgCost).toLocaleString()}</strong></span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <Link to={`/app/raw-materials/${material.id}`}><Button block icon={<EyeOutlined />}>View</Button></Link>
                <Button type="primary" icon={<EditOutlined />} onClick={() => openEditMaterial(material)}>Edit</Button>
                <Button danger icon={<DeleteOutlined />} onClick={() => deleteMaterial(material)}>Delete</Button>
              </div>
            </>
          )} />
        </div>
        <div className="desktop-table-only"><Table 
          columns={columns} 
          dataSource={filteredMaterials}
          loading={loading}
          scroll={{ x: 800 }} 
          pagination={{ pageSize: 10 }}
          rowKey="id"
          rowClassName={() => 'dark-table-row'}
          style={{ background: 'transparent' }}
        /></div>
      </Card>

      <Modal
        title={editingMaterial ? 'Edit Raw Material' : 'Add New Raw Material'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingMaterial(null);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={handleAddMaterial}>
          <Form.Item name="name" label="Material Name" rules={[{ required: true, message: 'Please enter material name' }]}>
            <Input placeholder="e.g. Lavender Oil" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Please enter a category' }]}>
                <SingleTagSelect
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select or type a new category"
                  options={categories.map(category => ({ value: category, label: category }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="Unit of Measure" initialValue="kg" rules={[{ required: true }]}>
                <Select>
                  <Option value="kg">kg</Option>
                  <Option value="L">L</Option>
                  <Option value="g">g</Option>
                  <Option value="ml">ml</Option>
                  <Option value="pcs">pcs</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="stock" label="Current Stock" initialValue={0} rules={[{ required: true, message: 'Please enter stock' }]}>
                <Input type="number" step="any" min={0} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="reorder" label="Reorder Level" initialValue={0} rules={[{ required: true, message: 'Please enter reorder level' }]}>
                <Input type="number" step="any" min={0} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="avgCost" label="Avg Cost per Unit (₹)" rules={[{ required: true, message: 'Please enter average cost' }]}>
                <Input type="number" step="any" min={0} prefix="₹" placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => {
                setIsModalOpen(false);
                setEditingMaterial(null);
                form.resetFields();
              }}>Cancel</Button>
              <Button type="primary" htmlType="submit">{editingMaterial ? 'Update' : 'Submit'}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
