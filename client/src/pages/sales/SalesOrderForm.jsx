import React, { useState } from 'react';
import { Card, Form, Select, Input, Button, Row, Col, Typography, InputNumber, Divider, Modal, message, Radio, Space, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const SalesOrderForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { data: finishedGoods } = useApiData('/finished-goods');
  const { data: customers } = useApiData('/customers');
  const { data: paymentMethods } = useApiData('/accounts/payment-methods');
  const [customerForm] = Form.useForm();
  const [phone, setPhone] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [discountMode, setDiscountMode] = useState('percentage');
  const [paymentMethodId, setPaymentMethodId] = useState(null);
  const products = finishedGoods.map(item => ({
    ...item, price: Number(item.selling_price || 0), tax: Number(item.tax_rate || 0)
  }));
  const [items, setItems] = useState([
    { key: '1', product: null, qty: 1, price: 0, discount: 0, tax: 18, total: 0, fulfillment: 'stock' }
  ]);

  const handleProductChange = (val, key) => {
    const prod = products.find(p => p.id === val);
    const newItems = items.map(item => {
      if (item.key === key) {
        const total = (prod.price * item.qty) * (1 - item.discount / 100);
        return { ...item, product: val, price: prod.price, tax: prod.tax, total };
      }
      return item;
    });
    setItems(newItems);
  };

  const handleItemChange = (val, field, key) => {
    const newItems = items.map(item => {
      if (item.key === key) {
        const updated = { ...item, [field]: val };
        updated.total = (updated.price * updated.qty) * (1 - updated.discount / 100);
        return updated;
      }
      return item;
    });
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { key: Date.now().toString(), product: null, qty: 1, price: 0, discount: 0, tax: 18, total: 0, fulfillment: 'stock' }]);
  };

  const removeItem = (key) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.key !== key));
    }
  };

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalDiscount = discountMode === 'percentage'
    ? subtotal * (globalDiscount / 100)
    : Math.min(Number(globalDiscount || 0), subtotal);
  const effectiveDiscountPct = subtotal ? (totalDiscount / subtotal) * 100 : 0;
  const totalTax = items.reduce((sum, item) => sum + (item.price * item.qty * (1 - effectiveDiscountPct / 100) * (item.tax / 100)), 0);
  const grandTotal = subtotal - totalDiscount + totalTax;

  const filteredCustomers = customers.filter(customer => phone.replace(/\D/g, '').length >= 3 && (customer.phone || '').replace(/\D/g, '').includes(phone.replace(/\D/g, '')));

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setPhone(customer.phone || '');
  };

  const createCustomer = async (values) => {
    const customerPhone = (values.phone || phone).replace(/\D/g, '');
    if (!customerPhone) {
      customerForm.setFields([{ name: 'phone', errors: ['Phone number is required'] }]);
      return;
    }
    const { data } = await client.post('/customers', {
      phone: customerPhone,
      name: values.name?.trim() || 'Walk-in customer',
      address: values.address?.trim() || undefined
    });
    selectCustomer(data);
    setCustomerModalOpen(false);
    message.success('Customer selected');
  };

  const submitSale = async (allowNegativeMaterials = false) => {
    const saleItems = items.filter(item => item.product);
    if (!saleItems.length) {
      message.error('Add at least one product.');
      return;
    }
    if (!paymentMethodId) {
      message.error('Select the payment method used for this sale.');
      return;
    }
    const response = await client.post('/retail-sales', {
      customer_id: selectedCustomer?.id,
      payment_method_id: paymentMethodId,
      allow_negative_materials: allowNegativeMaterials,
      items: saleItems.map(item => ({
        finished_good_id: item.product,
        fulfillment_mode: item.fulfillment,
        quantity: item.qty,
        unit_price: item.price,
        // The API stores a line-level percentage. A fixed order discount is
        // converted proportionally so tax and accounting remain accurate.
        discount_pct: effectiveDiscountPct,
        tax_rate: item.tax
      }))
    });
    navigate('/app/retail-sales');
    return response;
  };

  const onFinish = async () => {
    try {
      await submitSale(false);
    } catch (error) {
      const data = error.response?.data;
      if (error.response?.status === 409 && data?.code === 'NEGATIVE_STOCK_CONFIRMATION_REQUIRED') {
        Modal.confirm({
          title: 'Materials will go below zero',
          width: 560,
          content: (
            <div>
              <Text type="secondary">The sale can continue, but these shortages will be tracked until the next purchase:</Text>
              <div style={{ marginTop: 12 }}>
                {(data.shortages || []).map(item => (
                  <div key={`${item.material_type}:${item.material_id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span>{item.name}</span>
                    <Text type="danger">Short {Number(item.shortage_qty).toLocaleString()} {item.unit}</Text>
                  </div>
                ))}
              </div>
            </div>
          ),
          okText: 'Confirm & Complete Sale',
          okButtonProps: { danger: true },
          onOk: async () => {
            try { await submitSale(true); } catch (submitError) { message.error(submitError.response?.data?.message || 'Could not complete the sale'); throw submitError; }
          }
        });
        return;
      }
      message.error(data?.message || 'Could not complete the sale');
    }
  };

  const _columns = [
    {
      title: 'Product',
      dataIndex: 'product',
      key: 'product',
      width: 240,
      render: (val, record) => (
        <Select 
          style={{ width: '100%' }} 
          placeholder="Select product" 
          value={val} 
          onChange={(v) => handleProductChange(v, record.key)}
        >
          {products.map(p => (
            <Option key={p.id} value={p.id}>
              {p.product?.name || p.name} — {p.size_label || p.name} ({p.sku})
            </Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Quantity',
      dataIndex: 'qty',
      key: 'qty',
      render: (val, record) => (
        <InputNumber min={1} value={val} onChange={(v) => handleItemChange(v, 'qty', record.key)} style={{ width: '100%' }} />
      )
    },
    {
      title: 'Unit Price',
      dataIndex: 'price',
      key: 'price',
      render: (val, record) => (
        <InputNumber min={0} value={val} onChange={(v) => handleItemChange(v, 'price', record.key)} style={{ width: '100%' }} />
      )
    },
    {
      title: 'Line Total',
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      render: (val) => `₹${val.toLocaleString('en-IN')}`
    },
    {
      title: '',
      key: 'action',
      render: (_, record) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeItem(record.key)} />
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={24}>
            <Col xs={24}>
              <Form.Item label="Customer (optional)">
                <Input
                  size="large"
                  prefix={<SearchOutlined />}
                  inputMode="numeric"
                  placeholder="Enter customer phone number"
                  value={phone}
                  onChange={event => { setPhone(event.target.value); setSelectedCustomer(null); }}
                />
                {selectedCustomer ? (
                  <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(82,196,26,.1)', border: '1px solid rgba(82,196,26,.35)', display: 'flex', justifyContent: 'space-between' }}>
                    <span><Text strong>{selectedCustomer.name || 'Walk-in customer'}</Text><Text type="secondary"> · {selectedCustomer.phone}</Text></span><Tag color="success">Selected</Tag>
                  </div>
                ) : phone.replace(/\D/g, '').length >= 3 ? (
                  <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size={4}>
                    {filteredCustomers.map(customer => <Button key={customer.id} type="text" block style={{ textAlign: 'left' }} onClick={() => selectCustomer(customer)}><Text strong>{customer.name || 'Walk-in customer'}</Text><Text type="secondary"> · {customer.phone}</Text></Button>)}
                    <Button icon={<UserAddOutlined />} type={filteredCustomers.length ? 'dashed' : 'primary'} block onClick={() => { customerForm.setFieldsValue({ phone: phone.replace(/\D/g, ''), name: '', address: '' }); setCustomerModalOpen(true); }}>Add customer with this number</Button>
                  </Space>
                ) : <Text type="secondary" style={{ display: 'block', marginTop: 6 }}>Add a customer by phone only if you want to save their details for this sale.</Text>}
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 16 }}>Line Items</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {items.map((item, index) => (
              <div key={item.key} style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text strong>Product {index + 1}</Text>
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} disabled={items.length === 1} onClick={() => removeItem(item.key)}>Remove</Button>
                </div>
                <Select style={{ width: '100%', marginBottom: 10 }} showSearch optionFilterProp="children" placeholder="Select product" value={item.product} onChange={(value) => handleProductChange(value, item.key)}>
                  {products.map(product => <Option key={product.id} value={product.id}>{product.product?.name || product.name} · {product.size_label || product.name} ({product.sku})</Option>)}
                </Select>
                <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>How should this item be fulfilled?</Text>
                <Radio.Group
                  value={item.fulfillment}
                  onChange={event => handleItemChange(event.target.value, 'fulfillment', item.key)}
                  optionType="button"
                  buttonStyle="solid"
                  style={{ marginBottom: 10 }}
                >
                  <Radio.Button value="stock">Sell from Stock</Radio.Button>
                  <Radio.Button value="make_now">Make Now</Radio.Button>
                </Radio.Group>
                {item.product && (() => {
                  const selected = products.find(product => product.id === item.product);
                  if (!selected) return null;
                  if (item.fulfillment === 'stock') return <div style={{ marginBottom: 10 }}><Tag color={Number(selected.current_stock) >= item.qty ? 'success' : 'error'}>{Number(selected.current_stock || 0)} in finished stock</Tag></div>;
                  const packages = (selected.variantPackagings || []).map(row => `${Number(row.quantity) * item.qty} ${row.packagingMaterial?.name || 'packaging'}`).join(' + ');
                  return <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: '#fff7e6' }}><Text>Uses {Number(selected.fill_quantity_ml || 0) * item.qty} ml formula{packages ? ` + ${packages}` : ''}</Text></div>;
                })()}
                <Row gutter={10}>
                  <Col span={12}><Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Quantity</Text><InputNumber min={1} value={item.qty} onChange={(value) => handleItemChange(value, 'qty', item.key)} style={{ width: '100%' }} /></Col>
                  <Col span={12}><Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Unit price</Text><InputNumber min={0} prefix="₹" value={item.price} onChange={(value) => handleItemChange(value, 'price', item.key)} style={{ width: '100%' }} /></Col>
                </Row>
              </div>
            ))}
          </div>
          <Button type="dashed" onClick={addItem} icon={<PlusOutlined />} style={{ width: '100%', borderColor: 'var(--color-gold)', color: 'var(--color-gold)' }}>
            Add Product
          </Button>
          <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: '#fff9e8' }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Order discount</Text>
            <Radio.Group value={discountMode} onChange={event => { setDiscountMode(event.target.value); setGlobalDiscount(0); }} style={{ marginBottom: 10 }}>
              <Radio.Button value="percentage">Percentage</Radio.Button>
              <Radio.Button value="amount">Amount</Radio.Button>
            </Radio.Group>
            <InputNumber min={0} max={discountMode === 'percentage' ? 100 : subtotal} value={globalDiscount} onChange={value => setGlobalDiscount(value || 0)} addonAfter={discountMode === 'percentage' ? '%' : '₹'} style={{ width: '100%' }} />
          </div>

          <Divider style={{ borderColor: '#30363d' }} />

          <Row justify="end">
            <Col xs={24} sm={12} lg={8}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: 'var(--color-text-secondary)' }}>Subtotal:</Text>
                <Text >₹{subtotal.toLocaleString('en-IN')}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: 'var(--color-text-secondary)' }}>Discount:</Text>
                <Text style={{ color: '#ff4d4f' }}>- ₹{totalDiscount.toLocaleString('en-IN')}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: 'var(--color-text-secondary)' }}>Tax:</Text>
                <Text >+ ₹{totalTax.toLocaleString('en-IN')}</Text>
              </div>
              <Divider style={{ margin: '12px 0', borderColor: '#30363d' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Title level={4} style={{ color: 'var(--color-gold)', margin: 0 }}>Grand Total:</Title>
                <Title level={4} style={{ color: 'var(--color-gold)', margin: 0 }}>₹{grandTotal.toLocaleString('en-IN')}</Title>
              </div>
            </Col>
          </Row>
        </Card>

        <Card style={{ marginBottom: 24 }}>
          <Form.Item label="Payment method" required style={{ marginBottom: 0 }}>
            <Select placeholder="Select payment method" value={paymentMethodId} onChange={setPaymentMethodId}>
              {paymentMethods.map(method => <Option key={method.id} value={method.id}>{method.name}{method.account ? ` — ${method.account.name}` : ''}</Option>)}
            </Select>
          </Form.Item>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
          <Button onClick={() => navigate('/app/retail-sales')}>
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a' }}>
            Complete Sale
          </Button>
        </div>
      </Form>
      <Modal title="Add customer" open={customerModalOpen} onCancel={() => setCustomerModalOpen(false)} footer={null} destroyOnHidden>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Only phone is needed. Name and address are optional.</Text>
        <Form form={customerForm} layout="vertical" onFinish={createCustomer}>
          <Form.Item name="phone" label="Phone number" rules={[{ required: true, message: 'Enter a phone number' }]}><Input inputMode="numeric" /></Form.Item>
          <Form.Item name="name" label="Name (optional)"><Input placeholder="Customer name" /></Form.Item>
          <Form.Item name="address" label="Address (optional)"><TextArea rows={3} placeholder="Address" /></Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><Button onClick={() => setCustomerModalOpen(false)}>Cancel</Button><Button type="primary" htmlType="submit">Save & Select</Button></div>
        </Form>
      </Modal>
    </div>
  );
};

export default SalesOrderForm;
