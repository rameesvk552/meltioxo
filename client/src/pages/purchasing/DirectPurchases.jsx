import React, { useState } from 'react';
import { Button, Card, Col, DatePicker, Divider, Form, Input, InputNumber, Row, Select, Space, Statistic, Table, Tag, message } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import PageDrawerControls from '../../components/common/PageDrawerControls';
import ResponsiveDataTable from '../../components/common/ResponsiveDataTable';

const { TextArea } = Input;
const blankItem = () => ({ key: Date.now(), materialType: 'raw', materialId: null, quantity: 1, unitPrice: 0, taxRate: 18 });

export default function DirectPurchases() {
  const [form] = Form.useForm();
  const { data: purchases, loading, reload } = useApiData('/purchases');
  const { data: suppliers } = useApiData('/suppliers');
  const { data: cashBankLedgers } = useApiData('/accounts/cash-bank-ledgers');
  const { data: rawMaterials } = useApiData('/raw-materials');
  const { data: packagingMaterials } = useApiData('/packaging-materials');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([blankItem()]);

  const materialOptions = (type) => (type === 'raw' ? rawMaterials : packagingMaterials).map((material) => ({
    ...material, price: Number(type === 'raw' ? material.last_cost || material.avg_cost || 0 : material.avg_cost || 0),
  }));
  const updateItem = (key, field, value) => setItems((current) => current.map((item) => {
    if (item.key !== key) return item;
    const next = { ...item, [field]: value };
    if (field === 'materialType') { next.materialId = null; next.unitPrice = 0; }
    if (field === 'materialId') next.unitPrice = materialOptions(next.materialType).find((material) => material.id === value)?.price ?? 0;
    return next;
  }));
  const subtotal = items.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const taxAmount = items.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.unitPrice || 0) * Number(item.taxRate || 0) / 100, 0);
  const total = subtotal + taxAmount;

  const reset = () => { form.resetFields(); setItems([blankItem()]); setCreating(false); };
  const submit = async (values) => {
    setSaving(true);
    try {
      const validItems = items.filter((item) => item.materialId && item.quantity > 0);
      if (validItems.length !== items.length) { message.error('Select a material and quantity for every line item.'); return; }
      await client.post('/purchases', {
        supplier_id: values.supplierId, invoice_date: values.invoiceDate.format('YYYY-MM-DD'), due_date: values.dueDate?.format('YYYY-MM-DD'), notes: values.notes,
        paid_immediately: values.paidImmediately === 'yes', payment_mode: values.paymentMode,
        bank_account_id: values.bankAccountId,
        items: validItems.map((item) => ({ material_type: item.materialType, material_id: item.materialId, quantity: item.quantity, unit_price: item.unitPrice, tax_rate: item.taxRate })),
      });
      message.success('Purchase recorded, inventory updated, and accounts posted.');
      reset(); reload();
    } catch (error) { message.error(error.response?.data?.message || 'Could not save the purchase.'); }
    finally { setSaving(false); }
  };

  const columns = [
    { title: 'Invoice #', dataIndex: 'invoice_number' }, { title: 'Supplier', render: (_, row) => row.supplier?.name || '—' },
    { title: 'Invoice Date', dataIndex: 'invoice_date', render: (value) => value ? dayjs(value).format('DD MMM YYYY') : '—' },
    { title: 'Amount', dataIndex: 'total_amount', align: 'right', render: (value) => `₹${Number(value || 0).toLocaleString()}` },
    { title: 'Status', dataIndex: 'status', render: (status) => <Tag color={status === 'paid' ? 'success' : 'warning'}>{status?.toUpperCase() || 'UNPAID'}</Tag> },
  ];
  const itemColumns = [
    { title: 'Material Type', width: 145, render: (_, item) => <Select value={item.materialType} onChange={(value) => updateItem(item.key, 'materialType', value)} options={[{ value: 'raw', label: 'Raw Material' }, { value: 'packaging', label: 'Packaging' }]} style={{ width: '100%' }} /> },
    { title: 'Material', width: 240, render: (_, item) => <Select value={item.materialId} onChange={(value) => updateItem(item.key, 'materialId', value)} placeholder="Select material" options={materialOptions(item.materialType).map((material) => ({ value: material.id, label: material.name }))} style={{ width: '100%' }} /> },
    { title: 'Qty', width: 105, render: (_, item) => <InputNumber min={0.01} value={item.quantity} onChange={(value) => updateItem(item.key, 'quantity', value)} style={{ width: '100%' }} /> },
    { title: 'Unit Price', width: 130, render: (_, item) => <InputNumber min={0} value={item.unitPrice} onChange={(value) => updateItem(item.key, 'unitPrice', value)} style={{ width: '100%' }} /> },
    { title: 'GST %', width: 105, render: (_, item) => <Select value={item.taxRate} onChange={(value) => updateItem(item.key, 'taxRate', value)} options={[0, 5, 12, 18, 28].map((value) => ({ value, label: `${value}%` }))} style={{ width: '100%' }} /> },
    { title: 'Total', width: 120, align: 'right', render: (_, item) => `₹${(Number(item.quantity || 0) * Number(item.unitPrice || 0) * (1 + Number(item.taxRate || 0) / 100)).toLocaleString()}` },
    { width: 48, render: (_, item) => <Button type="text" danger icon={<DeleteOutlined />} disabled={items.length === 1} onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))} /> },
  ];
  const purchaseTotal = purchases.reduce((sum, purchase) => sum + Number(purchase.total_amount || 0), 0);
  const summary = <Row gutter={[12, 12]}><Col span={12}><Card size="small"><Statistic title="Purchases" value={purchases.length} /></Card></Col><Col span={12}><Card size="small"><Statistic title="Total value" value={purchaseTotal} prefix="₹" /></Card></Col></Row>;

  return <div style={{ padding: 24 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}><h1 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>Purchases</h1><Space><PageDrawerControls title="Direct purchases" summary={summary} /><Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(!creating)}>{creating ? 'Close Form' : 'New Purchase'}</Button></Space></div>
    {creating && <Form form={form} layout="vertical" onFinish={submit} initialValues={{ invoiceDate: dayjs(), paidImmediately: 'no' }}><Card title="Record Purchase" style={{ marginBottom: 24 }}>
      <Row gutter={16}><Col xs={24} md={8}><Form.Item name="supplierId" label="Supplier" rules={[{ required: true }]}><Select placeholder="Select supplier" onChange={() => { setSelectedPurchaseOrderId(null); setItems([blankItem()]); }} options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))} /></Form.Item></Col><Col xs={24} md={8}><Form.Item label="Approved Purchase Order"><Select value={selectedPurchaseOrderId || undefined} disabled={!supplierId} allowClear placeholder={supplierId ? 'Select approved PO (optional)' : 'Select supplier first'} onChange={selectPurchaseOrder} options={approvedPurchaseOrders.map((po) => ({ value: po.id, label: `${po.po_number} — ${po.purchaseOrderItems?.length || 0} item(s)` }))} /></Form.Item></Col><Col xs={12} md={4}><Form.Item name="invoiceDate" label="Invoice Date" rules={[{ required: !locked }]}><DatePicker disabled={locked} style={{ width: '100%' }} /></Form.Item></Col><Col xs={12} md={4}><Form.Item name="dueDate" label="Due Date"><DatePicker disabled={locked} style={{ width: '100%' }} /></Form.Item></Col></Row>
      {locked ? <p style={{ color: 'var(--color-text-secondary)' }}>PO items are loaded below. Receiving the PO updates inventory automatically.</p> : <><Row gutter={16}><Col xs={12} md={4}><Form.Item name="paidImmediately" label="Paid now?"><Select options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} /></Form.Item></Col><Col xs={12} md={4}><Form.Item noStyle shouldUpdate={(prev, next) => prev.paidImmediately !== next.paidImmediately}>{({ getFieldValue }) => getFieldValue('paidImmediately') === 'yes' ? <Form.Item name="paymentMode" label="Payment mode" rules={[{ required: true }]}><Select options={['cash', 'bank', 'upi', 'cheque'].map((value) => ({ value, label: value.toUpperCase() }))} /></Form.Item> : null}</Form.Item></Col></Row><Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item></>}
      <Table rowKey="key" dataSource={items} columns={itemColumns} pagination={false} scroll={{ x: 900 }} />{!locked && <Button type="dashed" icon={<PlusOutlined />} onClick={() => setItems((current) => [...current, blankItem()])} style={{ width: '100%', marginTop: 16 }}>Add line item</Button>}<Divider /><div style={{ textAlign: 'right' }}>Subtotal: ₹{subtotal.toLocaleString()}<br />GST: ₹{taxAmount.toLocaleString()}<br /><strong style={{ fontSize: 16, color: 'var(--color-gold)' }}>Grand Total: ₹{total.toLocaleString()}</strong></div><Space style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}><Button onClick={reset}>Cancel</Button><Button type="primary" htmlType="submit" loading={saving} icon={<CheckCircleOutlined />}>{locked ? 'Receive PO & Update Stock' : 'Save Purchase'}</Button></Space>
    </Card></Form>}
    <Card title="Direct Purchase History"><ResponsiveDataTable rowKey="id" columns={columns} dataSource={purchases} loading={loading} emptyText="No direct purchases found" mobileRenderItem={(purchase) => <><div className="mobile-data-list__title-row"><strong>{purchase.invoice_number || 'Purchase'}</strong><Tag color={purchase.status === 'paid' ? 'success' : 'warning'}>{purchase.status?.toUpperCase() || 'UNPAID'}</Tag></div><span className="mobile-data-list__code">{purchase.supplier?.name || 'No supplier'} · {purchase.invoice_date ? dayjs(purchase.invoice_date).format('DD MMM YYYY') : 'No date'}</span><div className="mobile-data-list__metrics"><span>Amount <strong>₹{Number(purchase.total_amount || 0).toLocaleString()}</strong></span></div></>} /></Card>
  </div>;
}
