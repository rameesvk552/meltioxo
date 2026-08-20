import React, { useState } from 'react';
import { Card, Typography, Form, Input, InputNumber, Select, Table, Button, Row, Col, Divider, Space } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const FormulaBuilder = () => {
  const [form] = Form.useForm();
  
  const [ingredients, setIngredients] = useState([
    { key: '1', material: 'Sandalwood Oil', qty: 5, unit: 'ml', costPerUnit: 850 },
    { key: '2', material: 'Rose Absolute', qty: 2, unit: 'ml', costPerUnit: 450 }
  ]);

  const [packaging, setPackaging] = useState([
    { key: '1', material: '100ml Glass Bottle', qty: 1, costPerUnit: 120 },
    { key: '2', material: 'Gold Sprayer Pump', qty: 1, costPerUnit: 45 }
  ]);

  const rawMaterials = [
    { value: 'Sandalwood Oil', cost: 850 },
    { value: 'Rose Absolute', cost: 450 },
    { value: 'Bergamot Extract', cost: 120 },
    { value: 'Ethanol', cost: 2 }
  ];

  const packMaterials = [
    { value: '100ml Glass Bottle', cost: 120 },
    { value: '50ml Glass Bottle', cost: 85 },
    { value: 'Gold Sprayer Pump', cost: 45 },
    { value: 'Premium Outer Box', cost: 150 }
  ];

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { key: Date.now().toString(), material: null, qty: 1, unit: 'ml', costPerUnit: 0 }]);
  };

  const handleAddPackaging = () => {
    setPackaging([...packaging, { key: Date.now().toString(), material: null, qty: 1, costPerUnit: 0 }]);
  };

  const updateIngredient = (key, field, value) => {
    let updated = ingredients.map(i => {
      if(i.key === key) {
        let update = { ...i, [field]: value };
        if(field === 'material') {
          const mat = rawMaterials.find(m => m.value === value);
          if(mat) update.costPerUnit = mat.cost;
        }
        return update;
      }
      return i;
    });
    setIngredients(updated);
  };

  const updatePackaging = (key, field, value) => {
    let updated = packaging.map(p => {
      if(p.key === key) {
        let update = { ...p, [field]: value };
        if(field === 'material') {
          const mat = packMaterials.find(m => m.value === value);
          if(mat) update.costPerUnit = mat.cost;
        }
        return update;
      }
      return p;
    });
    setPackaging(updated);
  };

  const calcRawTotal = () => ingredients.reduce((sum, i) => sum + (i.qty * i.costPerUnit), 0);
  const calcPackTotal = () => packaging.reduce((sum, p) => sum + (p.qty * p.costPerUnit), 0);
  const totalCost = calcRawTotal() + calcPackTotal();

  const ingColumns = [
    { title: 'Raw Material', dataIndex: 'material', render: (val, rec) => (
      <Select value={val} onChange={v => updateIngredient(rec.key, 'material', v)} style={{ width: 200 }} placeholder="Select">
        {rawMaterials.map(m => <Option key={m.value} value={m.value}>{m.value}</Option>)}
      </Select>
    )},
    { title: 'Quantity', dataIndex: 'qty', render: (val, rec) => <InputNumber min={0.1} step={0.1} value={val} onChange={v => updateIngredient(rec.key, 'qty', v)} /> },
    { title: 'Unit', dataIndex: 'unit', render: (val, rec) => (
      <Select value={val} onChange={v => updateIngredient(rec.key, 'unit', v)} style={{ width: 80 }}>
        <Option value="ml">ml</Option>
        <Option value="g">g</Option>
        <Option value="kg">kg</Option>
      </Select>
    )},
    { title: 'Cost/Unit (₹)', dataIndex: 'costPerUnit', render: val => val },
    { title: 'Line Cost', render: (_, rec) => `₹${(rec.qty * rec.costPerUnit).toFixed(2)}` },
    { title: '', render: (_, rec) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setIngredients(ingredients.filter(i => i.key !== rec.key))} /> }
  ];

  const packColumns = [
    { title: 'Packaging Material', dataIndex: 'material', render: (val, rec) => (
      <Select value={val} onChange={v => updatePackaging(rec.key, 'material', v)} style={{ width: 200 }} placeholder="Select">
        {packMaterials.map(m => <Option key={m.value} value={m.value}>{m.value}</Option>)}
      </Select>
    )},
    { title: 'Quantity', dataIndex: 'qty', render: (val, rec) => <InputNumber min={1} value={val} onChange={v => updatePackaging(rec.key, 'qty', v)} /> },
    { title: 'Cost/Unit (₹)', dataIndex: 'costPerUnit', render: val => val },
    { title: 'Line Cost', render: (_, rec) => `₹${(rec.qty * rec.costPerUnit).toFixed(2)}` },
    { title: '', render: (_, rec) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setPackaging(packaging.filter(p => p.key !== rec.key))} /> }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ color: '#d4a853', fontFamily: 'Playfair Display', marginBottom: '24px' }}>Formula Builder</Title>

      <Form form={form} layout="vertical">
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Card title={<span style={{ color: '#d4a853' }}>Basic Information</span>} style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)', marginBottom: 24, borderRadius: 12 }}>
              <Row gutter={16}>
                <Col span={8}><Form.Item label="Formula Code" name="code"><Input placeholder="e.g. FORM-001" /></Form.Item></Col>
                <Col span={16}><Form.Item label="Formula Name" name="name" rules={[{ required: true }]}><Input placeholder="e.g. Royal Oud Extrait de Parfum" /></Form.Item></Col>
              </Row>
              <Form.Item label="Description" name="description"><TextArea rows={3} /></Form.Item>
              <Row gutter={16}>
                <Col span={8}><Form.Item label="Output Quantity" name="outputQty" initialValue={100}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={8}><Form.Item label="Output Unit" name="outputUnit" initialValue="ml"><Select><Option value="ml">ml</Option><Option value="l">Liters</Option><Option value="kg">kg</Option></Select></Form.Item></Col>
              </Row>
            </Card>

            <Card title={<span style={{ color: '#d4a853' }}>Ingredients (Raw Materials)</span>} style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)', marginBottom: 24, borderRadius: 12 }}>
              <Table dataSource={ingredients} columns={ingColumns} pagination={false} scroll={{ x: 'max-content' }} />
              <Button type="dashed" onClick={handleAddIngredient} icon={<PlusOutlined />} style={{ width: '100%', marginTop: 16 }}>Add Ingredient</Button>
              <div style={{ textAlign: 'right', marginTop: 16 }}><Text style={{ color: '#94a3b8' }}>Ingredients Subtotal:</Text> <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 'bold' }}>₹{calcRawTotal().toFixed(2)}</Text></div>
            </Card>

            <Card title={<span style={{ color: '#d4a853' }}>Packaging</span>} style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)', marginBottom: 24, borderRadius: 12 }}>
              <Table dataSource={packaging} columns={packColumns} pagination={false} scroll={{ x: 'max-content' }} />
              <Button type="dashed" onClick={handleAddPackaging} icon={<PlusOutlined />} style={{ width: '100%', marginTop: 16 }}>Add Packaging</Button>
              <div style={{ textAlign: 'right', marginTop: 16 }}><Text style={{ color: '#94a3b8' }}>Packaging Subtotal:</Text> <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 'bold' }}>₹{calcPackTotal().toFixed(2)}</Text></div>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card title={<span style={{ color: '#d4a853' }}>Cost Summary</span>} style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)', borderRadius: 12, position: 'sticky', top: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><Text style={{ color: '#94a3b8' }}>Raw Material Cost:</Text><Text style={{ color: '#e2e8f0' }}>₹{calcRawTotal().toFixed(2)}</Text></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><Text style={{ color: '#94a3b8' }}>Packaging Cost:</Text><Text style={{ color: '#e2e8f0' }}>₹{calcPackTotal().toFixed(2)}</Text></div>
              <Divider style={{ borderColor: 'var(--color-border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><Text strong style={{ color: '#d4a853', fontSize: 16 }}>Total Cost per Unit:</Text><Text strong style={{ color: '#d4a853', fontSize: 16 }}>₹{totalCost.toFixed(2)}</Text></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 8, border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                <Text style={{ color: '#22c55e' }}>Suggested RSP (2x):</Text><Text strong style={{ color: '#22c55e' }}>₹{(totalCost * 2).toFixed(2)}</Text>
              </div>
              <Divider style={{ borderColor: 'var(--color-border)' }} />
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button type="primary" icon={<CheckCircleOutlined />} style={{ width: '100%', backgroundColor: '#d4a853', color: '#0f1729', border: 'none' }}>Save & Activate</Button>
                <Button icon={<SaveOutlined />} style={{ width: '100%', backgroundColor: 'transparent', color: '#e2e8f0', borderColor: 'var(--color-border)' }}>Save Draft</Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default FormulaBuilder;
