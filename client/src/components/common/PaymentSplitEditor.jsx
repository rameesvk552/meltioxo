import React, { useEffect, useState } from 'react';
import { Button, InputNumber, Select, Tag } from 'antd';
import { CreditCardOutlined, DeleteOutlined, DollarCircleOutlined, PlusOutlined, QrcodeOutlined, SplitCellsOutlined } from '@ant-design/icons';
import './PaymentSplitEditor.css';

const cents = value => Math.round(Number(value || 0) * 100);
const amount = centsValue => centsValue / 100;
const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function PaymentSplitEditor({ paymentMethods, total, value, onChange, compact = false, quick = false, cashTendered = 0, onCashTenderedChange }) {
  const totalCents = cents(total);
  const [multiPayOpen, setMultiPayOpen] = useState(false);
  const findQuickMethod = (type, name) => paymentMethods.find(method => String(method.method_type || '').toUpperCase() === type)
    || paymentMethods.find(method => String(method.name || '').toLowerCase().includes(name));
  const quickOptions = [
    { type: 'CASH', label: 'Cash', icon: <DollarCircleOutlined />, method: findQuickMethod('CASH', 'cash') },
    { type: 'UPI', label: 'UPI', icon: <QrcodeOutlined />, method: findQuickMethod('UPI', 'upi') },
    { type: 'CARD', label: 'Card', icon: <CreditCardOutlined />, method: findQuickMethod('CARD', 'card') },
  ];
  const availableQuickOptions = quickOptions.filter(option => option.method);
  const cashMethod = quickOptions.find(option => option.type === 'CASH')?.method;
  const defaultMethodId = (quick ? quickOptions.find(option => option.type === 'CASH')?.method?.id : null)
    || paymentMethods.find(method => method.is_default)?.id
    || paymentMethods[0]?.id
    || null;

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

  useEffect(() => {
    if (value.length > 1) setMultiPayOpen(true);
  }, [value.length]);

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

  const chooseQuickMethod = method => {
    if (!method) return;
    setMultiPayOpen(false);
    onChange([{ key: newKey(), payment_method_id: method.id, amount: amount(totalCents) }]);
    onCashTenderedChange?.(method.id === cashMethod?.id ? amount(totalCents) : 0);
  };

  const openMultiPay = () => {
    if (availableQuickOptions.length < 2) return;
    setMultiPayOpen(true);
    const quickIds = availableQuickOptions.map(option => option.method.id);
    const hasQuickAllocation = value.some(row => quickIds.includes(row.payment_method_id) && cents(row.amount) > 0);
    const nextRows = availableQuickOptions.map((option, index) => {
      const existing = value.find(row => row.payment_method_id === option.method.id);
      return {
        key: existing?.key || newKey(),
        payment_method_id: option.method.id,
        amount: existing?.amount ?? (!hasQuickAllocation && index === 0 ? amount(totalCents) : 0),
      };
    });
    onChange(nextRows);
    const nextCashRow = nextRows.find(row => row.payment_method_id === cashMethod?.id);
    if (nextCashRow && cents(cashTendered) <= 0) onCashTenderedChange?.(nextCashRow.amount);
  };

  if (quick) {
    const selectedMethodId = !multiPayOpen && value.length === 1 ? value[0].payment_method_id : null;
    const cashRow = value.find(row => row.payment_method_id === cashMethod?.id);
    const cashDueCents = cents(cashRow?.amount);
    const cashTenderedCents = cents(cashTendered);
    const changeCents = Math.max(0, cashTenderedCents - cashDueCents);
    const shortCents = Math.max(0, cashDueCents - cashTenderedCents);
    const updateQuickAmount = (row, nextValue) => {
      if (row.payment_method_id === cashMethod?.id && cashTenderedCents === cents(row.amount)) {
        onCashTenderedChange?.(nextValue || 0);
      }
      update(row.key, 'amount', nextValue || 0);
    };
    return <div className="payment-quick-editor">
      <div className="payment-quick-buttons">
        {quickOptions.map(option => <Button
          key={option.type}
          type={selectedMethodId === option.method?.id ? 'primary' : 'default'}
          icon={option.icon}
          disabled={!option.method}
          title={option.method ? `Pay full amount by ${option.label}` : `Configure a ${option.label} payment method in Settings`}
          onClick={() => chooseQuickMethod(option.method)}
        >{option.label}</Button>)}
        <Button
          type={multiPayOpen ? 'primary' : 'default'}
          icon={<SplitCellsOutlined />}
          disabled={availableQuickOptions.length < 2}
          onClick={openMultiPay}
        >Multi Pay</Button>
      </div>

      {multiPayOpen && <div className="payment-quick-splits">
        {value.map((row, index) => {
          const method = paymentMethods.find(item => item.id === row.payment_method_id);
          return <div className="payment-quick-split" key={row.key}>
            <span><CreditCardOutlined />{method?.name || `Payment ${index + 1}`}</span>
            <InputNumber
              aria-label={`${method?.name || `Payment ${index + 1}`} amount`}
              min={0}
              precision={2}
              prefix="₹"
              value={row.amount}
              onChange={nextValue => updateQuickAmount(row, nextValue)}
            />
            <Button size="small" type="link" onClick={() => fillBalance(row.key)}>Balance</Button>
          </div>;
        })}
        <div className="payment-quick-status">
          {remainingCents === 0
            ? <Tag color="success">Fully allocated</Tag>
            : <Tag color="error">{remainingCents > 0 ? 'Remaining' : 'Over'} ₹{amount(Math.abs(remainingCents)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Tag>}
        </div>
      </div>}

      {cashDueCents > 0 && <div className="payment-cash-tendered">
        <label><span>Cash received</span><InputNumber min={0} precision={2} prefix="₹" value={cashTendered} onChange={nextValue => onCashTenderedChange?.(nextValue || 0)} /></label>
        <div className={shortCents > 0 ? 'is-short' : 'has-change'}>
          <span>{shortCents > 0 ? 'Still required' : 'Change to return'}</span>
          <strong>₹{amount(shortCents > 0 ? shortCents : changeCents).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>}
    </div>;
  }

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
