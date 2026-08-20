import React, { useState, useCallback, useEffect } from 'react';
import { Card, Form, Select, DatePicker, Input, Button, Row, Col, Typography, InputNumber, Radio, Table, Checkbox, message } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';

const { Title, Text } = Typography;
const { Option } = Select;

const PaymentForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [paymentType, setPaymentType] = useState('Incoming');
  const [partyType, setPartyType] = useState('Customer');
  const [amount, setAmount] = useState(0);
  const [allocations, setAllocations] = useState({});
  const [selectedParty, setSelectedParty] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
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
    if (!partyId) {
      setInvoices([]);
      return;
    }
    setLoadingInvoices(true);
    try {
      const res = await client.get('/payments/unpaid-invoices', {
        params: { party_type: pType.toLowerCase(), party_id: partyId }
      });
      setInvoices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch invoices', err);
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  // When party selection changes, fetch invoices and reset allocations
  const handlePartyChange = (partyId) => {
    setSelectedParty(partyId);
    setAllocations({});
    fetchInvoices(partyId, partyType);
  };

  // When party type changes, reset party selection and invoices
  const handlePartyTypeChange = (newPartyType) => {
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

  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  const unallocated = amount - totalAllocated;

  const onFinish = async (values) => {
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
    }
  };

  const columns = [
    {
      title: '',
      key: 'select',
      width: '5%',
      render: (_, record) => (
        <Checkbox 
          checked={!!allocations[record.id]} 
          onChange={(e) => handleAllocationChange(record.id, record.due, e.target.checked)} 
        />
      )
    },
    { title: 'Invoice No', dataIndex: 'invoice_number', key: 'invoice_number' },
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Invoice Amount', dataIndex: 'amount', key: 'amount', render: val => `₹${val.toLocaleString('en-IN')}` },
    { title: 'Amount Due', dataIndex: 'due', key: 'due', render: val => `₹${val.toLocaleString('en-IN')}` },
    {
      title: 'Payment Applied',
      key: 'applied',
      render: (_, record) => (
        <InputNumber 
          min={0} 
          max={record.due} 
          value={allocations[record.id] || 0} 
          onChange={(val) => handleAllocationChange(record.id, val, true)}
          disabled={!allocations[record.id]}
          style={{ width: '100%' }}
        />
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>Record Payment</Title>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ type: 'Incoming' }}>
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={24}>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="type" label={<span >Payment Type</span>}>
                <Radio.Group onChange={e => handlePaymentTypeChange(e.target.value)} value={paymentType}>
                  <Radio.Button value="Incoming">Incoming</Radio.Button>
                  <Radio.Button value="Outgoing">Outgoing</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="party" label={<span >Select {partyType}</span>} rules={[{ required: true }]}>
                <Select placeholder={`Select ${partyType}`} onChange={handlePartyChange} value={selectedParty}>
                  {(partyType === 'Customer' ? customers : suppliers).map(item => (
                    <Option key={item.id} value={item.id}>{item.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="amount" label={<span >Amount (₹)</span>} rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} value={amount} onChange={value => setAmount(Number(value || 0))} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="date" label={<span >Payment Date</span>} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={6}>
                <Form.Item name="paymentMethod" label={<span >Payment Method</span>} rules={[{ required: true }]}>
                  <Select placeholder="Select payment method">
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
              <div style={{ padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px solid #30363d' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: 'var(--color-text-secondary)' }}>Payment Amount:</Text>
                  <Text style={{ fontWeight: 'bold' }}>₹{amount.toLocaleString('en-IN')}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: 'var(--color-text-secondary)' }}>Amount Allocated:</Text>
                  <Text style={{ fontWeight: 'bold' }}>₹{totalAllocated.toLocaleString('en-IN')}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ color: unallocated >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>Unallocated Amount:</Text>
                  <Text style={{ color: unallocated >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>₹{unallocated.toLocaleString('en-IN')}</Text>
                </div>
              </div>
            </Col>
          </Row>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} disabled={unallocated < 0} >
            Submit Payment
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default PaymentForm;
