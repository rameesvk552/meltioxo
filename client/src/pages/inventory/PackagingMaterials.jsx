import React, { useState, useEffect } from 'react';
import { Table, Card, Row, Col, Tag, Button, Input, Select, Space, Typography, Progress, Modal, Form, message } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, ToolOutlined } from '@ant-design/icons';
import useApiData from '../../hooks/useApiData';
import client from '../../api/client';
import MobileDataList from '../../components/common/MobileDataList';
import PageDrawerControls from '../../components/common/PageDrawerControls';
import SingleTagSelect from '../../components/common/SingleTagSelect';

const { Title, Text } = Typography;
const { Option } = Select;
const packagingTypeOptions = [
  { value: 'bottle', label: 'Bottles' }, { value: 'cap', label: 'Caps' },
  { value: 'spray', label: 'Sprays' }, { value: 'label', label: 'Labels' },
  { value: 'box', label: 'Boxes' }, { value: 'other', label: 'Other' }
];
const packagingTypeLabel = (type) => packagingTypeOptions.find(option => option.value === type)?.label || type;
const defaultPackagingCategories = ['Bottles', 'Caps', 'Sprays', 'Labels', 'Boxes', 'Wrapping', 'Inserts'];
const packagingDatabaseType = (category) => ({ Bottles: 'bottle', Caps: 'cap', Sprays: 'spray', Labels: 'label', Boxes: 'box' }[category] || 'other');

export default function PackagingMaterials() {
  const { data, loading, reload } = useApiData('/packaging-materials');
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
  const [typeFilter, setTypeFilter] = useState('All Package Types');
  const [stockFilter, setStockFilter] = useState('All Stock');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const handleSearch = (e) => {
    setSearchText(e.target.value);
  };

  const handleTypeChange = (value) => {
    setTypeFilter(value);
  };

  const handleStockChange = (value) => {
    setStockFilter(value);
  };

  const closeMaterialModal = () => {
    setIsModalOpen(false);
    setEditingMaterial(null);
    form.resetFields();
  };

  const openAddMaterial = () => {
    setEditingMaterial(null);
    form.resetFields();
    form.setFieldsValue({ unit: 'pcs', stock: 0, reorder: 0, avgCost: 0 });
    setIsModalOpen(true);
  };

  const openEditMaterial = material => {
    setEditingMaterial(material);
    form.setFieldsValue({
      sku: material.sku,
      name: material.name,
      category: [material.category || packagingTypeLabel(material.type)],
      unit: material.unit || 'pcs',
      stock: material.stock,
      reorder: material.reorder,
      avgCost: material.avgCost
    });
    setIsModalOpen(true);
  };

  const saveMaterial = async values => {
    const category = Array.isArray(values.category) ? values.category[0] : values.category;
    const payload = {
      sku: values.sku || undefined,
      name: values.name,
      category,
      type: packagingDatabaseType(category),
      unit: values.unit,
      current_stock: Number(values.stock || 0),
      reorder_level: Number(values.reorder || 0),
      avg_cost: Number(values.avgCost || 0)
    };
    setSaving(true);
    try {
      if (editingMaterial) await client.put(`/packaging-materials/${editingMaterial.id}`, payload);
      else await client.post('/packaging-materials', payload);
      await reload();
      message.success(editingMaterial ? 'Packaging material updated successfully!' : 'Packaging material added successfully!');
      closeMaterialModal();
    } catch (error) {
      message.error(error.response?.data?.message || `Could not ${editingMaterial ? 'update' : 'add'} packaging material`);
    } finally {
      setSaving(false);
    }
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchText.toLowerCase()) || 
                          m.sku.toLowerCase().includes(searchText.toLowerCase());
    
    const packageType = m.category || packagingTypeLabel(m.type);
    const matchesType = typeFilter === 'All Package Types' || packageType === typeFilter;
    
    let matchesStock = true;
    const currentStatus = m.stock === 0 ? 'Out of Stock' : (m.stock <= m.reorder ? 'Low Stock' : 'In Stock');
    if (stockFilter === 'Low Stock') {
      matchesStock = currentStatus === 'Low Stock';
    } else if (stockFilter === 'Out of Stock') {
      matchesStock = currentStatus === 'Out of Stock';
    }

    return matchesSearch && matchesType && matchesStock;
  });

  const totalItems = materials.length;
  const lowStockItems = materials.filter(m => m.stock > 0 && m.stock <= m.reorder).length;
  const totalValue = materials.reduce((sum, m) => sum + (m.stock * m.avgCost), 0);
  const totalTypes = new Set(materials.map(m => m.category || packagingTypeLabel(m.type))).size;
  const categories = [...new Set([...defaultPackagingCategories, ...materials.map(m => m.category).filter(Boolean)])].sort();

  const columns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', render: t => <Text style={{ color: 'var(--color-gold)' }}>{t}</Text> },
    { title: 'Name', dataIndex: 'name', key: 'name', render: t => <Text style={{ color: 'inherit', fontWeight: 600 }}>{t}</Text> },
    { title: 'Package Type', key: 'packageType', render: (_, record) => <Tag color="blue">{record.category || packagingTypeLabel(record.type)}</Tag> },
    { title: 'Stock', key: 'stock', render: (_, r) => {
      const percent = r.reorder > 0 ? (r.stock / r.reorder) * 100 : 100;
      const strokeColor = r.stock === 0 ? '#f56565' : (percent <= 100 ? '#ed8936' : '#48bb78');
      return (
        <div style={{ width: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: 'inherit', fontSize: 12 }}>{r.stock} {r.unit}</Text>
          </div>
          <Progress percent={percent > 100 ? 100 : percent} showInfo={false} size="small" strokeColor={strokeColor} trailColor="#2d3748" />
        </div>
      );
    }},
    { title: 'Avg Cost', dataIndex: 'avgCost', key: 'avgCost', render: v => <Text style={{ color: 'inherit' }}>₹{v.toLocaleString()}</Text> },
    { title: 'Value', key: 'value', render: (_, r) => <Text style={{ color: 'var(--color-gold)' }}>₹{(r.stock * r.avgCost).toLocaleString()}</Text> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: s => {
      let color = s === 'In Stock' ? 'success' : s === 'Low Stock' ? 'warning' : 'error';
      return <Tag color={color}>{s}</Tag>;
    }},
    { title: 'Actions', key: 'actions', render: (_, record) => (
      <Space size="small">
        <Button type="text" icon={<EyeOutlined />} style={{ color: '#4299e1' }} />
        <Button type="text" icon={<EditOutlined />} style={{ color: 'var(--color-gold)' }} onClick={() => openEditMaterial(record)} aria-label={`Edit ${record.name}`} />
        <Button type="text" icon={<ToolOutlined />} style={{ color: 'var(--color-text-secondary)' }} />
      </Space>
    )}
  ];

  const statCardStyle = { background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16 };
  const summary = <Row gutter={[12, 12]}>{[['Total Items', totalItems], ['Low Stock', lowStockItems], ['Total Value', `₹${Math.round(totalValue).toLocaleString()}`], ['Package Types', totalTypes]].map(([label, value]) => <Col span={12} key={label}><Card size="small"><Text>{label}</Text><Title level={3}>{value}</Title></Card></Col>)}</Row>;
  const packageTypeFilterOptions = [{ value: 'All Package Types', label: 'All Package Types' }, ...categories.map(category => ({ value: category, label: category }))];
  const filters = <><Input placeholder="Search packaging..." prefix={<SearchOutlined />} value={searchText} onChange={handleSearch} /><Select value={typeFilter} onChange={handleTypeChange} options={packageTypeFilterOptions} /><Select value={stockFilter} onChange={handleStockChange} options={['All Stock', 'Low Stock', 'Out of Stock'].map(value => ({ value, label: value }))} /></>;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title className="mobile-page-title" level={2} style={{ color: 'var(--color-gold)', fontFamily: 'Playfair Display', margin: 0 }}>Packaging Materials</Title>
        </div>
        <Space><PageDrawerControls title="Packaging materials" summary={summary} filters={filters} activeFilterCount={[searchText, typeFilter !== 'All Package Types', stockFilter !== 'All Stock'].filter(Boolean).length} onReset={() => { setSearchText(''); setTypeFilter('All Package Types'); setStockFilter('All Stock'); }} /><Button type="primary" icon={<PlusOutlined />} onClick={openAddMaterial}>Add Material</Button></Space>
      </div>

      <Row className="page-summary-inline" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}>
          <div style={statCardStyle}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Items</Text>
            <Text style={{ color: 'var(--color-text-primary)', fontSize: 28, fontWeight: 700 }}>{totalItems}</Text>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div style={{ ...statCardStyle, borderLeft: '3px solid var(--color-error)' }}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Low Stock</Text>
            <Text style={{ color: 'var(--color-error)', fontSize: 28, fontWeight: 700 }}>{lowStockItems}</Text>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div style={{ ...statCardStyle, borderLeft: '3px solid var(--color-gold)' }}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Value</Text>
            <Text style={{ color: 'var(--color-gold)', fontSize: 28, fontWeight: 700 }}>₹{Math.round(totalValue).toLocaleString()}</Text>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div style={{ ...statCardStyle, borderLeft: '3px solid var(--color-info)' }}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Package Types</Text>
            <Text style={{ color: 'var(--color-info)', fontSize: 28, fontWeight: 700 }}>{totalTypes}</Text>
          </div>
        </Col>
      </Row>

      <Card >
        <Space className="page-filter-inline" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input 
            placeholder="Search packaging..." 
            prefix={<SearchOutlined />} 
            style={{ width: 250 }} 
            value={searchText}
            onChange={handleSearch}
          />
          <Select value={typeFilter} onChange={handleTypeChange} style={{ width: 150 }}>
            {packageTypeFilterOptions.map(option => <Option key={option.value} value={option.value}>{option.label}</Option>)}
          </Select>
          <Select value={stockFilter} onChange={handleStockChange} style={{ width: 150 }}>
            <Option value="All Stock">All Stock</Option>
            <Option value="Low Stock">Low Stock</Option>
            <Option value="Out of Stock">Out of Stock</Option>
          </Select>
        </Space>
        
        <div className="mobile-table-alternative">
          <MobileDataList items={filteredMaterials} emptyText="No packaging materials found" renderItem={(material) => (
            <>
              <div className="mobile-data-list__title-row"><strong>{material.name}</strong><Tag color={material.status === 'In Stock' ? 'success' : material.status === 'Low Stock' ? 'warning' : 'error'}>{material.status}</Tag></div>
              <span className="mobile-data-list__code">{material.sku} · {material.category || packagingTypeLabel(material.type)}</span>
              <div className="mobile-data-list__metrics"><span>Stock <strong>{material.stock} {material.unit}</strong></span><span>Value <strong>₹{(material.stock * material.avgCost).toLocaleString()}</strong></span></div>
              <Button block icon={<EditOutlined />} onClick={() => openEditMaterial(material)} style={{ marginTop: 12 }}>Edit Material</Button>
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
        title={editingMaterial ? 'Edit Packaging Material' : 'Add New Packaging Material'}
        open={isModalOpen}
        onCancel={closeMaterialModal}
        footer={null}
        destroyOnHidden
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={saveMaterial}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="name" label="Material Name" rules={[{ required: true, message: 'Please enter material name' }]}>
                <Input placeholder="e.g. 100ml Gold Cap" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sku" label="SKU">
                <Input placeholder="Auto-generated" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Package Type" rules={[{ required: true, message: 'Select or create a package type' }]}>
                <SingleTagSelect
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select or type a new package type"
                  options={categories.map(category => ({ value: category, label: category }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="Unit of Measure" initialValue="pcs" rules={[{ required: true }]}>
                <Select>
                  <Option value="pcs">pcs</Option>
                  <Option value="set">set</Option>
                  <Option value="m">m</Option>
                  <Option value="kg">kg</Option>
                  <Option value="L">L</Option>
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
              <Button onClick={closeMaterialModal}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={saving}>{editingMaterial ? 'Update Material' : 'Add Material'}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
