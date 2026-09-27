import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, Form, Select, DatePicker, Input, Button, Row, Col, Typography, InputNumber, Radio, Table, Checkbox, message } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import { money } from '../reports/AccountingUI';

const { Title, Text } = Typography;
const { Option } = Select;

const PaymentForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialType = params.get('type') === 'outgoing' ? 'Outgoing' : 'Incoming';
  const [paymentType, setPaymentType] = useState(initialType);
  const [partyType, setPartyType] = useState(initialType === 'Outgoing' ? 'Supplier' : 'Customer');
  const [amount, setAmount] = useState(0);
  const [allocations, setAllocations] = useState({});
  const [selectedParty, setSelectedParty] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const invoiceRequest = useRef(0);
  useEffect(() => () => { invoiceRequest.current += 1; }, []);
  const { data: customers } = useApiData('/customers');
  const { data: suppliers } = useApiData('/suppliers');
  const { data: paymentMethods } = useApiData('/accounts/payment-methods');

  useEffect(() => {
    if (!form.getFieldValue('paymentMethod') && paymentMethods.length) {
      form.setFieldValue('paymentMethod', (paymentMethods.find(method => method.is_default) || paymentMethods[0]).id);
    }
  }, [form, paymentMethods]);

  // Fetch unpaid invoices whenever the selected party changes
  const fetchInvoices = useCallback(async (partyId, pType) => {
    const request = ++invoiceRequest.current;
    if (!partyId) {
      setInvoices([]);
      return;
    }
    setLoadingInvoices(true);
    try {
      const res = await client.get('/payments/unpaid-invoices', {
        params: { party_type: pType.toLowerCase(), party_id: partyId }
      });
      if (request === invoiceRequest.current) setInvoices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (request === invoiceRequest.current) {
        setInvoices([]);
        message.error(err.response?.data?.message || 'Could not load outstanding invoices');
      }
    } finally {
      if (request === invoiceRequest.current) setLoadingInvoices(false);
    }
  }, []);
  useEffect(() => {
    const partyId = params.get('party_id');
    form.setFieldsValue({ date: dayjs() });
    if (partyId) {
      form.setFieldValue('party', partyId);
      setSelectedParty(partyId);
      fetchInvoices(partyId, initialType === 'Outgoing' ? 'Supplier' : 'Customer');
    }
  }, [params, form, fetchInvoices, initialType]);

  // When party selection changes, fetch invoices and reset allocations
  const handlePartyChange = (partyId) => {
    setSelectedParty(partyId);
    setAllocations({});
    fetchInvoices(partyId, partyType);
  };

  // When party type changes, reset party selection and invoices
  const handlePartyTypeChange = (newPartyType) => {
    invoiceRequest.current += 1;
    setLoadingInvoices(false);
    setPartyType(newPartyType);
    setSelectedParty(null);
    setAllocations({});
    setInvoices([]);
    form.setFieldsValue({ party: undefined });
  };

  const handlePaymentTypeChange = newType => {
    setPaymentType(newType);
    handlePartyTypeChange(newType === 'Incoming' ? 'Customer' : 'Supplier');
  };

  const handleAllocationChange = (id, val, checked) => {
    const newAlloc = { ...allocations };
    if (!checked) {
      delete newAlloc[id];
    } else {
      newAlloc[id] = Number(val || 0);
    }
    setAllocations(newAlloc);
  };

  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + Math.round(Number(val)*100), 0)/100;
  const unallocated = (Math.round(amount*100)-Math.round(totalAllocated*100))/100;

  const onFinish = async (values) => {
    if (saving) return;
    setSaving(true);
    const endpoint = paymentType === 'Incoming' ? '/payments/incoming' : '/payments/outgoing';
    try {
      await client.post(endpoint, {
        party_type: partyType.toLowerCase(),
        party_id: values.party,
        payment_method_id: values.paymentMethod,
        amount: values.amount,
        payment_date: values.date.format('YYYY-MM-DD'),
        reference_number: values.reference,
        notes: values.notes,
        allocations: Object.entries(allocations).map(([invoice_id, allocated_amount]) => {
          const inv = invoices.find(i => i.id === invoice_id);
          return { invoice_id, allocated_amount, invoice_type: inv?.invoice_type || (paymentType === 'Incoming' ? 'sale' : 'purchase') };
        })
      });
      message.success(paymentType === 'Incoming' ? 'Receipt posted to accounts' : 'Payment posted to accounts');
      navigate('/app/payments');
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not record the payment');
    } finally { setSaving(false); }
  };

  const columns = [
    {
      title: '',
      key: 'select',
      width: '5%',
      render: (_, record) => (
        <Checkbox 
          checked={Object.hasOwn(allocations,record.id)}
          onChange={(e) => handleAllocationChange(record.id, record.due, e.target.checked)} 
        />
      )
    },
    { title: 'Invoice No', dataIndex: 'invoice_number', key: 'invoice_number' },
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Invoice Amount', dataIndex: 'amount', key: 'amount', render: money },
    { title: 'Amount Due', dataIndex: 'due', key: 'due', render: money },
    {
      title: 'Payment Applied',
      key: 'applied',
      render: (_, record) => (
        <InputNumber 
          min={0} precision={2} step={0.01}
          max={record.due} 
          value={allocations[record.id] || 0} 
          onChange={(val) => handleAllocationChange(record.id, val, true)}
          disabled={!Object.hasOwn(allocations,record.id)}
          style={{ width: '100%' }}
        />
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>{paymentType === 'Incoming' ? 'Record Receipt' : 'Record Payment'}</Title>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ type: initialType, date: dayjs() }}>
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={24}>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="type" label={<span >Payment Type</span>}>
                <Radio.Group onChange={e => handlePaymentTypeChange(e.target.value)} value={paymentType}>
                  <Radio.Button value="Incoming">Receipt</Radio.Button>
                  <Radio.Button value="Outgoing">Payment</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="party" label={<span >Select {partyType}</span>} rules={[{ required: true }]}>
                <Select placeholder={`Select ${partyType}`} showSearch optionFilterProp="children" onChange={handlePartyChange} value={selectedParty}>
                  {(partyType === 'Customer' ? customers : suppliers).map(item => (
                    <Option key={item.id} value={item.id}>{item.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="amount" label={<span >Amount (₹)</span>} rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0.01} precision={2} value={amount} onChange={value => setAmount(Number(value || 0))} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="date" label={<span >Payment Date</span>} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" disabledDate={date => date && date.isAfter(dayjs(), 'day')} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={6}>
                <Form.Item name="paymentMethod" label={<span >Payment Method</span>} rules={[{ required: true }]}>
                  <Select placeholder="Select payment method" showSearch optionFilterProp="children">
                    {paymentMethods.map(method => (
                      <Option key={method.id} value={method.id}>{method.name}{method.account ? ` — ${method.account.name}` : ''}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="reference" label={<span >Reference Number</span>}>
                <Input placeholder="Txn ID / Cheque No" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title={<span >Allocate to Invoices</span>} style={{ marginBottom: 24 }}>
          <Table 
            columns={columns} 
            dataSource={invoices} 
            pagination={false} 
            rowKey="id"
            loading={loadingInvoices}
            scroll={{ x: 'max-content' }}
            style={{ marginBottom: 16 }}
            locale={{ emptyText: selectedParty ? 'No outstanding invoices found' : 'Select a supplier/customer to view invoices' }}
          />

          <Row justify="end">
            <Col xs={24} sm={12} lg={8}>
              <div style={{ padding: 16, background: '#fcf7f0', borderRadius: 12, border: '1px solid #e8dfd5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: 'var(--color-text-secondary)' }}>Payment Amount:</Text>
                  <Text style={{ fontWeight: 'bold' }}>{money(amount)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: 'var(--color-text-secondary)' }}>Amount Allocated:</Text>
                  <Text style={{ fontWeight: 'bold' }}>{money(totalAllocated)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ color: unallocated >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>Unallocated Amount:</Text>
                  <Text style={{ color: unallocated >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>{money(unallocated)}</Text>
                </div>
              </div>
            </Col>
          </Row>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={() => navigate('/app/payments')} disabled={saving}>Cancel</Button>
          <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} loading={saving} disabled={unallocated < -0.005 || amount <= 0} >
            {paymentType === 'Incoming' ? 'Post receipt' : 'Post payment'}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default PaymentForm;
