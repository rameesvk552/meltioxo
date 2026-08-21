import React from 'react';
import { Card, Form, Select, DatePicker, Input, Button, Row, Col, Typography, InputNumber } from 'antd';
import { SaveOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ExpenseForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { data: accounts } = useApiData('/accounts');
  const { data: paymentMethods } = useApiData('/accounts/payment-methods');
  const expenseAccounts = accounts.filter(item => item.type === 'expense' && !item.is_group && item.is_active !== false);

  const onFinish = async (values) => {
    await client.post('/expenses', {
      account_id: values.account,
      category: values.category,
      amount: values.amount,
      expense_date: values.date.format('YYYY-MM-DD'),
      payment_method_id: values.paymentMethod,
      description: values.description
    });
    navigate('/app/expenses');
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>Record Expense</Title>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Card style={{ maxWidth: 800 }}>
          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item name="account" label={<span >Expense Account</span>} rules={[{ required: true }]}>
                <Select placeholder="Select Account">
                  {expenseAccounts.map(account => <Option key={account.id} value={account.id}>{account.code} - {account.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="category" label={<span >Category</span>} rules={[{ required: true }]}>
                <Select placeholder="Select Category">
                  <Option value="Manufacturing">Manufacturing</Option>
                  <Option value="Overhead">Overhead</Option>
                  <Option value="Administrative">Administrative</Option>
                  <Option value="Marketing">Marketing</Option>
                  <Option value="Other">Other</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="amount" label={<span >Amount (₹)</span>} rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="date" label={<span >Date</span>} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="paymentMethod" label={<span >Payment Method</span>} rules={[{ required: true }]}>
                  <Select placeholder="Select payment method">
                    {paymentMethods.map(method => <Option key={method.id} value={method.id}>{method.name}{method.account ? ` — ${method.account.name}` : ''}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            <Col xs={24}>
              <Form.Item name="description" label={<span >Description</span>} rules={[{ required: true }]}>
                <TextArea rows={3} placeholder="Enter expense details" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 24 }}>
            <Button icon={<SaveOutlined />}>
              Save Draft
            </Button>
            <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} >
              Submit for Approval
            </Button>
          </div>
        </Card>
      </Form>
    </div>
  );
};

export default ExpenseForm;
