import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Checkbox, Form, Input, InputNumber, Modal, Select, Table, Tag, Typography, message } from 'antd';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';

const { Text } = Typography;
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
const quantity = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 });

export default function SalesReturnModal({ sale, open, onClose, onCreated }) {
  const [form] = Form.useForm();
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const methodsQuery = useApiData('/accounts/payment-methods');

  useEffect(() => {
    if (!open) return;
    setRows((sale.retailSaleItems || []).map(item => ({
      id: item.id,
      returnable: Number(item.returnable_quantity ?? item.quantity),
      quantity: 0,
      restock: false
    })));
    form.setFieldsValue({
      refund_payment_method_id: sale.payment_method_id || methodsQuery.data.find(item => item.is_default)?.id,
      reason: undefined,
      notes: ''
    });
  }, [form, methodsQuery.data, open, sale]);

  const saleItems = useMemo(() => new Map((sale.retailSaleItems || []).map(item => [item.id, item])), [sale.retailSaleItems]);
  const selectedRows = rows.filter(row => Number(row.quantity) > 0);
  const estimatedRefund = selectedRows.reduce((sum, row) => {
    const item = saleItems.get(row.id);
    return sum + Number(item?.total || 0) * Number(row.quantity) / Number(item?.quantity || 1);
  }, 0);

  const updateRow = (id, changes) => setRows(current => current.map(row => row.id === id ? { ...row, ...changes } : row));

  const submit = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedRows.length) return message.error('Enter a return quantity for at least one item.');
      setSaving(true);
      const response = await client.post(`/retail-sales/${sale.id}/returns`, {
        ...values,
        items: selectedRows.map(row => ({
          retail_sale_item_id: row.id,
          quantity: Number(row.quantity),
          restock_quantity: row.restock ? Number(row.quantity) : 0
        }))
      });
      message.success(`Return ${response.data.return_number} posted. ${money(response.data.total_amount)} refunded.`);
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
    {
      title: 'Return quantity',
      width: 170,
      render: (_, row) => <InputNumber min={0} max={row.returnable} precision={4} value={row.quantity} onChange={value => updateRow(row.id, { quantity: Number(value || 0), ...(Number(value || 0) ? {} : { restock: false }) })} style={{ width: '100%' }} />
    },
    {
      title: 'Put back in stock',
      width: 160,
      render: (_, row) => <Checkbox checked={row.restock} disabled={!Number(row.quantity)} onChange={event => updateRow(row.id, { restock: event.target.checked })}>Restock</Checkbox>
    }
  ];

  return <Modal
    title={`Return items from ${sale.sale_number || 'sale'}`}
    open={open}
    onCancel={() => !saving && onClose()}
    onOk={submit}
    okText={`Post return · ${money(estimatedRefund)}`}
    okButtonProps={{ danger: true, disabled: !selectedRows.length }}
    confirmLoading={saving}
    width={900}
    destroyOnHidden
    maskClosable={!saving}
  >
    <Alert
      showIcon
      type="warning"
      message="This creates a permanent credit transaction"
      description="The original invoice stays unchanged. The refund is recorded in the open register. Select Restock only when the returned product can be sold again. For a billing correction, return the incorrect items and then create a new sale."
      style={{ marginBottom: 16 }}
    />
    <Table rowKey="id" dataSource={rows.filter(row => row.returnable > 0.00005)} columns={columns} pagination={false} scroll={{ x: 700 }} size="small" />
    <Form form={form} layout="vertical" style={{ marginTop: 18 }}>
      <Form.Item name="refund_payment_method_id" label="Refund method" rules={[{ required: true, message: 'Select the refund method' }]}>
        <Select placeholder="Select how the customer was refunded" options={methodsQuery.data.map(method => ({ value: method.id, label: `${method.name} · ${method.account?.name || 'Cash / Bank'}` }))} loading={methodsQuery.loading} />
      </Form.Item>
      <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Select a return reason' }]}>
        <Select showSearch placeholder="Select a reason" options={['Customer return', 'Wrong product', 'Damaged product', 'Billing correction', 'Other'].map(value => ({ value, label: value }))} />
      </Form.Item>
      <Form.Item name="notes" label="Notes (optional)"><Input.TextArea rows={3} maxLength={2000} placeholder="Condition, approval, or correction details" /></Form.Item>
    </Form>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#fafafa', borderRadius: 8 }}>
      <Text type="secondary">Estimated refund; the posted amount uses the invoice’s exact tax and discount allocation.</Text>
      <Tag color="red" style={{ margin: 0, fontSize: 14, padding: '4px 10px' }}>{money(estimatedRefund)}</Tag>
    </div>
  </Modal>;
}
