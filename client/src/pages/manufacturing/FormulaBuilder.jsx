import React, { useEffect, useState } from 'react';
import { Card, Form, Input, InputNumber, Select, Button, Table, Space, Divider, Row, Col, message } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';

const { Option } = Select;
const { TextArea } = Input;

export default function FormulaBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const [form] = Form.useForm();
  const { data: rawData } = useApiData('/raw-materials');
  const { data: packagingData } = useApiData('/packaging-materials');
  const rawMaterials = rawData.map(item => ({ ...item, price: Number(item.avg_cost || 0) }));
  const packagingMaterials = packagingData.map(item => ({ ...item, price: Number(item.avg_cost || 0) }));
  
  const [ingredients, setIngredients] = useState([
    { key: '1', materialId: '', qty: 0.1, price: 0, cost: 0, unit: 'kg' }
  ]);

  const [packaging, setPackaging] = useState([
    { key: '1', materialId: '', qty: 10, price: 0, cost: 0 }
  ]);

  useEffect(() => {
    if (!id) return;
    const loadFormula = async () => {
      try {
        const { data } = await client.get(`/formulas/${id}`);
        form.setFieldsValue({
          code: data.code,
          name: data.name,
          version: data.version,
          output: Number(data.output_quantity),
          unit: data.output_unit,
          description: data.description
        });
        setIngredients((data.formulaIngredients || []).map((item, index) => ({
          key: item.id || `ingredient-${index}`,
          materialId: item.raw_material_id,
          qty: Number(item.quantity),
          price: 0,
          cost: 0,
          unit: item.unit || 'kg'
        })));
        setPackaging((data.formulaPackagings || []).map((item, index) => ({
          key: item.id || `packaging-${index}`,
          materialId: item.packaging_material_id,
          qty: Number(item.quantity),
          price: 0,
          cost: 0
        })));
      } catch {
        message.error('Unable to load this formula');
      }
    };
    loadFormula();
  }, [id, form]);

  useEffect(() => {
    setIngredients(current => current.map(item => {
      const material = rawMaterials.find(row => row.id === item.materialId);
      const price = material ? material.price : item.price;
      return { ...item, price, cost: item.qty * price };
    }));
  }, [rawData]);

  useEffect(() => {
    setPackaging(current => current.map(item => {
      const material = packagingMaterials.find(row => row.id === item.materialId);
      const price = material ? material.price : item.price;
      return { ...item, price, cost: item.qty * price };
    }));
  }, [packagingData]);

  // Ingredients handlers
  const handleAddIngredient = () => {
    const nextKey = (ingredients.length + 1).toString();
    setIngredients([...ingredients, { key: nextKey, materialId: '', qty: 0.1, price: 0, cost: 0, unit: 'kg' }]);
  };

  const handleRemoveIngredient = (key) => {
    if (ingredients.length === 1) return;
    setIngredients(ingredients.filter(x => x.key !== key));
  };

  const handleIngredientChange = (key, field, val) => {
    setIngredients(ingredients.map(item => {
      if (item.key === key) {
        const updated = { ...item, [field]: val };
        if (field === 'materialId') {
          const mat = rawMaterials.find(m => m.id === val);
          updated.price = mat ? mat.price : 0;
          updated.unit = mat ? mat.unit : 'kg';
        }
        updated.cost = updated.qty * updated.price;
        return updated;
      }
      return item;
    }));
  };

  // Packaging handlers
  const handleAddPackaging = () => {
    const nextKey = (packaging.length + 1).toString();
    setPackaging([...packaging, { key: nextKey, materialId: '', qty: 10, price: 0, cost: 0 }]);
  };

  const handleRemovePackaging = (key) => {
    if (packaging.length === 1) return;
    setPackaging(packaging.filter(x => x.key !== key));
  };

  const handlePackagingChange = (key, field, val) => {
    setPackaging(packaging.map(item => {
      if (item.key === key) {
        const updated = { ...item, [field]: val };
        if (field === 'materialId') {
          const mat = packagingMaterials.find(m => m.id === val);
          updated.price = mat ? mat.price : 0;
        }
        updated.cost = updated.qty * updated.price;
        return updated;
      }
      return item;
    }));
  };

  // Calculations
  const rawCostTotal = ingredients.reduce((sum, item) => sum + item.cost, 0);
  const pkgCostTotal = packaging.reduce((sum, item) => sum + item.cost, 0);
  const totalCost = rawCostTotal + pkgCostTotal;

  const onFinish = async (values) => {
    const payload = {
      code: values.code?.trim() || undefined,
      name: values.name,
      version: Number(values.version) || 1,
      description: values.description,
      output_quantity: values.output,
      output_unit: values.unit,
      ingredients: ingredients.filter(item => item.materialId).map(item => ({
        raw_material_id: item.materialId, quantity: item.qty, unit: item.unit
      })),
      packaging: packaging.filter(item => item.materialId).map(item => ({
        packaging_material_id: item.materialId, quantity: item.qty
      }))
    };
    try {
      if (isEditing) {
        await client.put(`/formulas/${id}`, payload);
        message.success('Formula updated successfully!');
      } else {
        await client.post('/formulas', payload);
        message.success('Formula saved & activated successfully!');
      }
      navigate('/app/formulas');
    } catch (error) {
      message.error(error.response?.data?.message || 'Unable to save formula. Please try again.');
    }
  };

  const ingredientColumns = [
    {
      title: 'Raw Material',
      dataIndex: 'materialId',
      key: 'materialId',
      width: '40%',
      render: (val, record) => (
        <Select value={val || undefined} placeholder="Select Raw Material" onChange={v => handleIngredientChange(record.key, 'materialId', v)} style={{ width: '100%' }}>
          {rawMaterials.map(m => (
            <Option key={m.id} value={m.id}>{m.name}</Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Quantity',
      dataIndex: 'qty',
      key: 'qty',
      width: '20%',
      render: (val, record) => (
        <InputNumber min={0.001} step={0.01} value={val} onChange={v => handleIngredientChange(record.key, 'qty', v)} style={{ width: '100%' }} />
      )
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: '12%',
      render: v => v
    },
    {
      title: 'Unit Cost',
      dataIndex: 'price',
      key: 'price',
      align: 'right',
      render: v => `₹${v.toLocaleString()}`
    },
    {
      title: 'Line Cost',
      key: 'cost',
      align: 'right',
      render: (_, record) => `₹${record.cost.toLocaleString()}`
    },
    {
      title: '',
      key: 'remove',
      align: 'center',
      render: (_, record) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveIngredient(record.key)} />
      )
    }
  ];

  const packagingColumns = [
    {
      title: 'Packaging Material',
      dataIndex: 'materialId',
      key: 'materialId',
      width: '40%',
      render: (val, record) => (
        <Select value={val || undefined} placeholder="Select Packaging" onChange={v => handlePackagingChange(record.key, 'materialId', v)} style={{ width: '100%' }}>
          {packagingMaterials.map(m => (
            <Option key={m.id} value={m.id}>{m.name}</Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Quantity (pcs)',
      dataIndex: 'qty',
      key: 'qty',
      width: '20%',
      render: (val, record) => (
        <InputNumber min={1} value={val} onChange={v => handlePackagingChange(record.key, 'qty', v)} style={{ width: '100%' }} />
      )
    },
    {
      title: 'Unit Cost',
      dataIndex: 'price',
      key: 'price',
      align: 'right',
      render: v => `₹${v.toLocaleString()}`
    },
    {
      title: 'Line Cost',
      key: 'cost',
      align: 'right',
      render: (_, record) => `₹${record.cost.toLocaleString()}`
    },
    {
      title: '',
      key: 'remove',
      align: 'center',
      render: (_, record) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemovePackaging(record.key)} />
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Card title="Basic Recipe details" style={{ marginBottom: 24 }}>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="code" label="Formula Code">
                    <Input placeholder="Leave blank to auto-generate" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="name" label="Formula Name" rules={[{ required: true }]}>
                    <Input placeholder="e.g. Midnight Oud Eau de Parfum" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={4}>
                  <Form.Item name="version" label="Version" initialValue={1} rules={[{ required: true, message: 'Enter a version number' }]}>
                    <InputNumber min={1} precision={0} step={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="output" label="Target Output Quantity" rules={[{ required: true }]}>
                    <InputNumber min={1} placeholder="e.g. 100" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="unit" label="Output Unit" initialValue="L">
                    <Select style={{ width: '100%' }}>
                      <Option value="L">Liters (L)</Option>
                      <Option value="ml">Milliliters (ml)</Option>
                      <Option value="kg">Kilograms (kg)</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="description" label="Notes & Recipe Description">
                <TextArea rows={2} placeholder="Ingredients mixing steps, temperature guidelines..." />
              </Form.Item>
            </Card>

            <Card title="Ingredients (Essential Oils / Chemicals)" style={{ marginBottom: 24 }}>
              <div className="desktop-only">
                <Table dataSource={ingredients} columns={ingredientColumns} pagination={false} scroll={{ x: 650 }} style={{ marginBottom: 16 }} />
              </div>
              <div className="mobile-only" style={{ marginBottom: 16 }}>
                {ingredients.map((item, index) => (
                  <Card 
                    key={item.key} 
                    size="small" 
                    title={`Ingredient #${index + 1}`}
                    extra={ingredients.length > 1 ? (
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveIngredient(item.key)} />
                    ) : null}
                    style={{ marginBottom: 12, borderColor: 'var(--color-border)' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Raw Material</div>
                        <Select 
                          value={item.materialId || undefined} 
                          placeholder="Select Raw Material"
                          onChange={v => handleIngredientChange(item.key, 'materialId', v)} 
                          style={{ width: '100%' }}
                        >
                          {rawMaterials.map(m => (
                            <Option key={m.id} value={m.id}>{m.name}</Option>
                          ))}
                        </Select>
                      </div>

                      <Row gutter={10}>
                        <Col span={16}>
                          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Quantity</div>
                          <InputNumber 
                            min={0.001} 
                            step={0.01} 
                            value={item.qty} 
                            onChange={v => handleIngredientChange(item.key, 'qty', v)} 
                            style={{ width: '100%' }} 
                          />
                        </Col>
                        <Col span={8}>
                          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Unit</div>
                          <div style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 11px', background: 'var(--color-bg-secondary)', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13 }}>
                            {item.unit || 'kg'}
                          </div>
                        </Col>
                      </Row>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-secondary)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Unit Cost: </span>
                          <span style={{ fontWeight: 500 }}>₹{(item.price || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Line Cost: </span>
                          <span style={{ fontWeight: 'bold', color: 'var(--color-gold)' }}>₹{(item.cost || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <Button type="dashed" onClick={handleAddIngredient} icon={<PlusOutlined />} style={{ width: '100%', color: 'var(--color-gold)', borderColor: 'var(--color-gold)' }}>
                Add Ingredient
              </Button>
            </Card>

            <Card title="Required Packaging (Bottles / Caps / Boxes)" style={{ marginBottom: 24 }}>
              <div className="desktop-only">
                <Table dataSource={packaging} columns={packagingColumns} pagination={false} scroll={{ x: 650 }} style={{ marginBottom: 16 }} />
              </div>
              <div className="mobile-only" style={{ marginBottom: 16 }}>
                {packaging.map((item, index) => (
                  <Card 
                    key={item.key} 
                    size="small" 
                    title={`Packaging #${index + 1}`}
                    extra={packaging.length > 1 ? (
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemovePackaging(item.key)} />
                    ) : null}
                    style={{ marginBottom: 12, borderColor: 'var(--color-border)' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Packaging Material</div>
                        <Select 
                          value={item.materialId || undefined} 
                          placeholder="Select Packaging"
                          onChange={v => handlePackagingChange(item.key, 'materialId', v)} 
                          style={{ width: '100%' }}
                        >
                          {packagingMaterials.map(m => (
                            <Option key={m.id} value={m.id}>{m.name}</Option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Quantity (pcs)</div>
                        <InputNumber 
                          min={1} 
                          value={item.qty} 
                          onChange={v => handlePackagingChange(item.key, 'qty', v)} 
                          style={{ width: '100%' }} 
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-secondary)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Unit Cost: </span>
                          <span style={{ fontWeight: 500 }}>₹{(item.price || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Line Cost: </span>
                          <span style={{ fontWeight: 'bold', color: 'var(--color-gold)' }}>₹{(item.cost || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <Button type="dashed" onClick={handleAddPackaging} icon={<PlusOutlined />} style={{ width: '100%', color: 'var(--color-gold)', borderColor: 'var(--color-gold)' }}>
                Add Packaging
              </Button>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Cost & Pricing Calculator" style={{ position: 'sticky', top: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>Raw Materials Cost:</span>
                <span>₹{rawCostTotal.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>Packaging Materials:</span>
                <span>₹{pkgCostTotal.toLocaleString()}</span>
              </div>
              <Divider />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 'bold', marginBottom: 24 }}>
                <span style={{ color: 'var(--color-gold)' }}>Estimated Total Cost:</span>
                <span style={{ color: 'var(--color-gold)' }}>₹{totalCost.toLocaleString()}</span>
              </div>

              <div style={{ padding: 12, background: 'var(--color-bg-secondary)', borderRadius: 8, marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>SUGGESTED SELLING PRICE</div>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>₹{(totalCost * 2.2).toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 4 }}>Includes standard 2.2x markup margin.</div>
              </div>

              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} style={{ width: '100%' }}>
                  {isEditing ? 'Update Formula' : 'Save & Activate'}
                </Button>
                <Button icon={<SaveOutlined />} onClick={() => message.success('Draft formula saved successfully!')} style={{ width: '100%' }}>
                  Save Draft
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
