import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Input, InputNumber, Modal, Segmented, Select, Space, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined, SwapOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';

const { Text } = Typography;
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
const currency = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const quantityLabel = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 });
const newReplacement = () => ({ key: `${Date.now()}-${Math.random()}`, product: null, quantity: 1, unit_price: 0, tax_rate: 0 });
const allocateFixedDiscount = (bases, amount) => {
  const baseCents = bases.map(base => Math.round(currency(base) * 100));
  const subtotalCents = baseCents.reduce((sum, cents) => sum + cents, 0);
  const discountCents = Math.min(Math.max(0, Math.round(Number(amount || 0) * 100)), subtotalCents);
  if (!subtotalCents || !discountCents) return baseCents.map(() => 0);
  const shares = baseCents.map((cents, index) => {
    const exact = discountCents * cents / subtotalCents;
    return { index, cents: Math.floor(exact), remainder: exact % 1 };
  });
  let centsLeft = discountCents - shares.reduce((sum, share) => sum + share.cents, 0);
  shares.sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let index = 0; index < centsLeft; index += 1) shares[index].cents += 1;
  return shares.sort((left, right) => left.index - right.index).map(share => share.cents / 100);
};

export default function SalesExchangeModal({ sale, open, onClose, onCreated }) {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const productsQuery = useApiData('/finished-goods');
  const packagingQuery = useApiData('/packaging-materials');
  const settingsQuery = useApiData('/tenant/settings', { initialData: {} });
  const methodsQuery = useApiData('/accounts/payment-methods');
  const [returnRows, setReturnRows] = useState([]);
  const [replacements, setReplacements] = useState([newReplacement()]);
  const [replacementDiscountMode, setReplacementDiscountMode] = useState('percent');
  const [replacementDiscountValue, setReplacementDiscountValue] = useState(0);
  const [saving, setSaving] = useState(false);

  const products = useMemo(() => productsQuery.data
    .filter(item => item.is_active !== false && item.product?.is_active !== false)
    .map(item => ({ ...item, price: Number(item.selling_price || 0), tax: Number(item.tax_rate || 0) })), [productsQuery.data]);
  const packagingMaterials = useMemo(() => packagingQuery.data
    .filter(item => item.is_active !== false)
    .map(item => ({ ...item, price: Number(item.selling_price || 0), tax: Number(item.tax_rate || 0) })), [packagingQuery.data]);
  const replacementOptions = useMemo(() => [
    ...products.map(item => ({ value: `product:${item.id}`, label: `${item.sku ? `${item.sku} · ` : ''}${item.product?.name || item.name} · ${item.size_label || item.name}` })),
    ...(settingsQuery.data.packaging_material_sales_enabled ? packagingMaterials.map(item => ({ value: `packaging:${item.id}`, label: `${item.sku ? `${item.sku} · ` : ''}${item.name} · Packing material` })) : [])
  ], [packagingMaterials, products, settingsQuery.data.packaging_material_sales_enabled]);
  const saleItems = useMemo(() => new Map((sale.retailSaleItems || []).map(item => [item.id, item])), [sale.retailSaleItems]);

  useEffect(() => {
    if (!open) return;
    setReturnRows((sale.retailSaleItems || []).map(item => ({ id: item.id, returnable: Number(item.returnable_quantity ?? item.quantity), quantity: 0 })));
    setReplacements([newReplacement()]);
    setReplacementDiscountMode('percent');
    setReplacementDiscountValue(0);
    form.setFieldsValue({
      payment_method_id: undefined,
      exchange_reason: undefined,
      notes: ''
    });
  }, [form, open, sale.id, sale.retailSaleItems]);

  useEffect(() => {
    if (!open || form.getFieldValue('payment_method_id')) return;
    form.setFieldValue('payment_method_id', methodsQuery.data.find(item => item.id === sale.payment_method_id)?.id || methodsQuery.data.find(item => item.is_default)?.id || methodsQuery.data[0]?.id);
  }, [form, methodsQuery.data, open, sale.payment_method_id]);

  const selectedReturns = returnRows.filter(row => Number(row.quantity) > 0);
  const selectedReplacements = replacements.filter(row => row.product && Number(row.quantity) > 0);
  const invoiceDiscountAmount = Number(sale.discount_amount || 0);
  const invoiceSubtotal = Number(sale.subtotal || 0);
  const invoiceDiscountRate = invoiceSubtotal > 0 ? invoiceDiscountAmount / invoiceSubtotal * 100 : 0;
  const selectedReturnBase = currency(selectedReturns.reduce((sum, row) => {
    const item = saleItems.get(row.id);
    return sum + Number(item?.unit_price || 0) * Number(row.quantity);
  }, 0));
  const selectedReturnDiscount = currency(selectedReturns.reduce((sum, row) => {
    const item = saleItems.get(row.id);
    const lineBase = currency(Number(item?.unit_price || 0) * Number(row.quantity));
    const originalBase = currency(Number(item?.unit_price || 0) * Number(item?.quantity || 0));
    const originalDiscount = currency(originalBase + Number(item?.tax_amount || 0) - Number(item?.total || 0));
    return sum + (originalBase > 0 ? currency(originalDiscount * Number(row.quantity) / Number(item?.quantity || 1)) : currency(lineBase * invoiceDiscountRate / 100));
  }, 0));
  const returnedDiscountRate = selectedReturnBase > 0
    ? selectedReturnDiscount / selectedReturnBase * 100
    : invoiceDiscountRate;
  const returnCredit = currency(selectedReturns.reduce((sum, row) => {
    const item = saleItems.get(row.id);
    return sum + Number(item?.total || 0) * Number(row.quantity) / Number(item?.quantity || 1);
  }, 0));
  const replacementBases = selectedReplacements.map(row => currency(Number(row.unit_price) * Number(row.quantity)));
  const replacementSubtotal = currency(replacementBases.reduce((sum, base) => sum + base, 0));
  const replacementDiscountAmount = replacementDiscountMode === 'percent'
    ? currency(replacementSubtotal * Number(replacementDiscountValue || 0) / 100)
    : Math.min(currency(replacementDiscountValue), replacementSubtotal);
  const fixedDiscountAllocations = allocateFixedDiscount(replacementBases, replacementDiscountAmount);
  const replacementTotal = currency(selectedReplacements.reduce((sum, row, index) => {
    const base = replacementBases[index];
    const discount = fixedDiscountAllocations[index];
    const taxable = currency(base - discount);
    return sum + taxable + currency(taxable * Number(row.tax_rate || 0) / 100);
  }, 0));
  const estimatedCashCredit = Math.max(0, currency(returnCredit - Number(sale.balance_due || 0)));
  const originalCreditRemaining = Math.max(0, currency(Number(sale.store_credit_used || 0) - (sale.salesReturns || []).reduce((sum, row) => sum + Number(row.reinstated_credit_amount || 0), 0)));
  const estimatedReinstated = Math.min(estimatedCashCredit, originalCreditRemaining);
  const estimatedRefund = currency(estimatedCashCredit - estimatedReinstated);
  const difference = currency(replacementTotal - Math.min(replacementTotal, estimatedReinstated) - estimatedRefund);

  const updateReturn = (id, changes) => setReturnRows(current => current.map(row => row.id === id ? { ...row, ...changes } : row));
  const updateReplacement = (key, changes) => setReplacements(current => current.map(row => row.key === key ? { ...row, ...changes } : row));
  const chooseProduct = (key, productId) => {
    const [type, id] = String(productId || '').split(':');
    const product = (type === 'packaging' ? packagingMaterials : products).find(item => item.id === id);
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
    try {
      const values = await form.validateFields();
      if (!selectedReturns.length) return message.error('Enter a quantity for at least one returned item.');
      if (!selectedReplacements.length) return message.error('Add at least one replacement product.');
      if (replacementTotal <= 0) return message.error('The replacement total must be greater than zero.');
      setSaving(true);

      const replacementItems = selectedReplacements.map(row => {
        const [type, id] = String(row.product).split(':');
        return { ...(type === 'packaging' ? { packaging_material_id: id } : { finished_good_id: id }), quantity: Number(row.quantity), unit_price: Number(row.unit_price), discount_pct: 0, tax_rate: Number(row.tax_rate || 0) };
      });
      const { data: preview } = await client.post('/retail-sales/preview', { items: replacementItems });
      let allowNegativeMaterials = false;
      if (preview.requires_negative_confirmation) {
        allowNegativeMaterials = await confirmNegativeMaterials(preview);
        if (!allowNegativeMaterials) return;
      }

      const { data } = await client.post(`/retail-sales/${sale.id}/exchange`, {
        payment_method_id: values.payment_method_id,
        return: {
          notes: [values.exchange_reason, values.notes].filter(Boolean).join(' · '),
          items: selectedReturns.map(row => ({ retail_sale_item_id: row.id, quantity: Number(row.quantity), restock_quantity: Number(row.quantity) }))
        },
        replacement: {
          items: replacementItems,
          allow_negative_materials: allowNegativeMaterials,
          order_discount_amount: replacementDiscountAmount
        }
      });
      const actualDifference = Number(data.net_cash_due || 0);
      message.success(actualDifference > 0 ? `Exchange posted. Collect ${money(actualDifference)}.` : actualDifference < 0 ? `Exchange posted. Refund ${money(Math.abs(actualDifference))}.` : 'Even exchange posted. No balance due.');
      await onCreated?.();
      onClose();
      navigate(`/app/retail-sales/${data.sale.id}`);
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.response?.data?.message || error.message || 'Could not complete the exchange');
    } finally { setSaving(false); }
  };

  const returnColumns = [
    { title: 'Returned item', render: (_, row) => { const item = saleItems.get(row.id); const variant = item?.finishedGood; const packingMaterial = item?.packagingMaterial; return <div><strong>{packingMaterial?.name || variant?.product?.name || variant?.name || 'Product'}</strong><br /><Text type="secondary">{packingMaterial?.sku || variant?.size_label || variant?.sku || 'Variant'} · available {quantityLabel(row.returnable)}</Text></div>; } },
    { title: 'Return quantity (will be restocked)', width: 205, render: (_, row) => <InputNumber min={0} max={row.returnable} precision={4} value={row.quantity} onChange={value => updateReturn(row.id, { quantity: Number(value || 0) })} style={{ width: '100%' }} /> }
  ];
  const replacementColumns = [
    { title: 'Replacement item', render: (_, row) => <Select showSearch optionFilterProp="label" value={row.product} placeholder="Search product or packing material" loading={productsQuery.loading || packagingQuery.loading} onChange={value => chooseProduct(row.key, value)} style={{ width: '100%' }} options={replacementOptions} /> },
    { title: 'Quantity', width: 135, render: (_, row) => { const [type, id] = String(row.product || '').split(':'); const product = (type === 'packaging' ? packagingMaterials : products).find(item => item.id === id); const measured = type !== 'packaging' && Boolean(product?.product?.sell_by_measurement); return <InputNumber min={measured ? 0.0001 : 1} step={1} precision={measured ? 4 : 0} value={row.quantity} onChange={value => updateReplacement(row.key, { quantity: Number(value || 0) })} style={{ width: '100%' }} />; } },
    { title: 'Unit price', width: 145, render: (_, row) => <InputNumber min={0} precision={2} prefix="₹" value={row.unit_price} onChange={value => updateReplacement(row.key, { unit_price: Number(value || 0) })} style={{ width: '100%' }} /> },
    { title: '', width: 46, render: (_, row) => <Button type="text" danger icon={<DeleteOutlined />} disabled={replacements.length === 1} onClick={() => setReplacements(current => current.filter(item => item.key !== row.key))} /> }
  ];

  return <Modal title={<Space><SwapOutlined />Exchange items from {sale.sale_number}</Space>} open={open} onCancel={() => !saving && onClose()} onOk={submit} okText="Post exchange" confirmLoading={saving} okButtonProps={{ disabled: !selectedReturns.length || !selectedReplacements.length }} width={980} destroyOnHidden maskClosable={!saving}>
    <Alert showIcon type="info" message="Return and replacement stay linked" description={<>
      The return estimate already includes the original discount and tax on the items coming back. The invoice discount was {money(invoiceDiscountAmount)} ({invoiceDiscountRate.toFixed(2)}% effective); the selected return includes {money(selectedReturnDiscount)} of that discount. Returned quantities are restocked automatically. Set one discount for the entire replacement invoice; any unpaid balance is reduced before a cash refund is recorded.
    </>} style={{ marginBottom: 16 }} />
    <Text strong>1. Items coming back</Text>
    <Table rowKey="id" dataSource={returnRows.filter(row => row.returnable > 0.00005)} columns={returnColumns} pagination={false} size="small" scroll={{ x: 600 }} style={{ margin: '8px 0 18px' }} />
    <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
      <Text strong>2. Replacement items</Text>
      <Space wrap>
        <Segmented value={replacementDiscountMode} onChange={setReplacementDiscountMode} options={[{ label: 'Universal %', value: 'percent' }, { label: 'Universal amount', value: 'fixed' }]} />
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setReplacements(current => [...current, newReplacement()])}>Add product</Button>
      </Space>
    </Space>
    <Table rowKey="key" dataSource={replacements} columns={replacementColumns} pagination={false} size="small" scroll={{ x: 720 }} style={{ margin: '8px 0 18px' }} />
    <Space wrap style={{ margin: '0 0 18px' }}>
      <Text>Universal discount</Text>
      <InputNumber min={0} max={replacementDiscountMode === 'percent' ? 100 : replacementSubtotal} precision={2} prefix={replacementDiscountMode === 'fixed' ? '₹' : undefined} suffix={replacementDiscountMode === 'percent' ? '%' : undefined} value={replacementDiscountValue} onChange={value => setReplacementDiscountValue(Math.min(Number(value || 0), replacementDiscountMode === 'percent' ? 100 : replacementSubtotal))} />
      {selectedReturnDiscount > 0 && <Button size="small" onClick={() => setReplacementDiscountValue(replacementDiscountMode === 'fixed' ? Math.min(selectedReturnDiscount, replacementSubtotal) : Math.min(100, currency(selectedReturnDiscount / Math.max(replacementSubtotal, 0.01) * 100)))}>
        {replacementDiscountMode === 'fixed' ? `Use returned discount (${money(selectedReturnDiscount)})` : `Use equivalent returned rate (${returnedDiscountRate.toFixed(2)}%)`}
      </Button>}
      <Text type="secondary">Applied once across all replacement items before tax. Maximum {replacementDiscountMode === 'fixed' ? money(replacementSubtotal) : '100%'}.</Text>
    </Space>
    <Form form={form} layout="vertical">
      <Form.Item name="payment_method_id" label="Settlement method" rules={[{ required: true, message: 'Select the payment or refund method' }]}><Select loading={methodsQuery.loading} options={methodsQuery.data.map(method => ({ value: method.id, label: `${method.name} · ${method.account?.name || 'Cash / Bank'}` }))} /></Form.Item>
      <Form.Item name="exchange_reason" label="Exchange reason" rules={[{ required: true, message: 'Select an exchange reason' }]}><Select options={['Wrong product', 'Wrong size', 'Customer preference', 'Damaged product', 'Billing correction', 'Other'].map(value => ({ value, label: value }))} /></Form.Item>
      <Form.Item name="notes" label="Notes (optional)"><Input.TextArea rows={2} maxLength={1500} /></Form.Item>
    </Form>
    <div style={{ background: '#fafafa', borderRadius: 10, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, textAlign: 'center' }}>
      <div><Text type="secondary">Return value (estimate)</Text><div><strong>{money(returnCredit)}</strong></div></div>
      <div><Text type="secondary">Replacement</Text><div><strong>{money(replacementTotal)}</strong></div></div>
      <div><Text type="secondary">Estimated cash balance</Text><div><Tag color={difference > 0 ? 'blue' : difference < 0 ? 'red' : 'green'} style={{ margin: 0 }}>{difference > 0 ? `Collect ${money(difference)}` : difference < 0 ? `Refund ${money(Math.abs(difference))}` : 'Even exchange'}</Tag></div></div>
    </div>
    {Number(sale.balance_due || 0) > 0 && <Text type="secondary">The return reduces unpaid balance before any refund: up to {money(sale.balance_due)}.</Text>}
    {estimatedReinstated > 0 && <Text type="secondary" style={{ display: 'block' }}>About {money(estimatedReinstated)} of previously used store credit will be restored and applied to the replacement.</Text>}
  </Modal>;
}
