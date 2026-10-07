import React from 'react';
import { useState } from 'react';
import { Alert, Card, Form, Select, DatePicker, Input, Button, Row, Col, Typography, InputNumber, Segmented, message } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ExpenseForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [posting, setPosting] = useState(false);
  const [recordType, setRecordType] = useState('expense');
  const { data: accounts } = useApiData('/accounts');
  const { data: paymentMethods } = useApiData('/accounts/payment-methods');
  const expenseAccounts = accounts.filter(item => item.type === 'expense' && !item.is_group && item.is_active !== false);
  const liabilityAccounts = accounts.filter(item => item.type === 'liability' && !item.is_group && item.is_active !== false);

  const changeRecordType = value => {
    setRecordType(value);
    form.resetFields(['account', 'category']);
  };

  const onFinish = async (values) => {
    if (posting) return;
    setPosting(true);
    try {
      if (recordType === 'liability-payment') {
        const { data } = await client.post('/journal-entries/liability-payment', {
          liability_account_id: values.account,
          amount: values.amount,
          payment_date: values.date.format('YYYY-MM-DD'),
          payment_method_id: values.paymentMethod,
          narration: values.description
        });
        message.success(`Liability payment posted as ${data.entry_number}`);
        navigate(`/app/journal-entries?entry=${data.id}`);
      } else {
        await client.post('/expenses', {
          account_id: values.account,
          category: values.category,
          amount: values.amount,
          expense_date: values.date.format('YYYY-MM-DD'),
          payment_method_id: values.paymentMethod,
          description: values.description
        });
        message.success('Expense posted successfully');
        navigate('/app/expenses');
      }
    } catch (error) {
      message.error(error.response?.data?.message || (recordType === 'expense' ? 'Could not post the expense' : 'Could not post the liability payment'));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="standard-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>{recordType === 'expense' ? 'Record Expense' : 'Pay a Liability'}</Title>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Segmented
          aria-label="Transaction type"
          value={recordType}
          options={[{ label: 'Expense', value: 'expense' }, { label: 'Liability payment', value: 'liability-payment' }]}
          onChange={changeRecordType}
        />
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ date: dayjs() }}>
        <Card style={{ maxWidth: 800 }}>
          {recordType === 'liability-payment' && <Alert
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
            message="This payment reduces the selected liability and the chosen cash or bank balance."
          />}
          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item name="account" label={recordType === 'expense' ? 'Expense Account' : 'Liability Account'} rules={[{ required: true }]}>
                <Select placeholder="Select Account" showSearch optionFilterProp="children">
                  {(recordType === 'expense' ? expenseAccounts : liabilityAccounts).map(account => <Option key={account.id} value={account.id}>{account.code} - {account.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            {recordType === 'expense' && <Col xs={24} sm={12}>
              <Form.Item name="category" label={<span >Category</span>} rules={[{ required: true }]}>
                <Select placeholder="Select Category">
                  <Option value="Manufacturing">Manufacturing</Option>
                  <Option value="Overhead">Overhead</Option>
                  <Option value="Administrative">Administrative</Option>
                  <Option value="Marketing">Marketing</Option>
                  <Option value="Other">Other</Option>
                </Select>
              </Form.Item>
            </Col>}
            <Col xs={24} sm={12}>
              <Form.Item name="amount" label={<span >Amount (₹)</span>} rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="date" label={<span >Date</span>} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" disabledDate={date => date && date.isAfter(dayjs(), 'day')} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="paymentMethod" label={<span >Payment Method</span>} rules={[{ required: true }]}>
                  <Select placeholder="Select payment method" showSearch optionFilterProp="children">
                    {paymentMethods.map(method => <Option key={method.id} value={method.id}>{method.name}{method.account ? ` — ${method.account.name}` : ''}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            <Col xs={24}>
              <Form.Item name="description" label={recordType === 'expense' ? 'Description' : 'Payment details'} rules={[{ required: true }]}>
                <TextArea rows={3} placeholder={recordType === 'expense' ? 'Enter expense details' : 'Describe this liability payment'} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 24 }}>
            <Button onClick={() => navigate('/app/expenses')} disabled={posting}>Cancel</Button>
            <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} loading={posting}>
              {recordType === 'expense' ? 'Post Expense' : 'Post Liability Payment'}
            </Button>
          </div>
        </Card>
      </Form>
    </div>
  );
};

export default ExpenseForm;
