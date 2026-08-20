import React, { useState } from 'react';
import { Card, Form, Select, DatePicker, Input, InputNumber, Button, Table, Divider, Row, Col, message } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';

const { Option } = Select;
const { TextArea } = Input;

export default function PurchaseOrderForm() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { data: suppliers } = useApiData('/suppliers');
  const { data: rawMaterials } = useApiData('/raw-materials');
  const { data: packagingMaterials } = useApiData('/packaging-materials');
  const materialsByType = {
    raw: rawMaterials.map(item => ({ ...item, price: Number(item.last_cost || item.avg_cost || 0) })),
    pkg: packagingMaterials.map(item => ({ ...item, price: Number(item.avg_cost || 0) }))
  };
  const [items, setItems] = useState([
    { key: '1', type: 'raw', materialId: '', qty: 10, price: 0, tax: 18, total: 0 }
  ]);

  const handleAddItem = () => {
    const newKey = (items.length + 1).toString();
    setItems([...items, { key: newKey, type: 'raw', materialId: '', qty: 1, price: 0, tax: 18, total: 0 }]);
  };

  const handleRemoveItem = (key) => {
    if (items.length === 1) {
      message.warning('PO must have at least one line item.');
      return;
    }
    setItems(items.filter(x => x.key !== key));
  };

  const handleItemChange = (key, field, val) => {
    setItems(items.map(item => {
      if (item.key === key) {
        const updated = { ...item, [field]: val };
        
        // Auto-fetch price if material changes
        if (field === 'materialId') {
          const list = materialsByType[updated.type] || [];
          const matched = list.find(m => m.id === val);
          updated.price = matched ? matched.price : 0;
        }

        if (field === 'type') {
          updated.materialId = '';
          updated.price = 0;
        }

        // Calculate total
        const sub = updated.qty * updated.price;
        updated.total = sub + (sub * (updated.tax / 100));
        return updated;
      }
      return item;
    }));
  };

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalTax = items.reduce((sum, item) => sum + ((item.price * item.qty) * (item.tax / 100)), 0);
  const grandTotal = subtotal + totalTax;

  const onFinish = async (values) => {
    await client.post('/purchase-orders', {
      supplier_id: values.supplierId,
      order_date: values.orderDate.format('YYYY-MM-DD'),
      expected_date: values.expectedDate?.format('YYYY-MM-DD'),
      notes: values.notes,
      subtotal,
      tax_amount: totalTax,
      total_amount: grandTotal,
      items: items.filter(item => item.materialId).map(item => ({
        material_type: item.type === 'pkg' ? 'packaging' : 'raw',
        material_id: item.materialId,
        quantity: item.qty,
        unit_price: item.price,
        tax_rate: item.tax
      }))
    });
    message.success('Purchase Order saved successfully!');
    navigate('/app/purchase-orders');
  };

  const columns = [
    {
      title: 'Material Type',
      dataIndex: 'type',
      key: 'type',
      width: '20%',
      render: (val, record) => (
        <Select value={val} onChange={(v) => handleItemChange(record.key, 'type', v)} style={{ width: '100%' }}>
          <Option value="raw">Raw Material</Option>
          <Option value="pkg">Packaging</Option>
        </Select>
      )
    },
    {
      title: 'Select Item',
      dataIndex: 'materialId',
      key: 'materialId',
      width: '30%',
      render: (val, record) => (
        <Select 
          value={val || undefined} 
          placeholder="Select item"
          onChange={(v) => handleItemChange(record.key, 'materialId', v)}
          style={{ width: '100%' }}
        >
          {(materialsByType[record.type] || []).map(m => (
            <Option key={m.id} value={m.id}>{m.name}</Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      width: '12%',
      render: (val, record) => (
        <InputNumber min={1} value={val} onChange={(v) => handleItemChange(record.key, 'qty', v)} style={{ width: '100%' }} />
      )
    },
    {
      title: 'Unit Price (₹)',
      dataIndex: 'price',
      key: 'price',
      width: '15%',
      render: (val, record) => (
        <InputNumber min={0} value={val} onChange={(v) => handleItemChange(record.key, 'price', v)} style={{ width: '100%' }} />
      )
    },
    {
      title: 'GST %',
      dataIndex: 'tax',
      key: 'tax',
      width: '12%',
      render: (val, record) => (
        <Select value={val} onChange={(v) => handleItemChange(record.key, 'tax', v)} style={{ width: '100%' }}>
          <Option value={0}>0%</Option>
          <Option value={5}>5%</Option>
          <Option value={12}>12%</Option>
          <Option value={18}>18%</Option>
          <Option value={28}>28%</Option>
        </Select>
      )
    },
    {
      title: 'Total',
      key: 'total',
      align: 'right',
      render: (_, record) => `₹${record.total.toLocaleString()}`
    },
    {
      title: '',
      key: 'remove',
      align: 'center',
      render: (_, record) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(record.key)} />
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/purchase-orders')} />
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>Create Purchase Order</h1>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="supplierId" label="Select Supplier" rules={[{ required: true, message: 'Please select a supplier' }]}>
                <Select placeholder="Choose supplier">
                  {suppliers.map(s => (
                    <Option key={s.id} value={s.id}>{s.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="orderDate" label="Order Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="expectedDate" label="Expected Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Terms & Notes">
            <TextArea rows={2} placeholder="Add special instructions or delivery details..." />
          </Form.Item>
        </Card>

        <Card title="Line Items" style={{ marginBottom: 24 }}>
          <div className="desktop-only">
            <Table dataSource={items} columns={columns} pagination={false} scroll={{ x: 820 }} style={{ marginBottom: 16 }} />
          </div>
          <div className="mobile-only" style={{ marginBottom: 16 }}>
            {items.map((item, index) => (
              <Card 
                key={item.key} 
                size="small" 
                title={`Item #${index + 1}`}
                extra={items.length > 1 ? (
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(item.key)} />
                ) : null}
                style={{ marginBottom: 12, borderColor: 'var(--color-border)' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Row gutter={10}>
                    <Col span={10}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Type</div>
                      <Select value={item.type} onChange={(v) => handleItemChange(item.key, 'type', v)} style={{ width: '100%' }}>
                        <Option value="raw">Raw Material</Option>
                        <Option value="pkg">Packaging</Option>
                      </Select>
                    </Col>
                    <Col span={14}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Select Item</div>
                      <Select 
                        value={item.materialId || undefined} 
                        placeholder="Select item"
                        onChange={(v) => handleItemChange(item.key, 'materialId', v)}
                        style={{ width: '100%' }}
                      >
                        {(materialsByType[item.type] || []).map(m => (
                          <Option key={m.id} value={m.id}>{m.name}</Option>
                        ))}
                      </Select>
                    </Col>
                  </Row>

                  <Row gutter={10}>
                    <Col span={8}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Qty</div>
                      <InputNumber min={1} value={item.qty} onChange={(v) => handleItemChange(item.key, 'qty', v)} style={{ width: '100%' }} />
                    </Col>
                    <Col span={16}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Unit Price</div>
                      <InputNumber min={0} prefix="₹" value={item.price} onChange={(v) => handleItemChange(item.key, 'price', v)} style={{ width: '100%' }} />
                    </Col>
                  </Row>

                  <Row gutter={10}>
                    <Col span={12}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>GST Rate</div>
                      <Select value={item.tax} onChange={(v) => handleItemChange(item.key, 'tax', v)} style={{ width: '100%' }}>
                        <Option value={0}>0%</Option>
                        <Option value={5}>5%</Option>
                        <Option value={12}>12%</Option>
                        <Option value={18}>18%</Option>
                        <Option value={28}>28%</Option>
                      </Select>
                    </Col>
                    <Col span={12} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end', paddingBottom: 4 }}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Total</div>
                      <span style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--color-gold)' }}>₹{(item.total || 0).toLocaleString()}</span>
                    </Col>
                  </Row>
                </div>
              </Card>
            ))}
          </div>
          <Button type="dashed" onClick={handleAddItem} icon={<PlusOutlined />} style={{ width: '100%', color: 'var(--color-gold)', borderColor: 'var(--color-gold)' }}>
            Add Line Item
          </Button>

          <Divider />

          <Row justify="end">
            <Col xs={24} md={8}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>Subtotal:</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>Total GST:</span>
                <span>₹{totalTax.toLocaleString()}</span>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 16 }}>
                <span style={{ color: 'var(--color-gold)' }}>Grand Total:</span>
                <span style={{ color: 'var(--color-gold)' }}>₹{grandTotal.toLocaleString()}</span>
              </div>
            </Col>
          </Row>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
          <Button onClick={() => navigate('/app/purchase-orders')}>Cancel</Button>
          <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />}>
            Save Order
          </Button>
        </div>
      </Form>
    </div>
  );
}
