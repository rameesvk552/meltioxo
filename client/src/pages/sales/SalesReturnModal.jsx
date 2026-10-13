import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Form, Input, InputNumber, Modal, Select, Table, Tag, Typography, message } from 'antd';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';

const { Text } = Typography;
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
const quantity = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 });

export default function SalesReturnModal({ sale, open, onClose, onCreated, settlementType = 'refund' }) {
  const [form] = Form.useForm();
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const methodsQuery = useApiData('/accounts/payment-methods');

  useEffect(() => {
    if (!open) return;
    setRows((sale.retailSaleItems || []).map(item => ({
      id: item.id,
      returnable: Number(item.returnable_quantity ?? item.quantity),
      quantity: 0
    })));
    form.setFieldsValue({ refund_payment_method_id: undefined, reason: undefined, notes: '' });
  }, [form, open, sale.id, sale.retailSaleItems]);

  useEffect(() => {
    if (!open || form.getFieldValue('refund_payment_method_id')) return;
    form.setFieldValue('refund_payment_method_id', methodsQuery.data.find(item => item.id === sale.payment_method_id)?.id || methodsQuery.data.find(item => item.is_default)?.id || methodsQuery.data[0]?.id);
  }, [form, methodsQuery.data, open, sale.payment_method_id]);

  const saleItems = useMemo(() => new Map((sale.retailSaleItems || []).map(item => [item.id, item])), [sale.retailSaleItems]);
  const selectedRows = rows.filter(row => Number(row.quantity) > 0);
  const estimatedRefund = selectedRows.reduce((sum, row) => {
    const item = saleItems.get(row.id);
    return sum + Number(item?.total || 0) * Number(row.quantity) / Number(item?.quantity || 1);
  }, 0);
  const estimatedOffset = Math.min(estimatedRefund, Number(sale.balance_due || 0));
  const estimatedSettlement = Math.max(0, estimatedRefund - estimatedOffset);
  const isStoreCredit = settlementType === 'store_credit';
  const remainingOriginalCredit = Math.max(0, Number(sale.store_credit_used || 0) - (sale.salesReturns || []).reduce((sum, row) => sum + Number(row.reinstated_credit_amount || 0), 0));
  const estimatedReinstated = Math.min(estimatedSettlement, remainingOriginalCredit);
  const estimatedCashRefund = Math.max(0, estimatedSettlement - estimatedReinstated);

  const updateRow = (id, changes) => setRows(current => current.map(row => row.id === id ? { ...row, ...changes } : row));

  const submit = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedRows.length) return message.error('Enter a return quantity for at least one item.');
      setSaving(true);
      const response = await client.post(`/retail-sales/${sale.id}/returns`, {
        ...values,
        settlement_type: settlementType,
        items: selectedRows.map(row => ({
          retail_sale_item_id: row.id,
          quantity: Number(row.quantity),
          restock_quantity: Number(row.quantity)
        }))
      });
      message.success(`Return ${response.data.return_number} posted. ${money(response.data.receivable_offset_amount)} reduced from the invoice, ${money(response.data.refund_amount)} refunded, ${money(response.data.store_credit_amount)} added to store credit.`);
      await onCreated?.(response.data);
      onClose();
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.response?.data?.message || 'Could not post the sales return');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Product',
      render: (_, row) => {
        const item = saleItems.get(row.id);
        const variant = item?.finishedGood;
        const packingMaterial = item?.packagingMaterial;
        return <div><strong>{packingMaterial?.name || variant?.product?.name || variant?.name || 'Product'}</strong><br /><Text type="secondary">{packingMaterial ? `${packingMaterial.sku || 'Packing material'} · ${packingMaterial.unit || 'pcs'}` : variant?.size_label || variant?.sku || 'Variant'}</Text></div>;
      }
    },
    {
      title: 'Available to return',
      width: 150,
      render: (_, row) => <span>{quantity(row.returnable)}</span>
    },
    { title: 'Original net / unit', width: 150, render: (_, row) => { const item = saleItems.get(row.id); return money(Number(item?.total || 0) / Number(item?.quantity || 1)); } },
    { title: 'Discount / unit', width: 145, render: (_, row) => { const item = saleItems.get(row.id); const unitDiscount = (Number(item?.quantity || 0) * Number(item?.unit_price || 0) + Number(item?.tax_amount || 0) - Number(item?.total || 0)) / Number(item?.quantity || 1); return money(unitDiscount); } },
    {
      title: 'Return quantity (will be restocked)',
      width: 170,
      render: (_, row) => <InputNumber min={0} max={row.returnable} precision={4} value={row.quantity} onChange={value => updateRow(row.id, { quantity: Number(value || 0) })} style={{ width: '100%' }} />
    }
  ];

  return <Modal
    title={`${isStoreCredit ? 'Store credit' : 'Refund'} · ${sale.sale_number || 'sale'}`}
    open={open}
    onCancel={() => !saving && onClose()}
    onOk={submit}
    okText={`Post ${isStoreCredit ? 'store credit' : 'refund'} return`}
    okButtonProps={{ danger: true, disabled: !selectedRows.length }}
    confirmLoading={saving}
    width={900}
    destroyOnHidden
    maskClosable={!saving}
  >
    <Alert
      showIcon
      type="warning"
      message="Original invoice discounts and tax are preserved"
      description="The return first reduces any unpaid balance. The remaining value follows the selected settlement. Returned quantities are automatically added back to stock."
      style={{ marginBottom: 16 }}
    />
    <Table rowKey="id" dataSource={rows.filter(row => row.returnable > 0.00005)} columns={columns} pagination={false} scroll={{ x: 700 }} size="small" />
    <Form form={form} layout="vertical" style={{ marginTop: 18 }}>
      {!isStoreCredit && estimatedCashRefund > 0 && <Form.Item name="refund_payment_method_id" label="Refund method" rules={[{ required: true, message: 'Select the refund method' }]}>
        <Select placeholder="Select how the customer was refunded" options={methodsQuery.data.map(method => ({ value: method.id, label: `${method.name} · ${method.account?.name || 'Cash / Bank'}` }))} loading={methodsQuery.loading} />
      </Form.Item>}
      <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Select a return reason' }]}>
        <Select showSearch placeholder="Select a reason" options={['Customer return', 'Wrong product', 'Damaged product', 'Billing correction', 'Other'].map(value => ({ value, label: value }))} />
      </Form.Item>
      <Form.Item name="notes" label="Notes (optional)"><Input.TextArea rows={3} maxLength={2000} placeholder="Condition, approval, or correction details" /></Form.Item>
    </Form>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#fafafa', borderRadius: 8 }}>
      <Text type="secondary">Estimated return {money(estimatedRefund)} · unpaid balance reduced {money(estimatedOffset)}. Final cents use the invoice’s exact discount and tax allocation.</Text>
      <Tag color={isStoreCredit ? 'gold' : 'red'} style={{ margin: 0, fontSize: 14, padding: '4px 10px' }}>{isStoreCredit ? 'Store credit' : 'Cash refund'} {money(isStoreCredit ? estimatedSettlement : estimatedCashRefund)}</Tag>
    </div>
    {!isStoreCredit && estimatedReinstated > 0 && <Text type="secondary">About {money(estimatedReinstated)} of store credit used on the original sale will be restored first.</Text>}
  </Modal>;
}
