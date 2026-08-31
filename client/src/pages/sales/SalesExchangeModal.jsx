import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined, SwapOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';

const { Text } = Typography;
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
const currency = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const quantityLabel = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 });
const newReplacement = () => ({ key: `${Date.now()}-${Math.random()}`, product: null, quantity: 1, unit_price: 0, tax_rate: 0 });

export default function SalesExchangeModal({ sale, open, onClose, onCreated }) {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const productsQuery = useApiData('/finished-goods');
  const methodsQuery = useApiData('/accounts/payment-methods');
  const [returnRows, setReturnRows] = useState([]);
  const [replacements, setReplacements] = useState([newReplacement()]);
  const [saving, setSaving] = useState(false);

  const products = useMemo(() => productsQuery.data
    .filter(item => item.is_active !== false && item.product?.is_active !== false)
    .map(item => ({ ...item, price: Number(item.selling_price || 0), tax: Number(item.tax_rate || 0) })), [productsQuery.data]);
  const saleItems = useMemo(() => new Map((sale.retailSaleItems || []).map(item => [item.id, item])), [sale.retailSaleItems]);

  useEffect(() => {
    if (!open) return;
    setReturnRows((sale.retailSaleItems || []).map(item => ({ id: item.id, returnable: Number(item.returnable_quantity ?? item.quantity), quantity: 0, restock: false })));
    setReplacements([newReplacement()]);
    form.setFieldsValue({
      payment_method_id: sale.payment_method_id || methodsQuery.data.find(item => item.is_default)?.id,
      exchange_reason: undefined,
      notes: ''
    });
  }, [form, methodsQuery.data, open, sale]);

  const selectedReturns = returnRows.filter(row => Number(row.quantity) > 0);
  const selectedReplacements = replacements.filter(row => row.product && Number(row.quantity) > 0);
  const returnCredit = currency(selectedReturns.reduce((sum, row) => {
    const item = saleItems.get(row.id);
    return sum + Number(item?.total || 0) * Number(row.quantity) / Number(item?.quantity || 1);
  }, 0));
  const replacementTotal = currency(selectedReplacements.reduce((sum, row) => {
    const base = currency(Number(row.unit_price) * Number(row.quantity));
    return sum + base + currency(base * Number(row.tax_rate || 0) / 100);
  }, 0));
  const difference = currency(replacementTotal - returnCredit);

  const updateReturn = (id, changes) => setReturnRows(current => current.map(row => row.id === id ? { ...row, ...changes } : row));
  const updateReplacement = (key, changes) => setReplacements(current => current.map(row => row.key === key ? { ...row, ...changes } : row));
  const chooseProduct = (key, productId) => {
    const product = products.find(item => item.id === productId);
    if (!product) return;
    const minimum = 1;
    updateReplacement(key, { product: productId, quantity: minimum, unit_price: product.price, tax_rate: product.tax });
  };

  const confirmNegativeMaterials = preview => new Promise(resolve => Modal.confirm({
    title: 'Replacement materials will go below zero',
    width: 520,
    content: <div><Text type="secondary">The exchange can continue and these shortages will be tracked:</Text><div style={{ marginTop: 12 }}>{(preview.shortages || []).map(item => <div key={`${item.material_type}:${item.material_id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{item.name}</span><Text type="danger">Short {quantityLabel(item.shortage_qty)} {item.unit}</Text></div>)}</div></div>,
    okText: 'Continue exchange',
    okButtonProps: { danger: true },
    onOk: () => resolve(true),
    onCancel: () => resolve(false)
  }));

  const submit = async () => {
    let postedReturn = null;
    try {
      const values = await form.validateFields();
      if (!selectedReturns.length) return message.error('Enter a quantity for at least one returned item.');
      if (!selectedReplacements.length) return message.error('Add at least one replacement product.');
      if (replacementTotal <= 0) return message.error('Replacement sale total must be greater than zero.');
      setSaving(true);

      const replacementItems = selectedReplacements.map(row => ({ finished_good_id: row.product, quantity: Number(row.quantity), unit_price: Number(row.unit_price), discount_pct: 0, tax_rate: Number(row.tax_rate || 0) }));
      const { data: preview } = await client.post('/retail-sales/preview', { items: replacementItems });
      let allowNegativeMaterials = false;
      if (preview.requires_negative_confirmation) {
        allowNegativeMaterials = await confirmNegativeMaterials(preview);
        if (!allowNegativeMaterials) return;
      }

      const returnReason = difference < -0.005 ? 'Exchange + refund' : 'Exchange';
      const returnResponse = await client.post(`/retail-sales/${sale.id}/returns`, {
        refund_payment_method_id: values.payment_method_id,
        reason: returnReason,
        notes: [values.exchange_reason, values.notes].filter(Boolean).join(' · '),
        items: selectedReturns.map(row => ({ retail_sale_item_id: row.id, quantity: Number(row.quantity), restock_quantity: row.restock ? Number(row.quantity) : 0 }))
      });
      postedReturn = returnResponse.data;

      const saleResponse = await client.post('/retail-sales', {
        customer_id: sale.customer_id || undefined,
        exchange_return_id: postedReturn.id,
        notes: `Exchange against ${sale.sale_number} via ${postedReturn.return_number}`,
        allow_negative_materials: allowNegativeMaterials,
        payments: [{ payment_method_id: values.payment_method_id, amount: replacementTotal }],
        items: replacementItems
      });
      const actualDifference = currency(Number(saleResponse.data.total_amount) - Number(postedReturn.total_amount));
      message.success(actualDifference > 0 ? `Exchange posted. Collect ${money(actualDifference)}.` : actualDifference < 0 ? `Exchange posted. Refund ${money(Math.abs(actualDifference))}.` : 'Even exchange posted. No balance due.');
      await onCreated?.();
      onClose();
      navigate(`/app/retail-sales/${saleResponse.data.id}`);
    } catch (error) {
      if (error?.errorFields) return;
      if (postedReturn) {
        await onCreated?.();
        message.error(`Return ${postedReturn.return_number} was posted, but the replacement sale failed. Create the replacement as a new sale. ${error.response?.data?.message || error.message || ''}`);
      } else {
        message.error(error.response?.data?.message || error.message || 'Could not complete the exchange');
      }
    } finally { setSaving(false); }
  };

  const returnColumns = [
    { title: 'Returned item', render: (_, row) => { const item = saleItems.get(row.id); const variant = item?.finishedGood; const packingMaterial = item?.packagingMaterial; return <div><strong>{packingMaterial?.name || variant?.product?.name || variant?.name || 'Product'}</strong><br /><Text type="secondary">{packingMaterial?.sku || variant?.size_label || variant?.sku || 'Variant'} · available {quantityLabel(row.returnable)}</Text></div>; } },
    { title: 'Return quantity', width: 155, render: (_, row) => <InputNumber min={0} max={row.returnable} precision={4} value={row.quantity} onChange={value => updateReturn(row.id, { quantity: Number(value || 0), ...(Number(value || 0) ? {} : { restock: false }) })} style={{ width: '100%' }} /> },
    { title: 'Inventory', width: 130, render: (_, row) => <Checkbox checked={row.restock} disabled={!Number(row.quantity)} onChange={event => updateReturn(row.id, { restock: event.target.checked })}>Restock</Checkbox> }
  ];
  const replacementColumns = [
    { title: 'Replacement product', render: (_, row) => <Select showSearch optionFilterProp="label" value={row.product} placeholder="Search product / SKU" loading={productsQuery.loading} onChange={value => chooseProduct(row.key, value)} style={{ width: '100%' }} options={products.map(product => ({ value: product.id, label: `${product.sku ? `${product.sku} · ` : ''}${product.product?.name || product.name} · ${product.size_label || product.name}` }))} /> },
    { title: 'Quantity', width: 135, render: (_, row) => { const product = products.find(item => item.id === row.product); const measured = Boolean(product?.product?.sell_by_measurement); return <InputNumber min={measured ? 0.0001 : 1} step={1} precision={measured ? 4 : 0} value={row.quantity} onChange={value => updateReplacement(row.key, { quantity: Number(value || 0) })} style={{ width: '100%' }} />; } },
    { title: 'Unit price', width: 145, render: (_, row) => <InputNumber min={0} precision={2} prefix="₹" value={row.unit_price} onChange={value => updateReplacement(row.key, { unit_price: Number(value || 0) })} style={{ width: '100%' }} /> },
    { title: '', width: 46, render: (_, row) => <Button type="text" danger icon={<DeleteOutlined />} disabled={replacements.length === 1} onClick={() => setReplacements(current => current.filter(item => item.key !== row.key))} /> }
  ];

  return <Modal title={<Space><SwapOutlined />Exchange items from {sale.sale_number}</Space>} open={open} onCancel={() => !saving && onClose()} onOk={submit} okText="Post exchange" confirmLoading={saving} okButtonProps={{ disabled: !selectedReturns.length || !selectedReplacements.length }} width={980} destroyOnHidden maskClosable={!saving}>
    <Alert showIcon type="info" message="Return and replacement stay linked" description="The system posts the original-item return and a new replacement invoice. The register automatically nets both transactions using the selected settlement method." style={{ marginBottom: 16 }} />
    <Text strong>1. Items coming back</Text>
    <Table rowKey="id" dataSource={returnRows.filter(row => row.returnable > 0.00005)} columns={returnColumns} pagination={false} size="small" scroll={{ x: 600 }} style={{ margin: '8px 0 18px' }} />
    <Space style={{ width: '100%', justifyContent: 'space-between' }}><Text strong>2. Replacement items</Text><Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setReplacements(current => [...current, newReplacement()])}>Add product</Button></Space>
    <Table rowKey="key" dataSource={replacements} columns={replacementColumns} pagination={false} size="small" scroll={{ x: 720 }} style={{ margin: '8px 0 18px' }} />
    <Form form={form} layout="vertical">
      <Form.Item name="payment_method_id" label="Settlement method" rules={[{ required: true, message: 'Select the payment or refund method' }]}><Select loading={methodsQuery.loading} options={methodsQuery.data.map(method => ({ value: method.id, label: `${method.name} · ${method.account?.name || 'Cash / Bank'}` }))} /></Form.Item>
      <Form.Item name="exchange_reason" label="Exchange reason" rules={[{ required: true, message: 'Select an exchange reason' }]}><Select options={['Wrong product', 'Wrong size', 'Customer preference', 'Damaged product', 'Billing correction', 'Other'].map(value => ({ value, label: value }))} /></Form.Item>
      <Form.Item name="notes" label="Notes (optional)"><Input.TextArea rows={2} maxLength={1500} /></Form.Item>
    </Form>
    <div style={{ background: '#fafafa', borderRadius: 10, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, textAlign: 'center' }}>
      <div><Text type="secondary">Return credit</Text><div><strong>{money(returnCredit)}</strong></div></div>
      <div><Text type="secondary">Replacement</Text><div><strong>{money(replacementTotal)}</strong></div></div>
      <div><Text type="secondary">Settlement</Text><div><Tag color={difference > 0 ? 'blue' : difference < 0 ? 'red' : 'green'} style={{ margin: 0 }}>{difference > 0 ? `Collect ${money(difference)}` : difference < 0 ? `Refund ${money(Math.abs(difference))}` : 'Even exchange'}</Tag></div></div>
    </div>
  </Modal>;
}
