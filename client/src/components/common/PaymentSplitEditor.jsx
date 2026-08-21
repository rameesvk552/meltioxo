import React, { useEffect } from 'react';
import { Button, InputNumber, Select, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import './PaymentSplitEditor.css';

const cents = value => Math.round(Number(value || 0) * 100);
const amount = centsValue => centsValue / 100;
const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function PaymentSplitEditor({ paymentMethods, total, value, onChange, compact = false }) {
  const totalCents = cents(total);
  const defaultMethodId = paymentMethods.find(method => method.is_default)?.id || paymentMethods[0]?.id || null;

  useEffect(() => {
    onChange(current => {
      if (!current.length) return [{ key: newKey(), payment_method_id: defaultMethodId, amount: amount(totalCents) }];
      if (current.length === 1) {
        const methodId = current[0].payment_method_id || defaultMethodId;
        if (methodId === current[0].payment_method_id && cents(current[0].amount) === totalCents) return current;
        return [{ ...current[0], payment_method_id: methodId, amount: amount(totalCents) }];
      }
      return current;
    });
  }, [defaultMethodId, onChange, totalCents]);

  const paidCents = value.reduce((sum, row) => sum + cents(row.amount), 0);
  const remainingCents = totalCents - paidCents;
  const usedMethodIds = value.map(row => row.payment_method_id).filter(Boolean);

  const update = (key, field, nextValue) => onChange(current => current.map(row => row.key === key ? { ...row, [field]: nextValue } : row));
  const remove = key => onChange(current => {
    const next = current.filter(row => row.key !== key);
    return next.length === 1 ? [{ ...next[0], amount: amount(totalCents) }] : next;
  });
  const fillBalance = key => onChange(current => {
    const otherCents = current.reduce((sum, row) => row.key === key ? sum : sum + cents(row.amount), 0);
    return current.map(row => row.key === key ? { ...row, amount: amount(Math.max(0, totalCents - otherCents)) } : row);
  });
  const addSplit = () => {
    const nextMethod = paymentMethods.find(method => !usedMethodIds.includes(method.id));
    if (!nextMethod) return;
    onChange(current => [...current, { key: newKey(), payment_method_id: nextMethod.id, amount: amount(Math.max(0, remainingCents)) }]);
  };

  return <div className={`payment-split-editor${compact ? ' is-compact' : ''}`}>
    <div className="payment-split-rows">
      {value.map((row, index) => <div className="payment-split-row" key={row.key}>
        <Select
          aria-label={`Payment method ${index + 1}`}
          placeholder="Payment method"
          value={row.payment_method_id}
          onChange={nextValue => update(row.key, 'payment_method_id', nextValue)}
          options={paymentMethods.map(method => ({
            value: method.id,
            label: `${method.name}${method.account ? ` — ${method.account.name}` : ''}`,
            disabled: method.id !== row.payment_method_id && usedMethodIds.includes(method.id),
          }))}
        />
        <InputNumber
          aria-label={`Payment amount ${index + 1}`}
          min={0}
          precision={2}
          prefix="₹"
          value={row.amount}
          onChange={nextValue => update(row.key, 'amount', nextValue || 0)}
        />
        <Button size="small" type="link" onClick={() => fillBalance(row.key)}>Balance</Button>
        <Button aria-label={`Remove payment ${index + 1}`} type="text" danger size="small" icon={<DeleteOutlined />} disabled={value.length === 1} onClick={() => remove(row.key)} />
      </div>)}
    </div>
    <div className="payment-split-footer">
      <Button type="dashed" size="small" icon={<PlusOutlined />} disabled={paymentMethods.length <= value.length} onClick={addSplit}>Split payment</Button>
      {remainingCents === 0
        ? <Tag color="success">Fully allocated</Tag>
        : <Tag color="error">{remainingCents > 0 ? 'Remaining' : 'Over'} ₹{amount(Math.abs(remainingCents)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Tag>}
    </div>
  </div>;
}
