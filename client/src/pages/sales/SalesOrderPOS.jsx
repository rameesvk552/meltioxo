import React, { useState } from 'react';
import { Button, Card, Divider, Form, Input, InputNumber, Modal, Radio, Select, Space, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, DeleteOutlined, InfoCircleOutlined, PlusOutlined, SearchOutlined, ShoppingCartOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import PaymentSplitEditor from '../../components/common/PaymentSplitEditor';
import './SalesOrderPOS.css';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));

export default function SalesOrderPOS() {
  const [form] = Form.useForm();
  const [customerForm] = Form.useForm();
  const navigate = useNavigate();
  const { data: finishedGoods, loading: productsLoading } = useApiData('/finished-goods');
  const { data: customers } = useApiData('/customers');
  const { data: paymentMethods } = useApiData('/accounts/payment-methods');
  const [phone, setPhone] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountMode, setDiscountMode] = useState('percentage');
  const [paymentSplits, setPaymentSplits] = useState([]);
  const [items, setItems] = useState([{ key: '1', product: null, qty: 1, price: 0, discount: 0, tax: 18 }]);

  const products = finishedGoods.map(item => ({ ...item, price: Number(item.selling_price || 0), tax: Number(item.tax_rate || 0) }));
  const normalizedPhone = phone.replace(/\D/g, '');
  const matchingCustomers = customers.filter(customer => normalizedPhone.length >= 3 && (customer.phone || '').replace(/\D/g, '').includes(normalizedPhone));
  const selectedCount = items.filter(item => item.product).length;
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountAmount = discountMode === 'percentage' ? subtotal * discount / 100 : Math.min(Number(discount || 0), subtotal);
  const discountPct = subtotal ? discountAmount / subtotal * 100 : 0;
  const tax = items.reduce((sum, item) => sum + item.price * item.qty * (1 - discountPct / 100) * item.tax / 100, 0);
  const total = subtotal - discountAmount + tax;

  const updateProduct = (productId, key) => {
    const product = products.find(item => item.id === productId);
    if (!product) return;
    setItems(current => current.map(item => item.key === key ? { ...item, product: productId, price: product.price, tax: product.tax } : item));
  };

  const updateItem = (value, field, key) => setItems(current => current.map(item => item.key === key ? { ...item, [field]: value } : item));
  const addItem = () => setItems(current => [...current, { key: Date.now().toString(), product: null, qty: 1, price: 0, discount: 0, tax: 18 }]);
  const removeItem = key => setItems(current => current.length > 1 ? current.filter(item => item.key !== key) : current);

  const selectCustomer = customer => {
    setSelectedCustomer(customer);
    setPhone(customer.phone || '');
  };

  const openCustomerModal = () => {
    customerForm.setFieldsValue({ phone: normalizedPhone, name: '', address: '' });
    setCustomerModalOpen(true);
  };

  const createCustomer = async values => {
    const customerPhone = (values.phone || phone).replace(/\D/g, '');
    if (!customerPhone) return customerForm.setFields([{ name: 'phone', errors: ['Phone number is required'] }]);
    const { data } = await client.post('/customers', {
      phone: customerPhone,
      name: values.name?.trim() || 'Walk-in customer',
      address: values.address?.trim() || undefined,
    });
    selectCustomer(data);
    setCustomerModalOpen(false);
    message.success('Customer selected');
  };

  const submitSale = async (allowNegativeMaterials = false) => {
    const saleItems = items.filter(item => item.product);
    if (!saleItems.length) return message.error('Add at least one product.');
    const validPayments = paymentSplits.filter(row => row.payment_method_id && Number(row.amount) > 0);
    const paidCents = validPayments.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
    if (!validPayments.length) return message.error('Select a payment method.');
    if (paidCents !== Math.round(total * 100)) return message.error('Split payments must equal the total due.');
    const response = await client.post('/retail-sales', {
      customer_id: selectedCustomer?.id,
      payments: validPayments.map(row => ({ payment_method_id: row.payment_method_id, amount: row.amount })),
      allow_negative_materials: allowNegativeMaterials,
      items: saleItems.map(item => ({
        finished_good_id: item.product,
        quantity: item.qty,
        unit_price: item.price,
        discount_pct: discountPct,
        tax_rate: item.tax,
      })),
    });
    message.success(`Sale ${response.data.sale_number || ''} completed. Invoice is ready.`);
    navigate(`/app/retail-sales/${response.data.id}/invoice?created=1`);
    return response;
  };

  const finishSale = async () => {
    try {
      await submitSale(false);
    } catch (error) {
      const data = error.response?.data;
      if (error.response?.status === 409 && data?.code === 'NEGATIVE_STOCK_CONFIRMATION_REQUIRED') {
        Modal.confirm({
          title: 'Materials will go below zero',
          width: 500,
          content: <div><Text type="secondary">These shortages will be tracked:</Text><div className="pos-shortages">{(data.shortages || []).map(item => <div key={`${item.material_type}:${item.material_id}`}><span>{item.name}</span><Text type="danger">Short {Number(item.shortage_qty).toLocaleString()} {item.unit}</Text></div>)}</div></div>,
          okText: 'Confirm sale',
          okButtonProps: { danger: true },
          onOk: async () => {
            try { await submitSale(true); }
            catch (submitError) { message.error(submitError.response?.data?.message || 'Could not complete the sale'); throw submitError; }
          },
        });
        return;
      }
      message.error(data?.message || 'Could not complete the sale');
    }
  };

  return <div className="pos-page">
    <Form form={form} onFinish={finishSale} className="pos-form">
      <header className="pos-topbar">
        <Button type="text" icon={<ArrowLeftOutlined />} aria-label="Back" onClick={() => navigate('/app/retail-sales')} />
        <span className="pos-title-icon"><ShoppingCartOutlined /></span>
        <div className="pos-title"><h1>New retail sale</h1><span>Compact point of sale</span></div>
        <Tag>{selectedCount} {selectedCount === 1 ? 'item' : 'items'}</Tag>
      </header>

      <div className="pos-layout">
        <main className="pos-main">
          <Card className="pos-customer-card">
            <div className="pos-customer-row">
              <div className="pos-section-label"><UserOutlined /><div><strong>Customer</strong><span>Optional</span></div></div>
              <div className="pos-customer-search">
                <Input allowClear prefix={<SearchOutlined />} inputMode="numeric" placeholder="Search phone number" value={phone} onChange={event => { setPhone(event.target.value); setSelectedCustomer(null); }} />
                {selectedCustomer && <div className="pos-selected-customer"><span><strong>{selectedCustomer.name || 'Walk-in customer'}</strong> · {selectedCustomer.phone}</span><Tag color="success">Selected</Tag></div>}
                {!selectedCustomer && normalizedPhone.length >= 3 && <div className="pos-customer-results">
                  {matchingCustomers.map(customer => <button type="button" key={customer.id} onClick={() => selectCustomer(customer)}><strong>{customer.name || 'Walk-in customer'}</strong><span>{customer.phone}</span></button>)}
                  <Button size="small" type="dashed" icon={<UserAddOutlined />} onClick={openCustomerModal}>Add new customer</Button>
                </div>}
              </div>
            </div>
          </Card>

          <Card className="pos-items-card">
            <div className="pos-items-toolbar"><div><strong>Products</strong><span>{selectedCount} selected</span></div><Button type="primary" size="small" icon={<PlusOutlined />} onClick={addItem}>Add product</Button></div>
            <div className="pos-items-scroll">
              {items.map((item, index) => {
                const selected = products.find(product => product.id === item.product);
                const packages = selected ? (selected.variantPackagings || []).map(row => `${Number(row.quantity) * item.qty} ${row.packagingMaterial?.name || 'packaging'}`).join(' + ') : '';
                const isReadyMade = selected?.source_type === 'ready_made';
                const hasStock = selected && Number(selected.current_stock) >= item.qty;
                return <section className="pos-item" key={item.key}>
                  <div className="pos-item-head"><span className="pos-item-index">{index + 1}</span><strong>{selected ? (selected.product?.name || selected.name) : `Product ${index + 1}`}</strong><Text type="secondary">{selected ? `${selected.size_label || selected.name} · ${selected.sku}` : 'Not selected'}</Text><Button type="text" danger size="small" icon={<DeleteOutlined />} disabled={items.length === 1} onClick={() => removeItem(item.key)} /></div>
                  <div className="pos-item-grid">
                    <label className="pos-field pos-product-field"><span>Product / SKU</span><Select showSearch optionFilterProp="label" placeholder="Search product name or SKU" loading={productsLoading} notFoundContent={<span className="pos-select-empty">{productsLoading ? 'Loading products…' : 'No matching product or SKU'}</span>} value={item.product} onChange={value => updateProduct(value, item.key)}>{products.map(product => {
                      const productName = product.product?.name || product.name;
                      const variantName = product.size_label || product.name;
                      const searchLabel = `${product.sku || ''} ${productName} ${variantName}`.trim();
                      return <Option key={product.id} value={product.id} label={searchLabel}>{product.sku ? `${product.sku} · ` : ''}{productName} · {variantName}</Option>;
                    })}</Select></label>
                    <label className="pos-field"><span>Quantity</span><InputNumber min={1} value={item.qty} onChange={value => updateItem(value || 1, 'qty', item.key)} /></label>
                    <label className="pos-field"><span>Unit price</span><InputNumber min={0} prefix="₹" value={item.price} onChange={value => updateItem(value || 0, 'price', item.key)} /></label>
                    <div className="pos-line-total"><span>Line total</span><strong>{money(item.price * item.qty)}</strong></div>
                  </div>
                  <div className="pos-item-bottom">
                    {selected && <Tag color={isReadyMade ? 'blue' : 'gold'}>{isReadyMade ? 'Ready-made · From stock' : 'Make live · Automatic'}</Tag>}
                    {selected && <div className={`pos-stock-note ${isReadyMade ? hasStock ? 'success' : 'danger' : 'warning'}`}><InfoCircleOutlined />{isReadyMade ? `${Number(selected.current_stock || 0)} in stock` : `${Number(selected.fill_quantity_ml || 0) * item.qty} ml formula${packages ? ` + ${packages}` : ''}`}</div>}
                  </div>
                </section>;
              })}
            </div>
            <Button className="pos-add-row" type="dashed" size="small" icon={<PlusOutlined />} onClick={addItem} block>Add another product</Button>
          </Card>
        </main>

        <aside className="pos-checkout">
          <Card>
            <div className="pos-checkout-heading"><strong>Checkout</strong><Tag>Draft</Tag></div>
            <div className="pos-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Discount</span><strong className={discountAmount ? 'negative' : ''}>− {money(discountAmount)}</strong></div>{tax > 0 && <div><span>Tax</span><strong>+ {money(tax)}</strong></div>}</div>
            <Divider />
            <label className="pos-discount-label">Order discount</label>
            <div className="pos-discount"><Radio.Group value={discountMode} onChange={event => { setDiscountMode(event.target.value); setDiscount(0); }} optionType="button" buttonStyle="solid" size="small"><Radio.Button value="percentage">%</Radio.Button><Radio.Button value="amount">₹</Radio.Button></Radio.Group><InputNumber min={0} max={discountMode === 'percentage' ? 100 : subtotal} value={discount} onChange={value => setDiscount(value || 0)} suffix={discountMode === 'percentage' ? '%' : undefined} prefix={discountMode === 'amount' ? '₹' : undefined} /></div>
            <div className="pos-total"><span>Total due</span><strong>{money(total)}</strong></div>
            <Form.Item label="Payment" required className="pos-payment">
              <PaymentSplitEditor paymentMethods={paymentMethods} total={total} value={paymentSplits} onChange={setPaymentSplits} compact />
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} block className="pos-complete">Complete sale · {money(total)}</Button>
            <Button type="text" size="small" block onClick={() => navigate('/app/retail-sales')}>Cancel</Button>
            <p className="pos-auto-note"><CheckCircleOutlined /> Stock and accounts update automatically</p>
          </Card>
        </aside>
      </div>
    </Form>

    <Modal title="Add customer" open={customerModalOpen} onCancel={() => setCustomerModalOpen(false)} footer={null} destroyOnHidden>
      <Text type="secondary" className="pos-modal-note">Only the phone number is required.</Text>
      <Form form={customerForm} layout="vertical" onFinish={createCustomer}>
        <Form.Item name="phone" label="Phone number" rules={[{ required: true, message: 'Enter a phone number' }]}><Input inputMode="numeric" /></Form.Item>
        <Form.Item name="name" label="Name (optional)"><Input placeholder="Customer name" /></Form.Item>
        <Form.Item name="address" label="Address (optional)"><TextArea rows={3} placeholder="Address" /></Form.Item>
        <Space className="pos-modal-actions"><Button onClick={() => setCustomerModalOpen(false)}>Cancel</Button><Button type="primary" htmlType="submit">Save & select</Button></Space>
      </Form>
    </Modal>
  </div>;
}
