import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Divider, Form, Input, InputNumber, Row, Select, Space, Table, message } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import './FormulaBuilder.css';

const { Option } = Select;
const { TextArea } = Input;

export default function FormulaBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const [form] = Form.useForm();
  const outputQuantity = Number(Form.useWatch('output', form) || 0);
  const outputUnit = Form.useWatch('unit', form) || 'ml';
  const outputInMl = outputUnit === 'L' ? outputQuantity * 1000 : outputQuantity;
  const { data: rawData } = useApiData('/raw-materials');
  const rawMaterials = useMemo(() => rawData.map(item => ({ ...item, price: Number(item.avg_cost || 0) })), [rawData]);
  
  const [ingredients, setIngredients] = useState([
    { key: '1', materialId: '', qty: 0.1, price: 0, cost: 0, unit: 'kg' }
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
          confirm_litre_output: false,
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
  }, [rawMaterials]);

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

  // Calculations
  const rawCostTotal = ingredients.reduce((sum, item) => sum + item.cost, 0);
  const totalCost = rawCostTotal;

  const onFinish = async (values) => {
    const payload = {
      code: values.code?.trim() || undefined,
      name: values.name,
      version: Number(values.version) || 1,
      description: values.description,
      output_quantity: values.output,
      output_unit: values.unit,
      confirm_litre_output: values.unit === 'L' ? Boolean(values.confirm_litre_output) : false,
      ingredients: ingredients.filter(item => item.materialId).map(item => ({
        raw_material_id: item.materialId, quantity: item.qty, unit: item.unit
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
                  <Form.Item name="output" label="Target Batch Output" rules={[{ required: true, message: 'Enter the batch output quantity' }]}>
                    <InputNumber min={outputUnit === 'L' ? 0.001 : 1} placeholder="e.g. 30" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="unit" label="Output Unit" initialValue="ml" rules={[{ required: true }]}>
                    <Select style={{ width: '100%' }} onChange={() => form.setFieldValue('confirm_litre_output', false)}>
                      <Option value="ml">Millilitres (ml) — recommended</Option>
                      <Option value="L">Litres (L) — large batches only</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              {outputUnit === 'L' ? (
                <Alert
                  type="warning"
                  showIcon
                  className="formula-output-guide"
                  style={{ marginBottom: 16 }}
                  message={`How this formula works — ${outputQuantity || 0} L equals ${outputInMl.toLocaleString()} ml`}
                  description={(
                    <div className="formula-guide-copy">
                      <p><strong>This recipe describes one complete batch.</strong> Enter every ingredient quantity needed to produce the full {outputQuantity || 0} L batch.</p>
                      <ol>
                        <li>Products use this formula as their default recipe; a variant can inherit it or select an override.</li>
                        <li>When Production or POS “Make Now” creates a variant, ingredient quantities are scaled to its fill size and sale quantity.</li>
                        <li>Packaging such as bottles and boxes is deducted from the selected variant’s Packaging BOM.</li>
                      </ol>
                      <div className="formula-guide-example"><strong>Scaling rule:</strong> ingredient used = batch ingredient × required liquid ÷ {outputInMl.toLocaleString()}ml.</div>
                      <Form.Item
                        name="confirm_litre_output"
                        valuePropName="checked"
                        className="formula-litre-confirm"
                        rules={[{
                          validator: (_, checked) => checked
                            ? Promise.resolve()
                            : Promise.reject(new Error('Confirm the litre batch size before saving'))
                        }]}
                      >
                        <Checkbox>I confirm that this recipe produces {outputQuantity || 0} L ({outputInMl.toLocaleString()}ml).</Checkbox>
                      </Form.Item>
                    </div>
                  )}
                />
              ) : (
                <Alert
                  type="info"
                  showIcon
                  className="formula-output-guide"
                  style={{ marginBottom: 16 }}
                  message={`How this formula works — batch output: ${outputQuantity || 0} ml`}
                  description={(
                    <div className="formula-guide-copy">
                      <p><strong>This recipe describes one complete batch.</strong> Enter every ingredient quantity needed to produce the full {outputQuantity || 0}ml output.</p>
                      <ol>
                        <li>Products use this formula as their default recipe; a variant can inherit it or select a different formula.</li>
                        <li>Production and POS “Make Now” automatically scale every ingredient using the variant’s fill size and quantity.</li>
                        <li>Bottles, boxes, caps, and labels are deducted separately from the variant’s Packaging BOM.</li>
                      </ol>
                      <div className="formula-guide-example"><strong>Example:</strong> a 30ml batch containing 19ml MARJ deducts 19ml for one 30ml bottle, or 38ml for two bottles.</div>
                      <div className="formula-guide-rule"><strong>Scaling rule:</strong> ingredient used = batch ingredient × required liquid ÷ {outputInMl.toLocaleString() || 0}ml.</div>
                    </div>
                  )}
                />
              )}
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

          </Col>

          <Col xs={24} lg={8}>
            <Card title="Cost & Pricing Calculator" style={{ position: 'sticky', top: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>Raw Materials Cost:</span>
                <span>₹{rawCostTotal.toLocaleString()}</span>
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
