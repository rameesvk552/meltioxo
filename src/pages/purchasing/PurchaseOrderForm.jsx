import React, { useState } from 'react';
import { Card, Typography, Steps, Form, Select, DatePicker, Input, Button, Table, InputNumber, Row, Col, Space, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Step } = Steps;
const { Option } = Select;
const { TextArea } = Input;

const PurchaseOrderForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  
  const [items, setItems] = useState([
    { key: '1', type: 'Raw Material', material: 'Sandalwood Oil', qty: 10, unitPrice: 85000, tax: 18 }
  ]);

  const suppliers = [
    { value: '1', label: 'Aromatic Essentials Pvt Ltd' },
    { value: '2', label: 'Global Glassworks' },
  ];

  const calculateLineTotal = (record) => {
    const subtotal = record.qty * record.unitPrice;
    const taxAmt = subtotal * (record.tax / 100);
    return subtotal + taxAmt;
  };

  const calculateSubtotal = () => items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
  const calculateTotalTax = () => items.reduce((sum, item) => sum + ((item.qty * item.unitPrice) * (item.tax / 100)), 0);
  const calculateGrandTotal = () => calculateSubtotal() + calculateTotalTax();

  const handleAddItem = () => {
    setItems([...items, { key: Date.now().toString(), type: 'Raw Material', material: '', qty: 1, unitPrice: 0, tax: 18 }]);
  };

  const handleRemoveItem = (key) => {
    setItems(items.filter(item => item.key !== key));
  };

  const updateItem = (key, field, value) => {
    setItems(items.map(item => item.key === key ? { ...item, [field]: value } : item));
  };

  const columns = [
    {
      title: 'Type', dataIndex: 'type', key: 'type',
      render: (text, record) => (
        <Select value={text} onChange={(v) => updateItem(record.key, 'type', v)} style={{ width: 120 }}>
          <Option value="Raw Material">Raw Material</Option>
          <Option value="Packaging">Packaging</Option>
        </Select>
      )
    },
    {
      title: 'Material', dataIndex: 'material', key: 'material',
      render: (text, record) => (
        <Input value={text} onChange={(e) => updateItem(record.key, 'material', e.target.value)} placeholder="Material Name" />
      )
    },
    {
      title: 'Quantity', dataIndex: 'qty', key: 'qty',
      render: (text, record) => (
        <InputNumber min={1} value={text} onChange={(v) => updateItem(record.key, 'qty', v)} />
      )
    },
    {
      title: 'Unit Price (₹)', dataIndex: 'unitPrice', key: 'unitPrice',
      render: (text, record) => (
        <InputNumber min={0} value={text} onChange={(v) => updateItem(record.key, 'unitPrice', v)} style={{ width: 100 }} />
      )
    },
    {
      title: 'Tax %', dataIndex: 'tax', key: 'tax',
      render: (text, record) => (
        <Select value={text} onChange={(v) => updateItem(record.key, 'tax', v)} style={{ width: 80 }}>
          <Option value={0}>0%</Option>
          <Option value={5}>5%</Option>
          <Option value={12}>12%</Option>
          <Option value={18}>18%</Option>
          <Option value={28}>28%</Option>
        </Select>
      )
    },
    {
      title: 'Line Total', key: 'total',
      render: (_, record) => `₹${calculateLineTotal(record).toLocaleString()}`
    },
    {
      title: '', key: 'action',
      render: (_, record) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(record.key)} />
      )
    }
  ];

  const steps = [
    { title: 'Select Supplier' },
    { title: 'Add Items' },
    { title: 'Review & Submit' },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ color: '#d4a853', fontFamily: 'Playfair Display', marginBottom: '24px' }}>Create Purchase Order</Title>
      
      <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: '24px' }}>
        <Steps current={currentStep} style={{ marginBottom: '32px' }} className="custom-steps">
          {steps.map(item => <Step key={item.title} title={item.title} />)}
        </Steps>

        <Form form={form} layout="vertical">
          {currentStep === 0 && (
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item label="Supplier" name="supplier" rules={[{ required: true }]}>
                  <Select options={suppliers} placeholder="Select a supplier" />
                </Form.Item>
                <Form.Item label="Order Date" name="orderDate" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Expected Delivery" name="expectedDate">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="Notes" name="notes">
                  <TextArea rows={4} placeholder="Any special instructions..." />
                </Form.Item>
              </Col>
            </Row>
          )}

          {currentStep === 1 && (
            <div>
              <Table 
                dataSource={items} 
                columns={columns} 
                pagination={false}
                style={{ marginBottom: '16px' }}
                scroll={{ x: 'max-content' }}
              />
              <Button type="dashed" onClick={handleAddItem} icon={<PlusOutlined />} style={{ width: '100%', marginBottom: '24px' }}>
                Add Item
              </Button>
              
              <Row justify="end">
                <Col span={8}>
                  <Card size="small" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ color: '#94a3b8' }}>Subtotal:</Text>
                      <Text style={{ color: '#e2e8f0' }}>₹{calculateSubtotal().toLocaleString()}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ color: '#94a3b8' }}>Total Tax:</Text>
                      <Text style={{ color: '#e2e8f0' }}>₹{calculateTotalTax().toLocaleString()}</Text>
                    </div>
                    <Divider style={{ margin: '8px 0', borderColor: 'var(--color-border)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong style={{ color: '#d4a853', fontSize: 16 }}>Grand Total:</Text>
                      <Text strong style={{ color: '#d4a853', fontSize: 16 }}>₹{calculateGrandTotal().toLocaleString()}</Text>
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
          )}

          {currentStep === 2 && (
            <Card style={{ background: 'rgba(212, 168, 83, 0.05)', borderColor: '#d4a853' }}>
              <Title level={4} style={{ color: '#d4a853', marginTop: 0 }}>Review Order</Title>
              <Text style={{ color: '#e2e8f0' }}>Please review the details before submitting the purchase order.</Text>
              <Divider style={{ borderColor: 'var(--color-border)' }} />
              <Row>
                <Col span={12}>
                  <p><span style={{ color: '#94a3b8' }}>Total Items:</span> <span style={{ color: '#fff' }}>{items.length}</span></p>
                  <p><span style={{ color: '#94a3b8' }}>Grand Total:</span> <span style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>₹{calculateGrandTotal().toLocaleString()}</span></p>
                </Col>
              </Row>
            </Card>
          )}

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            {currentStep > 0 && <Button onClick={() => setCurrentStep(currentStep - 1)}>Previous</Button>}
            {currentStep === 0 && <div></div>}
            
            {currentStep < steps.length - 1 && (
              <Button type="primary" onClick={() => setCurrentStep(currentStep + 1)} style={{ backgroundColor: '#d4a853', color: '#0f1729', border: 'none' }}>
                Next
              </Button>
            )}
            {currentStep === steps.length - 1 && (
              <Button type="primary" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none' }}>
                Submit Order
              </Button>
            )}
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default PurchaseOrderForm;
