import React, { useEffect, useState } from 'react';
import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Statistic, Table, Tag, message } from 'antd';
import { AppstoreAddOutlined, CloseOutlined, DeleteOutlined, EditOutlined, FileTextOutlined, InfoCircleOutlined, PlusOutlined, SaveOutlined, SendOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import PageDrawerControls from '../../components/common/PageDrawerControls';
import ResponsiveDataTable from '../../components/common/ResponsiveDataTable';
import PaymentSplitEditor from '../../components/common/PaymentSplitEditor';
import SingleTagSelect from '../../components/common/SingleTagSelect';
import './Purchases.css';
const { TextArea } = Input;
const blankItem = () => ({ key: Date.now(), materialType: 'raw', materialId: null, quantity: 1, unitPrice: 0, taxRate: 18 });
const defaultPackagingCategories = ['Bottles', 'Caps', 'Sprays', 'Labels', 'Boxes', 'Wrapping', 'Inserts'];
const packagingDatabaseType = (category) => ({ Bottles: 'bottle', Caps: 'cap', Sprays: 'spray', Labels: 'label', Boxes: 'box' }[category] || 'other');
const formatMoney = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const purchaseTypeOptions = [
  { value: 'raw', label: 'Raw material' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'finished', label: 'Ready-made product' }
];

export default function Purchases() {
  const [form] = Form.useForm();
  const { data: purchases, loading, reload } = useApiData('/purchases');
  const { data: suppliers, reload: reloadSuppliers } = useApiData('/suppliers');
  const { data: rawMaterials, reload: reloadRawMaterials } = useApiData('/raw-materials');
  const { data: packagingMaterials, reload: reloadPackagingMaterials } = useApiData('/packaging-materials');
  const { data: products, reload: reloadProducts } = useApiData('/products');
  const { data: finishedGoods, reload: reloadFinishedGoods } = useApiData('/finished-goods');
  const { data: paymentMethods } = useApiData('/accounts/payment-methods');
  const [creating, setCreating] = useState(false), [saving, setSaving] = useState(false), [items, setItems] = useState([blankItem()]);
  const [editingId, setEditingId] = useState(null);
  const [postingId, setPostingId] = useState(null);
  const [paymentSplits, setPaymentSplits] = useState([]);
  const [quickMaterialForm] = Form.useForm();
  const [quickMaterial, setQuickMaterial] = useState(null);
  const [savingQuickMaterial, setSavingQuickMaterial] = useState(false);
  const [quickSupplierForm] = Form.useForm();
  const [quickSupplier, setQuickSupplier] = useState(null);
  const [savingQuickSupplier, setSavingQuickSupplier] = useState(false);
  const [quickFinishedForm] = Form.useForm();
  const [quickFinished, setQuickFinished] = useState(null);
  const [savingQuickFinished, setSavingQuickFinished] = useState(false);
  const quickFinishedMode = Form.useWatch('productMode', quickFinishedForm) || 'new';
  const rawMaterialCategories = [...new Set(rawMaterials.map(material => material.category?.trim()).filter(Boolean))].sort();
  useEffect(() => {
    if (!quickMaterial) return;
    quickMaterialForm.resetFields();
    quickMaterialForm.setFieldsValue({
      unit: quickMaterial.type === 'raw' ? 'kg' : 'pcs',
      category: quickMaterial.type === 'raw' ? ['General'] : undefined,
    });
  }, [quickMaterial, quickMaterialForm]);
  const materialOptions = type => {
    if (type === 'raw') return rawMaterials.map(item => ({ ...item, price: Number(item.last_cost || item.avg_cost || 0) }));
    if (type === 'packaging') return packagingMaterials.map(item => ({ ...item, price: Number(item.avg_cost || 0) }));
    return finishedGoods
      .filter(item => item.source_type === 'ready_made' && item.is_active !== false)
      .map(item => ({ ...item, price: Number(item.cost_price || 0), purchaseLabel: `${item.product?.name || item.name} · ${item.size_label || item.name}${item.sku ? ` · ${item.sku}` : ''}` }));
  };
  const packagingCategories = [...new Set([...defaultPackagingCategories, ...packagingMaterials.map(material => material.category).filter(Boolean)])].sort();
  const update = (key, field, value) => setItems(all => all.map(item => { if (item.key !== key) return item; const next = { ...item, [field]: value }; if (field === 'materialType') { next.materialId = null; next.unitPrice = 0; } if (field === 'materialId') next.unitPrice = materialOptions(next.materialType).find(x => x.id === value)?.price ?? 0; return next; }));
  const subtotal = items.reduce((sum, x) => sum + Number(x.quantity || 0) * Number(x.unitPrice || 0), 0);
  const tax = items.reduce((sum, x) => sum + Number(x.quantity || 0) * Number(x.unitPrice || 0) * Number(x.taxRate || 0) / 100, 0);
  const reset = () => { form.resetFields(); setItems([blankItem()]); setPaymentSplits([]); setEditingId(null); setCreating(false); };
  const openNewPurchase = () => {
    form.resetFields();
    form.setFieldsValue({ invoiceDate: dayjs(), paidImmediately: 'no' });
    setItems([blankItem()]);
    setPaymentSplits([]);
    setEditingId(null);
    setCreating(true);
  };
  const selectSupplier = supplierId => {
    form.setFieldValue('supplierId', supplierId);
    void form.validateFields(['supplierId']).catch(() => undefined);
  };
  const openQuickSupplier = (selectAfterCreate = false) => {
    quickSupplierForm.resetFields();
    quickSupplierForm.setFieldsValue({ paymentTerms: 30 });
    setQuickSupplier({ selectAfterCreate });
  };
  const saveQuickSupplier = async () => {
    try {
      const values = await quickSupplierForm.validateFields();
      setSavingQuickSupplier(true);
      const { data: created } = await client.post('/suppliers', {
        name: values.name.trim(),
        contact_person: values.contactPerson?.trim() || null,
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        payment_terms: Number(values.paymentTerms || 0),
        credit_limit: 0,
        is_active: true,
      });
      await reloadSuppliers();
      if (quickSupplier.selectAfterCreate) selectSupplier(created.id);
      message.success(`Supplier created${quickSupplier.selectAfterCreate ? ' and selected' : ''}.`);
      setQuickSupplier(null);
      quickSupplierForm.resetFields();
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.response?.data?.message || 'Could not create the supplier.');
    } finally { setSavingQuickSupplier(false); }
  };
  const openQuickMaterial = (item) => {
    setQuickMaterial({ lineKey: item.key, type: item.materialType });
  };
  const saveQuickMaterial = async () => {
    try {
      const values = await quickMaterialForm.validateFields();
      setSavingQuickMaterial(true);
      const payload = {
        name: values.name,
        unit: values.unit,
        current_stock: 0,
        reorder_level: 0,
        avg_cost: Number(values.unitPrice || 0),
      };
      const endpoint = quickMaterial.type === 'raw' ? '/raw-materials' : '/packaging-materials';
      if (quickMaterial.type === 'raw') payload.category = Array.isArray(values.category) ? values.category[0] : values.category;
      else {
        payload.category = Array.isArray(values.category) ? values.category[0] : values.category;
        payload.type = packagingDatabaseType(payload.category);
      }
      const { data: created } = await client.post(endpoint, payload);
      if (quickMaterial.type === 'raw') await reloadRawMaterials();
      else await reloadPackagingMaterials();
      update(quickMaterial.lineKey, 'materialId', created.id);
      update(quickMaterial.lineKey, 'unitPrice', Number(values.unitPrice || 0));
      message.success(`${quickMaterial.type === 'raw' ? 'Raw material' : 'Packaging material'} created and selected.`);
      setQuickMaterial(null);
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.response?.data?.message || 'Could not create the material.');
    } finally { setSavingQuickMaterial(false); }
  };
  const openQuickFinished = (item) => {
    quickFinishedForm.resetFields();
    quickFinishedForm.setFieldsValue({
      productMode: 'new',
      variantLabel: 'Standard',
      unitPrice: Number(item.unitPrice || 0),
      sellingPrice: 0,
      reorderLevel: 0,
    });
    setQuickFinished({ lineKey: item.key });
  };
  const openQuickFinishedForPurchase = () => {
    const availableLine = items.find(item => !item.materialId);
    if (availableLine) {
      setItems(all => all.map(item => item.key === availableLine.key
        ? { ...item, materialType: 'finished', materialId: null }
        : item));
      openQuickFinished({ ...availableLine, materialType: 'finished' });
      return;
    }
    const newLine = { ...blankItem(), materialType: 'finished' };
    setItems(all => [...all, newLine]);
    openQuickFinished(newLine);
  };
  const saveQuickFinished = async () => {
    try {
      const values = await quickFinishedForm.validateFields();
      setSavingQuickFinished(true);
      const { data: created } = await client.post('/finished-goods/ready-made', {
        product_id: values.productMode === 'existing' ? values.productId : null,
        product_name: values.productMode === 'new' ? values.productName?.trim() : null,
        product_code: values.productMode === 'new' ? values.productCode?.trim() || null : null,
        size_label: values.variantLabel.trim(),
        sku: values.sku?.trim() || null,
        name: values.displayName?.trim() || null,
        cost_price: Number(values.unitPrice || 0),
        selling_price: Number(values.sellingPrice || 0),
        reorder_level: Number(values.reorderLevel || 0),
      });
      await Promise.all([reloadProducts(), reloadFinishedGoods()]);
      setItems(all => all.map(item => item.key === quickFinished.lineKey
        ? { ...item, materialType: 'finished', materialId: created.id, unitPrice: Number(values.unitPrice || 0) }
        : item));
      message.success(values.productMode === 'existing'
        ? 'Variant created and selected.'
        : 'Product and first variant created and selected.');
      setQuickFinished(null);
      quickFinishedForm.resetFields();
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.response?.data?.message || 'Could not create the ready-made product.');
    } finally { setSavingQuickFinished(false); }
  };
  const draftPayload = (values, validPayments) => ({
    supplier_id: values.supplierId,
    invoice_date: values.invoiceDate.format('YYYY-MM-DD'),
    due_date: values.paidImmediately === 'yes' ? undefined : values.dueDate?.format('YYYY-MM-DD'),
    notes: values.notes,
    paid_immediately: values.paidImmediately === 'yes',
    payments: values.paidImmediately === 'yes' ? validPayments.map(row => ({ payment_method_id: row.payment_method_id, amount: row.amount })) : undefined,
    items: items.map(item => ({ material_type: item.materialType, material_id: item.materialId, quantity: item.quantity, unit_price: item.unitPrice, tax_rate: item.taxRate }))
  });
  const submit = async values => {
    const valid = items.filter(x => x.materialId && x.quantity > 0);
    if (valid.length !== items.length) return message.error('Select an item and quantity for every purchase line.');
    const validPayments = paymentSplits.filter(row => row.payment_method_id && Number(row.amount) > 0);
    if (values.paidImmediately === 'yes') {
      const paidCents = validPayments.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
      if (!validPayments.length) return message.error('Select at least one payment method.');
      if (paidCents !== Math.round((subtotal + tax) * 100)) return message.error('Split payments must equal the purchase total.');
    }
    setSaving(true);
    try {
      const payload = draftPayload(values, validPayments);
      if (editingId) await client.put(`/purchases/${editingId}`, payload);
      else await client.post('/purchases', payload);
      message.success(editingId ? 'Purchase draft updated.' : 'Purchase saved as draft.');
      reset();
      await reload();
    }
    catch (error) { message.error(error.response?.data?.message || 'Could not save the purchase.'); } finally { setSaving(false); }
  };
  const editDraft = purchase => {
    if (purchase.status !== 'draft') return;
    const draftItems = purchase.purchaseReceipt?.purchaseReceiptItems || [];
    form.setFieldsValue({
      supplierId: purchase.supplier_id,
      invoiceDate: purchase.invoice_date ? dayjs(purchase.invoice_date) : dayjs(),
      dueDate: purchase.due_date ? dayjs(purchase.due_date) : undefined,
      paidImmediately: purchase.paid_immediately ? 'yes' : 'no',
      notes: purchase.purchaseReceipt?.notes || undefined
    });
    setItems(draftItems.length ? draftItems.map((item, index) => ({
      key: item.id || `${purchase.id}-${index}`,
      materialType: item.material_type,
      materialId: item.material_id,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price || 0),
      taxRate: Number(item.tax_rate || 0)
    })) : [blankItem()]);
    setPaymentSplits(Array.isArray(purchase.payment_splits) ? purchase.payment_splits : []);
    setEditingId(purchase.id);
    setCreating(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const postDraft = async purchase => {
    setPostingId(purchase.id);
    try {
      await client.post(`/purchases/${purchase.id}/post`);
      if (editingId === purchase.id) reset();
      message.success('Purchase posted. Inventory and accounts are now updated.');
      await Promise.all([reload(), reloadRawMaterials(), reloadPackagingMaterials(), reloadFinishedGoods()]);
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not post the purchase.');
    } finally { setPostingId(null); }
  };
  const itemColumns = [
    { title: 'Type', width: 154, render: (_, item) => <Select aria-label="Purchase item type" value={item.materialType} onChange={value => update(item.key, 'materialType', value)} options={purchaseTypeOptions} /> },
    { title: 'Item', width: 274, render: (_, item) => <Space.Compact className="purchase-material-picker"><Select aria-label="Purchase item" showSearch optionFilterProp="label" value={item.materialId} onChange={value => update(item.key, 'materialId', value)} placeholder={item.materialType === 'finished' ? 'Choose a ready-made variant' : 'Choose a material'} options={materialOptions(item.materialType).map(material => ({ value: material.id, label: material.purchaseLabel || material.name }))} /><Button icon={<PlusOutlined />} title={item.materialType === 'finished' ? 'Create ready-made product or variant' : `Create ${item.materialType === 'raw' ? 'raw material' : 'packaging material'}`} aria-label={item.materialType === 'finished' ? 'Create ready-made product or variant' : `Create ${item.materialType === 'raw' ? 'raw material' : 'packaging material'}`} onClick={() => item.materialType === 'finished' ? openQuickFinished(item) : openQuickMaterial(item)} /></Space.Compact> },
    { title: 'Quantity', width: 104, render: (_, item) => <InputNumber aria-label="Quantity" min={0.01} precision={2} value={item.quantity} onChange={value => update(item.key, 'quantity', value)} /> },
    { title: 'Unit price', width: 126, render: (_, item) => <InputNumber aria-label="Unit price" min={0} precision={2} prefix="₹" value={item.unitPrice} onChange={value => update(item.key, 'unitPrice', value)} /> },
    { title: 'GST', width: 86, render: (_, item) => <Select aria-label="GST rate" value={item.taxRate} onChange={value => update(item.key, 'taxRate', value)} options={[0, 5, 12, 18, 28].map(value => ({ value, label: `${value}%` }))} /> },
    { title: 'Line total', width: 128, align: 'right', render: (_, item) => <strong className="purchase-line-total">{formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0) * (1 + Number(item.taxRate || 0) / 100))}</strong> },
    { title: '', width: 48, align: 'center', render: (_, item) => <Button type="text" danger icon={<DeleteOutlined />} title="Remove line item" aria-label="Remove line item" disabled={items.length === 1} onClick={() => setItems(all => all.filter(existing => existing.key !== item.key))} /> }
  ];
  const statusTag = status => <Tag color={status === 'paid' ? 'success' : status === 'draft' ? 'default' : 'warning'}>{(status || 'unpaid').toUpperCase()}</Tag>;
  const draftActions = purchase => purchase.status === 'draft' ? <Space size="small">
    <Button size="small" icon={<EditOutlined />} onClick={() => editDraft(purchase)}>Edit</Button>
    <Popconfirm title="Post this purchase?" description="This updates inventory and accounts. The purchase cannot be edited afterward." okText="Post purchase" onConfirm={() => postDraft(purchase)}>
      <Button size="small" type="primary" icon={<SendOutlined />} loading={postingId === purchase.id}>Post</Button>
    </Popconfirm>
  </Space> : null;
  const columns = [{ title: 'Invoice #', dataIndex: 'invoice_number' }, { title: 'Supplier', render: (_, purchase) => purchase.supplier?.name || '—' }, { title: 'Date', dataIndex: 'invoice_date', render: value => value ? dayjs(value).format('DD MMM YYYY') : '—' }, { title: 'Amount', dataIndex: 'total_amount', align: 'right', render: value => formatMoney(value) }, { title: 'Status', dataIndex: 'status', render: statusTag }, { title: 'Actions', width: 170, render: (_, purchase) => draftActions(purchase) }];

  const mobileItemFields = item => <>
    <div className="purchase-mobile-item__field purchase-mobile-item__field--wide">
      <label>Item</label>
      <Space.Compact className="purchase-material-picker"><Select aria-label="Purchase item" showSearch optionFilterProp="label" value={item.materialId} onChange={value => update(item.key, 'materialId', value)} placeholder={item.materialType === 'finished' ? 'Choose a ready-made variant' : 'Choose a material'} options={materialOptions(item.materialType).map(material => ({ value: material.id, label: material.purchaseLabel || material.name }))} /><Button icon={<PlusOutlined />} aria-label={item.materialType === 'finished' ? 'Create ready-made product or variant' : 'Create material'} onClick={() => item.materialType === 'finished' ? openQuickFinished(item) : openQuickMaterial(item)} /></Space.Compact>
    </div>
    <div className="purchase-mobile-item__field"><label>Quantity</label><InputNumber aria-label="Quantity" min={0.01} precision={2} value={item.quantity} onChange={value => update(item.key, 'quantity', value)} /></div>
    <div className="purchase-mobile-item__field"><label>Unit price</label><InputNumber aria-label="Unit price" min={0} precision={2} prefix="₹" value={item.unitPrice} onChange={value => update(item.key, 'unitPrice', value)} /></div>
    <div className="purchase-mobile-item__field"><label>GST</label><Select aria-label="GST rate" value={item.taxRate} onChange={value => update(item.key, 'taxRate', value)} options={[0, 5, 12, 18, 28].map(value => ({ value, label: `${value}%` }))} /></div>
  </>;

  return <div className="purchases-page">
    <div className="purchases-page__header">
      <div><span className="purchases-page__eyebrow">Procurement</span><h1>Purchases</h1><p>Record supplier invoices and keep inventory costs up to date.</p></div>
      <Space className="purchases-page__actions"><PageDrawerControls title="Purchases" summary={<Statistic title="Total value" value={purchases.reduce((sum, purchase) => sum + Number(purchase.total_amount || 0), 0)} prefix="₹" />} /><Button className="purchase-form-toggle" type={creating ? 'default' : 'primary'} icon={creating ? <CloseOutlined /> : <PlusOutlined />} onClick={creating ? reset : openNewPurchase}>{creating ? 'Close form' : 'Record purchase'}</Button></Space>
    </div>

    {creating && <Form className="purchase-form" form={form} layout="vertical" onFinish={submit} initialValues={{ invoiceDate: dayjs(), paidImmediately: 'no' }}>
      <Card className="purchase-entry-card">
        <div className="purchase-entry-card__header">
          <div className="purchase-section-icon"><FileTextOutlined /></div>
          <div><div className="purchase-entry-card__title-row"><h2>{editingId ? 'Edit purchase draft' : 'New supplier invoice'}</h2><Tag className="purchase-draft-tag">DRAFT</Tag></div><p>Add the invoice details, then enter materials or ready-made products purchased.</p></div>
        </div>

        <section className="purchase-form-section" aria-labelledby="purchase-details-title">
          <div className="purchase-form-section__heading"><div><span>01</span><h3 id="purchase-details-title">Invoice details</h3></div><p>Fields marked with an asterisk are required.</p></div>
          <Row gutter={[20, 0]}>
            <Col xs={24} md={12} xl={8}>
              <Form.Item label="Supplier" required>
                <Space.Compact className="purchase-material-picker">
                  <Form.Item name="supplierId" noStyle rules={[{ required: true, message: 'Select a supplier' }]}>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Choose a supplier"
                      onChange={selectSupplier}
                      options={suppliers.filter(supplier => supplier.is_active !== false).map(supplier => ({ value: supplier.id, label: supplier.name }))}
                    />
                  </Form.Item>
                  <Button icon={<PlusOutlined />} title="Quick create supplier" aria-label="Quick create supplier" onClick={() => openQuickSupplier(true)} />
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6} xl={5}><Form.Item name="invoiceDate" label="Invoice date" rules={[{ required: true, message: 'Select an invoice date' }]}><DatePicker format="DD MMM YYYY" /></Form.Item></Col>
            <Col xs={24} sm={12} md={6} xl={5}><Form.Item name="paidImmediately" label="Payment status"><Segmented block onChange={value => { if (value === 'yes') form.setFieldValue('dueDate', undefined); }} options={[{ value: 'no', label: 'Pay later' }, { value: 'yes', label: 'Paid now' }]} /></Form.Item></Col>
            <Form.Item noStyle shouldUpdate={(previous, current) => previous.paidImmediately !== current.paidImmediately}>{({ getFieldValue }) => getFieldValue('paidImmediately') === 'yes'
              ? <Col xs={24} md={18} xl={12}><Form.Item label="Payment allocation" required><PaymentSplitEditor paymentMethods={paymentMethods} total={subtotal + tax} value={paymentSplits} onChange={setPaymentSplits} /></Form.Item></Col>
              : <Col xs={24} sm={12} md={6} xl={6}><Form.Item name="dueDate" label="Due date" extra="Optional"><DatePicker format="DD MMM YYYY" /></Form.Item></Col>}
            </Form.Item>
          </Row>
          <Form.Item name="notes" label={<span>Notes <em>Optional</em></span>} className="purchase-notes-field"><TextArea autoSize={{ minRows: 2, maxRows: 5 }} placeholder="Add an invoice number, delivery note, or internal comment…" maxLength={500} showCount /></Form.Item>
        </section>

        <section className="purchase-form-section purchase-form-section--items" aria-labelledby="purchase-items-title">
          <div className="purchase-form-section__heading"><div><span>02</span><h3 id="purchase-items-title">Purchase items</h3><Tag>{items.length} {items.length === 1 ? 'item' : 'items'}</Tag></div><p>Prices are prefilled from the latest recorded cost when available.</p></div>
          <div className="purchase-items-table"><Table rowKey="key" dataSource={items} columns={itemColumns} pagination={false} scroll={{ x: 894 }} tableLayout="fixed" /></div>
          <div className="purchase-mobile-items">{items.map((item, index) => <div className="purchase-mobile-item" key={item.key}>
            <div className="purchase-mobile-item__header"><strong>Item {index + 1}</strong><Space><Select aria-label="Purchase item type" value={item.materialType} onChange={value => update(item.key, 'materialType', value)} options={purchaseTypeOptions} /><Button type="text" danger icon={<DeleteOutlined />} aria-label="Remove line item" disabled={items.length === 1} onClick={() => setItems(all => all.filter(existing => existing.key !== item.key))} /></Space></div>
            <div className="purchase-mobile-item__grid">{mobileItemFields(item)}</div>
            <div className="purchase-mobile-item__total"><span>Line total</span><strong>{formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0) * (1 + Number(item.taxRate || 0) / 100))}</strong></div>
          </div>)}</div>
          <Space className="purchase-item-actions" wrap>
            <Button className="purchase-add-item" type="dashed" icon={<PlusOutlined />} onClick={() => setItems(all => [...all, blankItem()])}>Add another item</Button>
            <Button className="purchase-quick-product" icon={<AppstoreAddOutlined />} onClick={openQuickFinishedForPurchase}>Quick product / variant</Button>
          </Space>
        </section>

        <div className="purchase-checkout">
          <div className="purchase-checkout__note"><InfoCircleOutlined /><span><strong>Saved safely as a draft</strong>Inventory and accounting are updated only when you post the purchase from the history below.</span></div>
          <div className="purchase-checkout__summary"><div><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div><div><span>GST</span><span>{formatMoney(tax)}</span></div><div className="purchase-checkout__total"><span>Grand total</span><strong>{formatMoney(subtotal + tax)}</strong></div></div>
          <div className="purchase-checkout__actions"><Button size="large" onClick={reset}>Cancel</Button><Button size="large" type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>{editingId ? 'Update draft' : 'Save draft'}</Button></div>
        </div>
      </Card>
    </Form>}

    <Card className="purchase-history-card" title={<div className="purchase-history-card__title"><ShoppingCartOutlined /><span>Purchase history</span></div>} extra={<Button icon={<PlusOutlined />} onClick={() => openQuickSupplier(false)}>Add supplier</Button>}>
      <ResponsiveDataTable rowKey="id" columns={columns} dataSource={purchases} loading={loading} emptyText="No purchases found" mobileRenderItem={purchase => <>
        <div className="mobile-data-list__title-row"><strong>{purchase.invoice_number || 'Purchase'}</strong>{statusTag(purchase.status)}</div>
        <span className="mobile-data-list__code">{purchase.supplier?.name || '—'} · {purchase.invoice_date ? dayjs(purchase.invoice_date).format('DD MMM YYYY') : '—'}</span>
        <div className="mobile-data-list__metrics"><span>Amount <strong>{formatMoney(purchase.total_amount)}</strong></span></div>
        {purchase.status === 'draft' && <div style={{ marginTop: 12 }}>{draftActions(purchase)}</div>}
      </>} />
    </Card>
    <Modal
      title="Quick Create Supplier"
      open={Boolean(quickSupplier)}
      onCancel={() => { setQuickSupplier(null); quickSupplierForm.resetFields(); }}
      onOk={saveQuickSupplier}
      confirmLoading={savingQuickSupplier}
      okText={quickSupplier?.selectAfterCreate ? 'Create & Select' : 'Create Supplier'}
      destroyOnHidden
    >
      <Form form={quickSupplierForm} layout="vertical">
        <Form.Item name="name" label="Company name" rules={[{ required: true, whitespace: true, message: 'Enter a company name' }]}>
          <Input autoFocus placeholder="e.g. Fragrance World" />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="contactPerson" label="Contact person"><Input placeholder="Contact name" /></Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="phone" label="Phone"><Input placeholder="Phone number" /></Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={14}>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email address' }]}><Input placeholder="supplier@example.com" /></Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item name="paymentTerms" label="Payment terms (days)" rules={[{ required: true }]}><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
    <Modal
      title={quickFinishedMode === 'existing' ? 'Quick Create Variant' : 'Quick Create Product & Variant'}
      open={Boolean(quickFinished)}
      onCancel={() => { setQuickFinished(null); quickFinishedForm.resetFields(); }}
      onOk={saveQuickFinished}
      confirmLoading={savingQuickFinished}
      okText="Create & Select"
      width={620}
      destroyOnHidden
    >
      <Form form={quickFinishedForm} layout="vertical">
        <Form.Item name="productMode" label="Product" rules={[{ required: true }]}>
          <Segmented block options={[{ value: 'new', label: 'New product + variant' }, { value: 'existing', label: 'New variant for existing product' }]} />
        </Form.Item>
        {quickFinishedMode === 'new' ? (
          <Row gutter={12}>
            <Col xs={24} sm={16}>
              <Form.Item name="productName" label="Product name" rules={[{ required: true, whitespace: true, message: 'Enter a product name' }]}>
                <Input autoFocus placeholder="e.g. Imported White Oud" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="productCode" label="Product code" extra="Auto-generated if blank">
                <Input placeholder="IWO" />
              </Form.Item>
            </Col>
          </Row>
        ) : (
          <Form.Item name="productId" label="Existing product" rules={[{ required: true, message: 'Select a product' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Choose a product"
              options={products.filter(product => product.is_active !== false).map(product => ({
                value: product.id,
                label: `${product.name}${product.code ? ` · ${product.code}` : ''}`
              }))}
            />
          </Form.Item>
        )}
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="variantLabel" label="Variant label" rules={[{ required: true, whitespace: true, message: 'Enter a variant label' }]}>
              <Input placeholder="e.g. 100ml, Black, Standard" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="sku" label="SKU" extra="Auto-generated if blank">
              <Input placeholder="IWO-100" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="displayName" label="Display name" extra="Optional; defaults to product name + variant label">
          <Input placeholder="e.g. Imported White Oud 100ml" />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={8}>
            <Form.Item name="unitPrice" label="Purchase cost" rules={[{ required: true, message: 'Enter the purchase cost' }]}>
              <InputNumber min={0} precision={2} prefix="₹" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="sellingPrice" label="Selling price" rules={[{ required: true, message: 'Enter the selling price' }]}>
              <InputNumber min={0} precision={2} prefix="₹" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="reorderLevel" label="Reorder level">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <p style={{ marginBottom: 0, color: 'var(--color-text-secondary)' }}>The variant starts with zero stock. Saving this supplier invoice receives the purchased quantity into finished stock.</p>
      </Form>
    </Modal>
    <Modal
      title={quickMaterial?.type === 'raw' ? 'Quick Create Raw Material' : 'Quick Create Packaging Material'}
      open={Boolean(quickMaterial)}
      onCancel={() => setQuickMaterial(null)}
      onOk={saveQuickMaterial}
      confirmLoading={savingQuickMaterial}
      okText="Create & Select"
      destroyOnHidden
    >
      <Form form={quickMaterialForm} layout="vertical">
        <Form.Item name="name" label="Material name" rules={[{ required: true, message: 'Enter a material name' }]}><Input autoFocus placeholder={quickMaterial?.type === 'raw' ? 'e.g. Jasmine Absolute' : 'e.g. 100ml clear bottle'} /></Form.Item>
        <Row gutter={12}>
          {quickMaterial?.type === 'raw' ? <Col span={12}><Form.Item name="category" label="Category" rules={[{ required: true, message: 'Select or enter a category' }]}><SingleTagSelect showSearch optionFilterProp="label" placeholder="Select or type a category" options={rawMaterialCategories.map(category => ({ value: category, label: category }))} /></Form.Item></Col> : <Col span={24}><Form.Item name="category" label="Package Type" rules={[{ required: true, message: 'Select or enter a package type' }]}><SingleTagSelect placeholder="Select or type a package type" options={packagingCategories.map(category => ({ value: category, label: category }))} /></Form.Item></Col>}
          <Col span={12}><Form.Item name="unit" label="Unit" rules={[{ required: true }]}><Select options={['kg', 'g', 'L', 'ml', 'pcs', 'set'].map(value => ({ value, label: value }))} /></Form.Item></Col>
        </Row>
        <Form.Item name="unitPrice" label="Expected unit price" initialValue={0} rules={[{ required: true }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item>
      </Form>
    </Modal>
  </div>;
}
