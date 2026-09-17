import React, { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Divider, Form, Input, InputNumber, Modal, Radio, Select, Space, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, CreditCardOutlined, DeleteOutlined, FieldTimeOutlined, InfoCircleOutlined, LockOutlined, PlusOutlined, PrinterOutlined, SearchOutlined, ShoppingCartOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import PaymentSplitEditor from '../../components/common/PaymentSplitEditor';
import './SalesOrderPOS.css';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
const roundMoney = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const allocateFixedDiscount = (bases, amount) => {
  const totalCents = bases.reduce((sum, base) => sum + Math.round(base * 100), 0);
  const discountCents = Math.min(Math.round(amount * 100), totalCents);
  if (!totalCents || !discountCents) return bases.map(() => 0);
  const shares = bases.map((base, index) => {
    const exact = discountCents * Math.round(base * 100) / totalCents;
    return { index, cents: Math.floor(exact), remainder: exact % 1 };
  });
  let centsLeft = discountCents - shares.reduce((sum, share) => sum + share.cents, 0);
  shares.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let index = 0; index < centsLeft; index += 1) shares[index].cents += 1;
  return shares.sort((a, b) => a.index - b.index).map(share => share.cents / 100);
};
const quantityLabel = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 });
const newSaleItem = (itemType = 'finished_good') => ({ key: `${itemType}-${Date.now()}-${Math.random()}`, itemType, product: null, qty: 1, packCount: 1, packingKit: null, packingKitQuantities: null, price: 0, discount: 0, tax: itemType === 'finished_good' ? 18 : 0 });

export default function SalesOrderPOS() {
  const [form] = Form.useForm();
  const [customerForm] = Form.useForm();
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEditing = Boolean(editId);
  const { data: finishedGoods, loading: productsLoading } = useApiData('/finished-goods');
  const { data: packagingMaterials, loading: packagingLoading } = useApiData('/packaging-materials');
  const { data: customers } = useApiData('/customers');
  const { data: paymentMethods } = useApiData('/accounts/payment-methods');
  const { data: tenantSettings } = useApiData('/tenant/settings', { initialData: {} });
  const { data: packingKits } = useApiData('/packing-kits');
  const { data: dayState, loading: dayLoading, reload: reloadDay } = useApiData('/business-days/current', { initialData: {} });
  const { data: existingSale, loading: saleLoading } = useApiData(isEditing ? `/retail-sales/${editId}` : null, { initialData: {} });
  const [phone, setPhone] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountMode, setDiscountMode] = useState('percentage');
  const [paymentSplits, setPaymentSplits] = useState([]);
  const [cashTendered, setCashTendered] = useState(0);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [packingKitModal, setPackingKitModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editInitialized, setEditInitialized] = useState(false);
  const showFormulaInSales = Boolean(tenantSettings.show_formula_in_sales);
  const [items, setItems] = useState([{ ...newSaleItem(), key: '1' }]);

  useEffect(() => {
    if (!isEditing || editInitialized || !existingSale.id || !finishedGoods.length || !paymentMethods.length) return;
    const mappedItems = (existingSale.retailSaleItems || []).map((saleItem, index) => {
      const isPackaging = saleItem.item_type === 'packaging_material';
      const isMeasured = !isPackaging && Boolean(saleItem.finishedGood?.product?.sell_by_measurement);
      const packCount = Number(saleItem.pack_count || 1);
      const fillQuantity = Number(saleItem.fill_quantity_ml || (isMeasured ? Number(saleItem.quantity) / packCount : Number(saleItem.quantity)));
      const packingKitQuantities = (saleItem.retailSaleItemPackagings || []).reduce((result, row) => {
        result[row.packaging_material_id] = Number(row.quantity) / (isMeasured ? packCount : 1);
        return result;
      }, {});
      return {
        ...newSaleItem(isPackaging ? 'packaging_material' : 'finished_good'),
        key: `edit-${saleItem.id || index}`,
        product: isPackaging ? saleItem.packaging_material_id : saleItem.finished_good_id,
        qty: isMeasured ? fillQuantity : Number(saleItem.quantity),
        packCount,
        packingKit: saleItem.packing_kit_id || null,
        packingKitQuantities: Object.keys(packingKitQuantities).length ? packingKitQuantities : null,
        price: Number(saleItem.unit_price || 0),
        tax: Number(saleItem.tax_rate || 0),
      };
    });
    setItems(mappedItems.length ? mappedItems : [{ ...newSaleItem(), key: '1' }]);
    setSelectedCustomer(existingSale.customer || null);
    setPhone(existingSale.customer?.phone || '');
    setDiscountMode('amount');
    setDiscount(Number(existingSale.discount_amount || 0));
    const savedPayments = (existingSale.payments || []).filter(payment => Number(payment.amount) > 0);
    setPaymentSplits((savedPayments.length ? savedPayments : [{ payment_method_id: existingSale.payment_method_id, amount: Number(existingSale.total_amount || 0) }]).map((payment, index) => ({
      key: `edit-payment-${payment.id || index}`,
      payment_method_id: payment.payment_method_id,
      amount: Number(payment.amount || 0),
    })));
    setEditInitialized(true);
  }, [editInitialized, existingSale, finishedGoods.length, isEditing, paymentMethods.length]);

  const products = finishedGoods
    .filter(item => item.is_active !== false && item.product?.is_active !== false)
    .map(item => ({ ...item, price: Number(item.selling_price || 0), tax: Number(item.tax_rate || 0) }));
  const packingMaterialsForSale = packagingMaterials.map(item => ({ ...item, price: Number(item.selling_price || 0), tax: Number(item.tax_rate || 0) }));
  const selectedItemFor = item => item.itemType === 'packaging_material'
    ? packingMaterialsForSale.find(material => material.id === item.product)
    : products.find(product => product.id === item.product);
  const normalizedPhone = phone.replace(/\D/g, '');
  const matchingCustomers = customers.filter(customer => normalizedPhone.length >= 3 && (customer.phone || '').replace(/\D/g, '').includes(normalizedPhone));
  const selectedCount = items.filter(item => item.product).length;
  const saleItems = items.filter(item => item.product);
  const matchingKitsFor = fillMl => packingKits.filter(kit => kit.is_active !== false && Number(kit.minimum_fill_ml) <= Number(fillMl) && Number(kit.maximum_fill_ml) >= Number(fillMl));
  const selectedKitIdFor = item => {
    if (item.packingKit) return item.packingKit;
    const matches = matchingKitsFor(item.qty);
    if (tenantSettings.measured_packaging_auto_select === false) return null;
    const defaultKit = matches.find(kit => kit.is_default);
    return defaultKit?.id || (matches.length === 1 ? matches[0].id : null);
  };
  const saleQuantity = item => {
    const selected = selectedItemFor(item);
    if (item.itemType === 'packaging_material') return Number(item.qty || 0);
    return selected?.product?.sell_by_measurement ? Number(item.qty || 0) * Number(item.packCount || 1) : Number(item.qty || 0);
  };
  // Keep this calculation identical to retailSaleV2.controller.js. The API
  // rounds every line's base, discount, taxable value, and tax to cents
  // before summing, so the payment amount and document total cannot drift by
  // a cent due to JavaScript floating-point arithmetic.
  const subtotal = roundMoney(saleItems.reduce((sum, item) => sum + roundMoney(item.price * saleQuantity(item)), 0));
  const discountInput = Math.max(0, Number(discount || 0));
  const discountPct = discountMode === 'percentage'
    ? Math.min(discountInput, 100)
    : subtotal ? Math.min(discountInput, subtotal) / subtotal * 100 : 0;
  const fixedDiscounts = discountMode === 'amount'
    ? allocateFixedDiscount(saleItems.map(item => roundMoney(Number(item.price || 0) * saleQuantity(item))), Math.min(discountInput, subtotal))
    : null;
  const saleLineTotals = saleItems.map((item, index) => {
    const base = roundMoney(Number(item.price || 0) * saleQuantity(item));
    const lineDiscount = fixedDiscounts ? fixedDiscounts[index] : roundMoney(base * discountPct / 100);
    const taxable = roundMoney(base - lineDiscount);
    const lineTax = roundMoney(taxable * Number(item.tax || 0) / 100);
    return { item, total: roundMoney(taxable + lineTax), lineDiscount, lineTax };
  });
  const discountAmount = roundMoney(saleLineTotals.reduce((sum, line) => sum + line.lineDiscount, 0));
  const tax = roundMoney(saleLineTotals.reduce((sum, line) => sum + line.lineTax, 0));
  const total = roundMoney(subtotal - discountAmount + tax);
  const validPayments = paymentSplits.filter(row => row.payment_method_id && Number(row.amount) > 0);
  const paidCents = validPayments.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
  const cashMethodIds = new Set(paymentMethods.filter(method => String(method.method_type || '').toUpperCase() === 'CASH' || String(method.name || '').toLowerCase().includes('cash')).map(method => method.id));
  const cashPaymentAmount = validPayments.filter(row => cashMethodIds.has(row.payment_method_id)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const changeAmount = Math.max(0, Number(cashTendered || 0) - cashPaymentAmount);

  const updateProduct = (productId, key) => {
    const currentItem = items.find(item => item.key === key);
    const product = currentItem?.itemType === 'packaging_material'
      ? packingMaterialsForSale.find(item => item.id === productId)
      : products.find(item => item.id === productId);
    if (!product) return;
    const initialQuantity = product.product?.sell_by_measurement ? 0 : 1;
    setItems(current => current.map(item => item.key === key ? { ...item, product: productId, qty: initialQuantity, packCount: 1, packingKit: null, packingKitQuantities: null, price: product.price, tax: product.tax } : item));
  };

  const updateItem = (value, field, key) => setItems(current => current.map(item => item.key === key ? { ...item, [field]: value } : item));
  const openPackingKitModal = (kit, key) => {
    if (!kit) return;
    const currentItem = items.find(item => item.key === key);
    const quantities = currentItem?.packingKitQuantities || Object.fromEntries((kit.packingKitItems || []).map(row => [row.packaging_material_id, Number(row.quantity)]));
    setItems(current => current.map(item => item.key === key ? { ...item, packingKit: kit.id, packingKitQuantities: quantities } : item));
    setPackingKitModal({ kit, itemKey: key });
  };
  const selectPackingKit = (value, key) => {
    const kit = packingKits.find(item => item.id === value);
    if (kit) {
      openPackingKitModal(kit, key);
      return;
    }
    setItems(current => current.map(item => item.key === key ? { ...item, packingKit: null, packingKitQuantities: null } : item));
    setPackingKitModal(null);
  };
  const addItem = (itemType = 'finished_good') => setItems(current => [...current, newSaleItem(itemType)]);
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

  const validateSale = () => {
    if (!saleItems.length) {
      message.error('Add at least one item.');
      return false;
    }
    const missingKit = saleItems.find(item => {
      const selected = selectedItemFor(item);
      if (item.itemType === 'packaging_material') return false;
      return tenantSettings.measured_packaging_enabled && tenantSettings.measured_packaging_required !== false && selected?.product?.sell_by_measurement && !selectedKitIdFor(item);
    });
    if (missingKit) {
      message.error(matchingKitsFor(missingKit.qty).length ? 'Select a packing kit for every measured product.' : `No packing kit supports ${quantityLabel(missingKit.qty)} ml.`);
      return false;
    }
    if (!validPayments.length) {
      message.error('Select a payment method.');
      return false;
    }
    if (paidCents !== Math.round(total * 100)) {
      message.error('Split payments must equal the total due.');
      return false;
    }
    if (cashPaymentAmount > 0 && Math.round(Number(cashTendered || 0) * 100) < Math.round(cashPaymentAmount * 100)) {
      message.error(`Cash received is ${money(cashPaymentAmount - Number(cashTendered || 0))} short.`);
      return false;
    }
    return true;
  };

  const submitSale = async (allowNegativeMaterials = false) => {
    if (!validateSale()) return null;
    const response = await (isEditing ? client.put(`/retail-sales/${editId}`, {
      customer_id: selectedCustomer?.id,
      payments: validPayments.map(row => ({ payment_method_id: row.payment_method_id, amount: row.amount })),
      allow_negative_materials: allowNegativeMaterials,
      order_discount_amount: discountMode === 'amount' ? Math.min(discountInput, subtotal) : undefined,
      items: saleItems.map(item => ({
        finished_good_id: item.itemType === 'finished_good' ? item.product : undefined,
        packaging_material_id: item.itemType === 'packaging_material' ? item.product : undefined,
        quantity: saleQuantity(item),
        fill_quantity_ml: item.itemType === 'finished_good' && selectedItemFor(item)?.product?.sell_by_measurement ? Number(item.qty) : undefined,
        pack_count: item.itemType === 'finished_good' && selectedItemFor(item)?.product?.sell_by_measurement ? Number(item.packCount || 1) : 1,
        packing_kit_id: item.itemType === 'finished_good' && selectedItemFor(item)?.product?.sell_by_measurement && tenantSettings.measured_packaging_enabled ? selectedKitIdFor(item) : null,
        packing_kit_quantities: item.itemType === 'finished_good' && selectedItemFor(item)?.product?.sell_by_measurement ? item.packingKitQuantities : undefined,
        unit_price: item.price,
        discount_pct: discountPct,
        tax_rate: item.tax,
      })),
    }) : client.post('/retail-sales', {
      customer_id: selectedCustomer?.id,
      payments: validPayments.map(row => ({ payment_method_id: row.payment_method_id, amount: row.amount })),
      allow_negative_materials: allowNegativeMaterials,
      ...(discountMode === 'amount' ? { order_discount_amount: Math.min(discountInput, subtotal) } : {}),
      items: saleItems.map(item => ({
        finished_good_id: item.itemType === 'finished_good' ? item.product : undefined,
        packaging_material_id: item.itemType === 'packaging_material' ? item.product : undefined,
        quantity: saleQuantity(item),
        fill_quantity_ml: item.itemType === 'finished_good' && selectedItemFor(item)?.product?.sell_by_measurement ? Number(item.qty) : undefined,
        pack_count: item.itemType === 'finished_good' && selectedItemFor(item)?.product?.sell_by_measurement ? Number(item.packCount || 1) : 1,
        packing_kit_id: item.itemType === 'finished_good' && selectedItemFor(item)?.product?.sell_by_measurement && tenantSettings.measured_packaging_enabled ? selectedKitIdFor(item) : null,
        packing_kit_quantities: item.itemType === 'finished_good' && selectedItemFor(item)?.product?.sell_by_measurement ? item.packingKitQuantities : undefined,
        unit_price: item.price,
        discount_pct: discountPct,
        tax_rate: item.tax,
      })),
    }));
    message.success(isEditing ? `Sale ${response.data.sale_number || ''} updated. Invoice is ready.` : `Sale ${response.data.sale_number || ''} completed. Invoice is ready.`);
    if (!isEditing && response.data.whatsapp?.status === 'sent') {
      message.success('Invoice sent to the customer on WhatsApp.');
    } else if (!isEditing && response.data.whatsapp?.status === 'skipped') {
      message.warning('Invoice was not sent on WhatsApp because this customer has no phone number.');
    } else if (!isEditing && response.data.whatsapp?.status === 'failed') {
      message.warning('Sale completed, but the invoice could not be sent on WhatsApp.');
    }
    navigate(`/app/retail-sales/${response.data.id}/invoice?created=1`);
    return response;
  };

  const finishSale = async () => {
    try {
      const response = await submitSale(false);
      return Boolean(response);
    } catch (error) {
      const data = error.response?.data;
      if (error.response?.status === 409 && data?.code === 'NEGATIVE_STOCK_CONFIRMATION_REQUIRED') {
        setConfirmationOpen(false);
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
        return false;
      }
      message.error(data?.message || 'Could not complete the sale');
      return false;
    }
  };

  const openSaleConfirmation = () => {
    if (validateSale()) setConfirmationOpen(true);
  };

  const confirmSale = async () => {
    setSubmitting(true);
    try {
      const completed = await finishSale();
      if (completed) setConfirmationOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (isEditing && saleLoading) return <div className="pos-day-loading"><Card loading /></div>;
  if (isEditing && !existingSale.id) return <div className="pos-day-gate"><Card><h1>Sale not found</h1><p>The sale could not be loaded for editing.</p><Button onClick={() => navigate('/app/retail-sales')}>Back to sales</Button></Card></div>;
  if (!isEditing && dayLoading && !dayState.business_date) return <div className="pos-day-loading"><Card loading /></div>;

  if (!isEditing && !dayState.current) return <div className="pos-day-gate">
    <Card>
      <span className="pos-day-gate-icon"><LockOutlined /></span>
      <h1>{dayState.today_record?.status === 'closed' ? 'Today’s register is closed' : 'Open the register to start selling'}</h1>
      <p>{dayState.today_record?.status === 'closed' ? 'This business day has been reconciled and cannot accept more POS sales.' : 'Enter the opening cash in the Day Register before completing the first sale.'}</p>
      {dayState.can_open && <Button type="primary" size="large" icon={<FieldTimeOutlined />} onClick={() => navigate('/app/day-register')}>Open business day</Button>}
      {!dayState.can_open && <Button size="large" icon={<FieldTimeOutlined />} onClick={() => navigate('/app/day-register')}>View day register</Button>}
      <Button type="text" onClick={reloadDay}>Check again</Button>
    </Card>
  </div>;

  return <div className="pos-page">
    <Form form={form} onFinish={openSaleConfirmation} className="pos-form">
      <header className="pos-topbar">
        <Button type="text" icon={<ArrowLeftOutlined />} aria-label="Back to sales" onClick={() => navigate('/app/retail-sales')} />
        <span className="pos-title-icon"><ShoppingCartOutlined /></span>
        <div className="pos-title"><h1>{isEditing ? `Edit ${existingSale.sale_number}` : 'New retail sale'}</h1><span>{isEditing ? 'Review the bill, then save the rebuilt sale' : 'Build the order, then collect payment'}</span></div>
        {!isEditing && <button type="button" className="pos-order-status pos-day-status" onClick={() => navigate('/app/day-register')}><span className="pos-status-dot" />Day open · {dayState.current.business_date}</button>}
        <Tag>{selectedCount} {selectedCount === 1 ? 'item' : 'items'}</Tag>
      </header>

      <div className="pos-layout">
        <main className="pos-main">
          <Card className="pos-customer-card">
            <div className="pos-customer-row">
              <div className="pos-section-label"><UserOutlined /><div><strong>Customer</strong><span>Optional for walk-ins</span></div></div>
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
            <div className="pos-items-toolbar"><div><strong>Order items</strong><span>{selectedCount ? `${selectedCount} item${selectedCount === 1 ? '' : 's'} in this sale` : 'Search and add items to begin'}</span></div><Space wrap><Button type="primary" icon={<PlusOutlined />} onClick={() => addItem('finished_good')}>Add product</Button>{tenantSettings.packaging_material_sales_enabled && <Button icon={<PlusOutlined />} onClick={() => addItem('packaging_material')}>Add packing material</Button>}</Space></div>
            <div className="pos-items-scroll">
              {items.map((item, index) => {
                const selected = selectedItemFor(item);
                const isPackaging = item.itemType === 'packaging_material';
                const isReadyMade = isPackaging || selected?.source_type === 'ready_made';
                const isMeasured = !isPackaging && Boolean(selected?.product?.sell_by_measurement);
                const matchingKits = isMeasured ? matchingKitsFor(item.qty) : [];
                const selectedKitId = isMeasured ? selectedKitIdFor(item) : null;
                const selectedKit = matchingKits.find(kit => kit.id === selectedKitId);
                const selectedKitQuantities = item.packingKitQuantities || {};
                const packages = selectedKit
                  ? (selectedKit.packingKitItems || []).map(row => `${Number(selectedKitQuantities[row.packaging_material_id] ?? row.quantity) * Number(item.packCount || 1)} ${row.packagingMaterial?.name || 'packaging'}`).join(' + ')
                  : !isPackaging && selected ? (selected.variantPackagings || []).map(row => `${Number(row.quantity) * item.qty} ${row.packagingMaterial?.name || 'packaging'}`).join(' + ') : '';
                const unit = isPackaging ? selected?.unit || 'pcs' : isMeasured ? selected.product.measurement_unit || 'ml' : selected?.uom || 'pcs';
                const lineQuantity = saleQuantity(item);
                const hasStock = selected && Number(selected.current_stock) >= lineQuantity;
                const projectedStock = selected ? Number(selected.current_stock || 0) - lineQuantity : 0;
                return <section className="pos-item" key={item.key}>
                  <div className="pos-item-head"><span className="pos-item-index">{index + 1}</span><strong>{selected ? (selected.product?.name || selected.name) : isPackaging ? `Packing material ${index + 1}` : `Product ${index + 1}`}</strong><Text type="secondary">{selected ? isPackaging ? `${selected.sku} · ${selected.unit || 'pcs'}` : isMeasured ? `Sold per ${unit}` : `${selected.size_label || selected.name} · ${selected.sku}` : 'Not selected'}</Text><Button type="text" danger size="small" icon={<DeleteOutlined />} disabled={items.length === 1} onClick={() => removeItem(item.key)} /></div>
                  <div className={`pos-item-grid${isMeasured ? ' is-measured' : ''}`}>
                    <label className="pos-field pos-product-field"><span>{isPackaging ? 'Packing material / SKU' : 'Product / SKU'}</span><Select showSearch optionFilterProp="label" optionLabelProp="title" placeholder={isPackaging ? 'Search packing material or SKU' : 'Search product name, code, or SKU'} loading={isPackaging ? packagingLoading : productsLoading} notFoundContent={<span className="pos-select-empty">{isPackaging ? packagingLoading ? 'Loading packing materials…' : 'No matching packing material or SKU' : productsLoading ? 'Loading products…' : 'No matching product, code, or SKU'}</span>} value={item.product} onChange={value => updateProduct(value, item.key)}>{isPackaging ? packingMaterialsForSale.map(material => <Option key={material.id} value={material.id} label={`${material.sku || ''} ${material.name}`} title={`${material.name} · ${material.sku || 'No SKU'}`}>{material.sku ? `${material.sku} · ` : ''}{material.name} · {quantityLabel(material.current_stock)} {material.unit || 'pcs'} in stock</Option>) : products.map(product => {
                      const productName = product.product?.name || product.name;
                      const productCode = product.product?.code || '';
                      const variantName = product.size_label || product.name;
                      const searchLabel = `${productCode} ${product.sku || ''} ${productName} ${variantName}`.trim();
                      const selectedLabel = product.product?.sell_by_measurement ? `${productName} · per ml` : `${productName} · ${variantName}`;
                      return <Option key={product.id} value={product.id} label={searchLabel} title={selectedLabel}>{product.product?.sell_by_measurement ? `${productName} · Sold per ml${productCode ? ` · ${productCode}` : ''}` : <>{product.sku ? `${product.sku} · ` : ''}{productName} · {variantName}{productCode ? ` · ${productCode}` : ''}</>}</Option>;
                    })}</Select></label>
                    <label className="pos-field"><span>{isMeasured ? `Fill per pack (${unit})` : `Quantity (${unit})`}</span><InputNumber min={isMeasured ? 0 : isPackaging ? 0.0001 : 1} step={isMeasured ? 1 : isPackaging ? 0.0001 : 1} precision={isMeasured ? 0 : isPackaging ? 4 : undefined} value={item.qty} onChange={value => { updateItem(isMeasured ? (value ?? 0) : (value || 1), 'qty', item.key); updateItem(null, 'packingKit', item.key); updateItem(null, 'packingKitQuantities', item.key); }} /></label>
                    {isMeasured && <label className="pos-field"><span>Number of packs</span><InputNumber min={1} precision={0} value={item.packCount} onChange={value => updateItem(value || 1, 'packCount', item.key)} /></label>}
                    {isMeasured && tenantSettings.measured_packaging_enabled && <label className="pos-field pos-packing-kit-field"><span>Packing kit</span><Space.Compact block><Select allowClear style={{ flex: 1, minWidth: 0 }} optionLabelProp="title" placeholder={matchingKits.length ? 'Select packing kit' : `No kit for ${item.qty} ml`} value={selectedKitId || undefined} onChange={value => selectPackingKit(value, item.key)} options={matchingKits.map(kit => ({ value: kit.id, title: kit.name, label: `${kit.name} · ${(kit.packingKitItems || []).map(row => `${row.packagingMaterial?.name || 'Material'} ×${Number(row.quantity)}`).join(' + ')}` }))} />{selectedKit && <Button className="pos-edit-kit-button" onClick={() => openPackingKitModal(selectedKit, item.key)}>Edit qty</Button>}</Space.Compact></label>}
                    <label className="pos-field"><span>{isMeasured ? `Price per ${unit}` : 'Unit price'}</span><InputNumber min={0} prefix="₹" value={item.price} onChange={value => updateItem(value || 0, 'price', item.key)} /></label>
                    <div className="pos-line-total"><span>Line total</span><strong>{money(item.price * lineQuantity)}</strong></div>
                  </div>
                  <div className="pos-item-bottom">
                    {selected && <Tag color={isReadyMade ? 'blue' : 'gold'}>{isPackaging ? 'Packing material · From stock' : isReadyMade ? 'Ready-made · From stock' : isMeasured ? selected.product.measurement_source_type === 'raw_material' ? 'Measured · Raw material' : selected.product.measurement_source_type === 'bulk_stock' ? 'Measured · Bulk stock' : showFormulaInSales ? 'Measured · Formula' : 'Measured · Automatic' : 'Make live · Automatic'}</Tag>}
                    {selected && <div className={`pos-stock-note ${isReadyMade || (isMeasured && selected.product.measurement_source_type === 'bulk_stock') ? hasStock ? 'success' : 'warning' : 'warning'}`}><InfoCircleOutlined />{isPackaging ? hasStock ? `${quantityLabel(selected.current_stock)} ${unit} in stock` : `Will become ${quantityLabel(projectedStock)} ${unit} in stock` : isReadyMade ? hasStock ? `${Number(selected.current_stock || 0)} in stock` : `Will become ${quantityLabel(projectedStock)} in stock` : isMeasured ? `${quantityLabel(lineQuantity)} ${unit} ${selected.product.measurement_source_type === 'raw_material' ? 'deducted from linked raw material' : selected.product.measurement_source_type === 'bulk_stock' ? `deducted from bulk perfume stock${hasStock ? '' : ` (will become ${quantityLabel(projectedStock)} ml)`}` : showFormulaInSales ? 'prepared from the linked formula' : 'prepared automatically'}${packages ? ` + ${packages}` : ''}` : `${Number(selected.fill_quantity_ml || 0) * item.qty} ml ${showFormulaInSales ? 'formula' : 'required'}${packages ? ` + ${packages}` : ''}`}</div>}
                  </div>
                </section>;
              })}
            </div>
          </Card>
        </main>

        <aside className="pos-checkout">
          <Card>
            <div className="pos-checkout-heading"><div><span className="pos-checkout-kicker">ORDER SUMMARY</span><strong>Checkout</strong></div><Tag>{selectedCount} {selectedCount === 1 ? 'item' : 'items'}</Tag></div>
            <div className="pos-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Discount</span><strong className={discountAmount ? 'negative' : ''}>− {money(discountAmount)}</strong></div>{tax > 0 && <div><span>Tax</span><strong>+ {money(tax)}</strong></div>}</div>
            <Divider />
            <label className="pos-discount-label">Order discount <span>Optional</span></label>
            <div className="pos-discount"><Radio.Group value={discountMode} onChange={event => { setDiscountMode(event.target.value); setDiscount(0); }} optionType="button" buttonStyle="solid" size="small"><Radio.Button value="percentage">%</Radio.Button><Radio.Button value="amount">₹</Radio.Button></Radio.Group><InputNumber min={0} max={discountMode === 'percentage' ? 100 : subtotal} value={discount} onChange={value => setDiscount(value || 0)} suffix={discountMode === 'percentage' ? '%' : undefined} prefix={discountMode === 'amount' ? '₹' : undefined} /></div>
            <div className="pos-total"><div><span>Total due</span><small>Taxes included where applicable</small></div><strong>{money(total)}</strong></div>
            <Form.Item label="Payment" required className="pos-payment">
              <PaymentSplitEditor paymentMethods={paymentMethods} total={total} value={paymentSplits} onChange={setPaymentSplits} cashTendered={cashTendered} onCashTenderedChange={setCashTendered} compact quick />
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} block className="pos-complete">{isEditing ? 'Save changes' : 'Complete sale'} · {money(total)}</Button>
            <Button type="text" size="small" block className="pos-cancel" onClick={() => navigate(isEditing ? `/app/retail-sales/${editId}` : '/app/retail-sales')}>{isEditing ? 'Cancel editing' : 'Cancel sale'}</Button>
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

    <Modal
      className="pos-kit-modal"
      title={packingKitModal?.kit?.name || 'Packing kit details'}
      open={Boolean(packingKitModal)}
      onCancel={() => setPackingKitModal(null)}
      footer={null}
      destroyOnHidden
    >
      {packingKitModal?.kit && (() => {
        const { kit, itemKey } = packingKitModal;
        const selectedSaleItem = items.find(item => item.key === itemKey);
        const kitItems = kit.packingKitItems || [];
        return <>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Fill quantity">{Number(kit.fill_quantity_ml ?? kit.minimum_fill_ml ?? kit.maximum_fill_ml)} ml</Descriptions.Item>
            <Descriptions.Item label="Priority">{Number(kit.priority || 0)}</Descriptions.Item>
            <Descriptions.Item label="Status"><Space>{kit.is_default && <Tag color="gold">Default</Tag>}<Tag color={kit.is_active !== false ? 'success' : 'default'}>{kit.is_active !== false ? 'Active' : 'Inactive'}</Tag></Space></Descriptions.Item>
          </Descriptions>
          <div className="pos-kit-section-heading">
            <div><strong>Materials in this kit</strong><span>Adjust the quantity used for each pack.</span></div>
            <Tag>{kitItems.length} {kitItems.length === 1 ? 'item' : 'items'}</Tag>
          </div>
          <div className="pos-kit-materials">
            {kitItems.map(row => <div className="pos-kit-material" key={row.id || row.packaging_material_id}>
              <div className="pos-kit-material-name"><strong>{row.packagingMaterial?.name || 'Packaging material'}</strong><span>Per pack · {row.packagingMaterial?.unit || 'pcs'}</span></div>
              <InputNumber className="pos-kit-quantity" min={0.0001} step={0.0001} value={Number(selectedSaleItem?.packingKitQuantities?.[row.packaging_material_id] ?? row.quantity)} onChange={value => updateItem({ ...(selectedSaleItem?.packingKitQuantities || Object.fromEntries(kitItems.map(item => [item.packaging_material_id, Number(item.quantity)]))), [row.packaging_material_id]: Number(value || row.quantity) }, 'packingKitQuantities', itemKey)} addonAfter={row.packagingMaterial?.unit || 'pcs'} />
            </div>)}
            {!kitItems.length && <Text type="secondary">No materials added to this kit.</Text>}
          </div>
          <div className="pos-kit-packs">
            <div><strong>Number of packs</strong><span>Applied to this sale item</span></div>
            <Space.Compact>
              <Button aria-label="Decrease number of packs" onClick={() => updateItem(Math.max(1, Number(selectedSaleItem?.packCount || 1) - 1), 'packCount', itemKey)}>−</Button>
              <InputNumber aria-label="Number of packs" min={1} precision={0} controls={false} value={selectedSaleItem?.packCount || 1} onChange={value => updateItem(Math.max(1, Number(value || 1)), 'packCount', itemKey)} />
              <Button aria-label="Increase number of packs" onClick={() => updateItem(Number(selectedSaleItem?.packCount || 1) + 1, 'packCount', itemKey)}>+</Button>
            </Space.Compact>
          </div>
        </>;
      })()}
    </Modal>

    <Modal
      className="pos-confirm-modal"
      title={<Space><CheckCircleOutlined />Confirm sale</Space>}
      open={confirmationOpen}
      width={720}
      centered
      destroyOnHidden
      confirmLoading={submitting}
      okText={`Confirm sale & print · ${money(total)}`}
      cancelText="Review sale"
      onOk={confirmSale}
      onCancel={() => !submitting && setConfirmationOpen(false)}
      maskClosable={!submitting}
      keyboard={!submitting}
    >
      <div className="pos-confirm-customer">
        <span className="pos-confirm-icon"><UserOutlined /></span>
        <div><small>CUSTOMER</small><strong>{selectedCustomer?.name || 'Walk-in customer'}</strong><span>{selectedCustomer?.phone || 'No phone number'}</span></div>
        <Tag color="success">Ready</Tag>
      </div>

      <section className="pos-confirm-section">
        <div className="pos-confirm-heading"><strong>Items</strong><span>{saleItems.length} item{saleItems.length === 1 ? '' : 's'}</span></div>
        <div className="pos-confirm-items">
          {saleLineTotals.map(({ item, total: lineTotal }, index) => {
            const product = selectedItemFor(item);
            const isPackaging = item.itemType === 'packaging_material';
            const isReadyMade = isPackaging || product?.source_type === 'ready_made';
            const isMeasured = !isPackaging && Boolean(product?.product?.sell_by_measurement);
            return <div className="pos-confirm-item" key={item.key}>
              <span className="pos-confirm-number">{index + 1}</span>
              <div><strong>{product?.product?.name || product?.name || (isPackaging ? 'Packing material' : 'Product')}</strong><span>{isMeasured ? `${quantityLabel(item.qty)} ${product.product.measurement_unit || 'ml'} × ${Number(item.packCount || 1)} pack${Number(item.packCount || 1) === 1 ? '' : 's'} = ${quantityLabel(saleQuantity(item))} ml` : `${product?.size_label || product?.sku || (isPackaging ? product?.unit || 'Material' : 'Variant')} · ${quantityLabel(item.qty)}`} × {money(item.price)}</span>{isMeasured && tenantSettings.measured_packaging_enabled && <span>{packingKits.find(kit => kit.id === selectedKitIdFor(item))?.name || 'No packing kit selected'}</span>}</div>
              <Tag color={isReadyMade ? 'blue' : 'gold'}>{isPackaging ? 'Packing stock' : isReadyMade ? 'Stock' : 'Make live'}</Tag>
              <strong>{money(lineTotal)}</strong>
            </div>;
          })}
        </div>
      </section>

      <div className="pos-confirm-bottom">
        <section className="pos-confirm-section">
          <div className="pos-confirm-heading"><strong><CreditCardOutlined /> Payment</strong><span>{validPayments.length} method{validPayments.length === 1 ? '' : 's'}</span></div>
          <div className="pos-confirm-payments">
            {validPayments.map(payment => <div key={payment.payment_method_id}><span>{paymentMethods.find(method => method.id === payment.payment_method_id)?.name || 'Payment'}</span><strong>{money(payment.amount)}</strong></div>)}
            {cashPaymentAmount > 0 && <><div className="pos-confirm-cash-received"><span>Cash received</span><strong>{money(cashTendered)}</strong></div><div className="pos-confirm-change"><span>Change to customer</span><strong>{money(changeAmount)}</strong></div></>}
          </div>
        </section>

        <section className="pos-confirm-totals">
          <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <div><span>Discount</span><strong>− {money(discountAmount)}</strong></div>
          {tax > 0 && <div><span>Tax</span><strong>+ {money(tax)}</strong></div>}
          <div className="pos-confirm-grand"><span>Total</span><strong>{money(total)}</strong></div>
        </section>
      </div>

      <div className="pos-confirm-print-note"><PrinterOutlined /><span>After confirmation, stock and accounts will update and the invoice will print automatically.</span></div>
    </Modal>
  </div>;
}
