import React, { useState } from 'react';
import { Button, Card, Col, DatePicker, Divider, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tag, message } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import PageDrawerControls from '../../components/common/PageDrawerControls';
import ResponsiveDataTable from '../../components/common/ResponsiveDataTable';
import './Purchases.css';
const { TextArea } = Input;
const blankItem = () => ({ key: Date.now(), materialType: 'raw', materialId: null, quantity: 1, unitPrice: 0, taxRate: 18 });
const defaultPackagingCategories = ['Bottles', 'Caps', 'Sprays', 'Labels', 'Boxes', 'Wrapping', 'Inserts'];
const packagingDatabaseType = (category) => ({ Bottles: 'bottle', Caps: 'cap', Sprays: 'spray', Labels: 'label', Boxes: 'box' }[category] || 'other');

export default function Purchases() {
  const [form] = Form.useForm();
  const { data: purchases, loading, reload } = useApiData('/purchases');
  const { data: suppliers } = useApiData('/suppliers');
  const { data: rawMaterials, reload: reloadRawMaterials } = useApiData('/raw-materials');
  const { data: packagingMaterials, reload: reloadPackagingMaterials } = useApiData('/packaging-materials');
  const { data: paymentMethods } = useApiData('/accounts/payment-methods');
  const [creating, setCreating] = useState(false), [saving, setSaving] = useState(false), [items, setItems] = useState([blankItem()]);
  const [quickMaterialForm] = Form.useForm();
  const [quickMaterial, setQuickMaterial] = useState(null);
  const [savingQuickMaterial, setSavingQuickMaterial] = useState(false);
  const materialOptions = type => (type === 'raw' ? rawMaterials : packagingMaterials).map(x => ({ ...x, price: Number(type === 'raw' ? x.last_cost || x.avg_cost || 0 : x.avg_cost || 0) }));
  const packagingCategories = [...new Set([...defaultPackagingCategories, ...packagingMaterials.map(material => material.category).filter(Boolean)])].sort();
  const update = (key, field, value) => setItems(all => all.map(item => { if (item.key !== key) return item; const next = { ...item, [field]: value }; if (field === 'materialType') { next.materialId = null; next.unitPrice = 0; } if (field === 'materialId') next.unitPrice = materialOptions(next.materialType).find(x => x.id === value)?.price ?? 0; return next; }));
  const subtotal = items.reduce((sum, x) => sum + Number(x.quantity || 0) * Number(x.unitPrice || 0), 0);
  const tax = items.reduce((sum, x) => sum + Number(x.quantity || 0) * Number(x.unitPrice || 0) * Number(x.taxRate || 0) / 100, 0);
  const reset = () => { form.resetFields(); setItems([blankItem()]); setCreating(false); };
  const openQuickMaterial = (item) => {
    quickMaterialForm.resetFields();
    quickMaterialForm.setFieldsValue({ unit: item.materialType === 'raw' ? 'kg' : 'pcs', category: item.materialType === 'raw' ? 'General' : undefined });
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
      if (quickMaterial.type === 'raw') payload.category = values.category;
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
  const submit = async values => {
    const valid = items.filter(x => x.materialId && x.quantity > 0);
    if (valid.length !== items.length) return message.error('Select a material and quantity for every line item.');
    setSaving(true);
    try { await client.post('/purchases', { supplier_id: values.supplierId, invoice_date: values.invoiceDate.format('YYYY-MM-DD'), due_date: values.paidImmediately === 'yes' ? undefined : values.dueDate?.format('YYYY-MM-DD'), notes: values.notes, paid_immediately: values.paidImmediately === 'yes', payment_method_id: values.paymentMethodId, items: valid.map(x => ({ material_type: x.materialType, material_id: x.materialId, quantity: x.quantity, unit_price: x.unitPrice, tax_rate: x.taxRate })) }); message.success('Purchase recorded, inventory updated, and accounts posted.'); reset(); reload(); }
    catch (error) { message.error(error.response?.data?.message || 'Could not save the purchase.'); } finally { setSaving(false); }
  };
  const itemColumns = [
    { title: 'Type', render: (_, x) => <Select value={x.materialType} onChange={v => update(x.key, 'materialType', v)} options={[{ value: 'raw', label: 'Raw Material' }, { value: 'packaging', label: 'Packaging' }]} /> },
    { title: 'Material', render: (_, x) => <Space.Compact style={{ width: '100%' }}><Select value={x.materialId} onChange={v => update(x.key, 'materialId', v)} placeholder="Select material" options={materialOptions(x.materialType).map(y => ({ value: y.id, label: y.name }))} style={{ width: '100%' }} /><Button icon={<PlusOutlined />} title={`Create ${x.materialType === 'raw' ? 'raw material' : 'packaging material'}`} onClick={() => openQuickMaterial(x)} /></Space.Compact> },
    { title: 'Qty', render: (_, x) => <InputNumber min={0.01} value={x.quantity} onChange={v => update(x.key, 'quantity', v)} /> },
    { title: 'Unit price', render: (_, x) => <InputNumber min={0} value={x.unitPrice} onChange={v => update(x.key, 'unitPrice', v)} /> },
    { title: 'GST', render: (_, x) => <Select value={x.taxRate} onChange={v => update(x.key, 'taxRate', v)} options={[0, 5, 12, 18, 28].map(v => ({ value: v, label: `${v}%` }))} /> },
    { title: 'Total', align: 'right', render: (_, x) => `₹${(Number(x.quantity || 0) * Number(x.unitPrice || 0) * (1 + Number(x.taxRate || 0) / 100)).toLocaleString()}` },
    { render: (_, x) => <Button type="text" danger icon={<DeleteOutlined />} disabled={items.length === 1} onClick={() => setItems(all => all.filter(y => y.key !== x.key))} /> }
  ];
  const columns = [{ title: 'Invoice #', dataIndex: 'invoice_number' }, { title: 'Supplier', render: (_, x) => x.supplier?.name || '—' }, { title: 'Date', dataIndex: 'invoice_date', render: x => x ? dayjs(x).format('DD MMM YYYY') : '—' }, { title: 'Amount', dataIndex: 'total_amount', align: 'right', render: x => `₹${Number(x || 0).toLocaleString()}` }, { title: 'Status', dataIndex: 'status', render: x => <Tag color={x === 'paid' ? 'success' : 'warning'}>{(x || 'unpaid').toUpperCase()}</Tag> }];
  return <div style={{ padding: 24 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}><h1>Purchases</h1><Space><PageDrawerControls title="Purchases" summary={<Statistic title="Total value" value={purchases.reduce((sum, x) => sum + Number(x.total_amount || 0), 0)} prefix="₹" />} /><Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(x => !x)}>{creating ? 'Close Form' : 'New Purchase'}</Button></Space></div>
    {creating && <Form form={form} layout="vertical" onFinish={submit} initialValues={{ invoiceDate: dayjs(), paidImmediately: 'no' }}>
      <Card title="Record Purchase" style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col xs={24} md={8}><Form.Item name="supplierId" label="Supplier" rules={[{ required: true }]}><Select options={suppliers.map(x => ({ value: x.id, label: x.name }))} /></Form.Item></Col>
          <Col xs={12} md={4}><Form.Item name="invoiceDate" label="Invoice date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          <Form.Item noStyle shouldUpdate={(a, b) => a.paidImmediately !== b.paidImmediately}>{({ getFieldValue }) => getFieldValue('paidImmediately') !== 'yes' && <Col xs={12} md={4}><Form.Item name="dueDate" label="Due date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>}</Form.Item>
        </Row>
        <Row gutter={16}>
          <Col xs={12} md={4}><Form.Item name="paidImmediately" label="Paid now?"><Select onChange={value => { if (value === 'yes') form.setFieldValue('dueDate', undefined); }} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} /></Form.Item></Col>
          <Form.Item noStyle shouldUpdate={(a, b) => a.paidImmediately !== b.paidImmediately}>{({ getFieldValue }) => getFieldValue('paidImmediately') === 'yes' && <Col xs={24} md={8}><Form.Item name="paymentMethodId" label="Payment method" rules={[{ required: true }]}><Select placeholder="Select payment method" options={paymentMethods.map(method => ({ value: method.id, label: `${method.name}${method.account ? ` — ${method.account.name}` : ''}` }))} /></Form.Item></Col>}</Form.Item>
        </Row>
        <Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item>
        <Table rowKey="key" dataSource={items} columns={itemColumns} pagination={false} scroll={{ x: 800 }} />
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => setItems(all => [...all, blankItem()])} style={{ width: '100%', marginTop: 16 }}>Add line item</Button>
        <Divider />
        <div style={{ textAlign: 'right' }}>Subtotal: ₹{subtotal.toLocaleString()}<br />GST: ₹{tax.toLocaleString()}<br /><strong>Grand Total: ₹{(subtotal + tax).toLocaleString()}</strong></div>
        <Space style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}><Button onClick={reset}>Cancel</Button><Button type="primary" htmlType="submit" loading={saving} icon={<CheckCircleOutlined />}>Save Purchase</Button></Space>
      </Card>
    </Form>}
    <Card title="Purchase History">
      <ResponsiveDataTable
        rowKey="id"
        columns={columns}
        dataSource={purchases}
        loading={loading}
        emptyText="No purchases found"
        mobileRenderItem={(purchase) => (
          <>
            <div className="mobile-data-list__title-row">
              <strong>{purchase.invoice_number || 'Purchase'}</strong>
              <Tag color={purchase.status === 'paid' ? 'success' : 'warning'}>
                {(purchase.status || 'unpaid').toUpperCase()}
              </Tag>
            </div>
            <span className="mobile-data-list__code">
              {purchase.supplier?.name || '—'} · {purchase.invoice_date ? dayjs(purchase.invoice_date).format('DD MMM YYYY') : '—'}
            </span>
            <div className="mobile-data-list__metrics">
              <span>Amount <strong>₹{Number(purchase.total_amount || 0).toLocaleString()}</strong></span>
            </div>
          </>
        )}
      />
    </Card>
    <Modal
      title={quickMaterial?.type === 'raw' ? 'Quick Create Raw Material' : 'Quick Create Packaging Material'}
      open={Boolean(quickMaterial)}
      onCancel={() => setQuickMaterial(null)}
      onOk={saveQuickMaterial}
      confirmLoading={savingQuickMaterial}
      okText="Create & Select"
      destroyOnClose
    >
      <Form form={quickMaterialForm} layout="vertical">
        <Form.Item name="name" label="Material name" rules={[{ required: true, message: 'Enter a material name' }]}><Input autoFocus placeholder={quickMaterial?.type === 'raw' ? 'e.g. Jasmine Absolute' : 'e.g. 100ml clear bottle'} /></Form.Item>
        <Row gutter={12}>
          {quickMaterial?.type === 'raw' ? <Col span={12}><Form.Item name="category" label="Category" rules={[{ required: true }]}><Input placeholder="e.g. Essential oil" /></Form.Item></Col> : <Col span={24}><Form.Item name="category" label="Package Type" rules={[{ required: true, message: 'Select or enter a package type' }]}><Select mode="tags" maxCount={1} placeholder="Select or type a package type" options={packagingCategories.map(category => ({ value: category, label: category }))} /></Form.Item></Col>}
          <Col span={12}><Form.Item name="unit" label="Unit" rules={[{ required: true }]}><Select options={['kg', 'g', 'L', 'ml', 'pcs', 'set'].map(value => ({ value, label: value }))} /></Form.Item></Col>
        </Row>
        <Form.Item name="unitPrice" label="Expected unit price" initialValue={0} rules={[{ required: true }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item>
      </Form>
    </Modal>
  </div>;
}
