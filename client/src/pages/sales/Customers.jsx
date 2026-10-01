import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Tag, Input, Button, Modal, Form, InputNumber, message } from 'antd';
import { SearchOutlined, PlusOutlined, UserOutlined, GlobalOutlined, DollarOutlined } from '@ant-design/icons';
import useApiData from '../../hooks/useApiData';
import ResponsiveDataTable from '../../components/common/ResponsiveDataTable';
import ResponsiveListPageHeader from '../../components/common/ResponsiveListPageHeader';
import client from '../../api/client';

const Customers = () => {
  const [searchText, setSearchText] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const { data, loading, reload } = useApiData('/customers');
  const createCustomer = async values => {
    setSaving(true);
    try {
      await client.post('/customers', { ...values, name: values.name.trim(), email: values.email?.trim() || null, phone: values.phone?.trim() || null });
      await reload();
      form.resetFields();
      setCreateOpen(false);
      message.success('Customer created');
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not create customer. Check the details and try again.');
    } finally {
      setSaving(false);
    }
  };
  const customerRows = data.map(item => ({
    ...item,
    contact: item.contact_person || '',
    terms: item.payment_terms ? `Net ${item.payment_terms}` : '',
    outstanding: Number(item.outstanding || 0),
    creditLimit: Number(item.credit_limit || 0),
    status: item.is_active === false ? 'Inactive' : 'Active'
  }));

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Contact', dataIndex: 'contact', key: 'contact', responsive: ['lg'] },
    { title: 'Email', dataIndex: 'email', key: 'email', responsive: ['lg'] },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', responsive: ['md'] },
    { title: 'Payment Terms', dataIndex: 'terms', key: 'terms', responsive: ['xl'] },
    { 
      title: 'Outstanding',
      align: 'right',
      dataIndex: 'outstanding', 
      key: 'outstanding',
      render: (val) => (
        <span style={{ color: val > 0 ? 'var(--color-error)' : 'inherit' }}>
          ₹{val.toLocaleString('en-IN')}
        </span>
      ),
      sorter: (a, b) => a.outstanding - b.outstanding
    },
    { 
      title: 'Credit Limit',
      align: 'right',
      dataIndex: 'creditLimit', 
      key: 'creditLimit',
      render: (val) => `₹${val.toLocaleString('en-IN')}`,
      responsive: ['xl']
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => (
        <Tag color={status === 'Active' ? 'success' : 'default'}>{status}</Tag>
      ),
      filters: [
        { text: 'Active', value: 'Active' },
        { text: 'Inactive', value: 'Inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    }
  ];

  const filteredData = customerRows.filter(item => 
    item.name.toLowerCase().includes(searchText.toLowerCase()) ||
    item.contact.toLowerCase().includes(searchText.toLowerCase())
  );
  const summary = <Row gutter={[12, 12]}><Col span={12}><Card size="small"><Statistic title="Total Customers" value={customerRows.length} /></Card></Col><Col span={12}><Card size="small"><Statistic title="Active Customers" value={customerRows.filter(item => item.status === 'Active').length} /></Card></Col><Col span={24}><Card size="small"><Statistic title="Outstanding Receivable" value={customerRows.reduce((sum, item) => sum + item.outstanding, 0)} prefix="₹" /></Card></Col></Row>;
  const filters = <Input aria-label="Search customers" allowClear placeholder="Search customers" prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} />;

  return (
    <div className="standard-page">
      <ResponsiveListPageHeader title="Customers" summary={summary} filters={filters} activeFilterCount={searchText ? 1 : 0} onReset={() => setSearchText('')} primaryAction={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Add Customer</Button>} />
      
      <Row className="page-summary-inline" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Total Customers</span>} value={customerRows.length} prefix={<UserOutlined />} styles={{ content: { color: 'var(--color-text-primary)' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Active Customers</span>} value={customerRows.filter(item => item.status === 'Active').length} prefix={<GlobalOutlined />} styles={{ content: { color: 'var(--color-success)' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={24} lg={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Outstanding Receivable</span>} value={customerRows.reduce((sum, item) => sum + item.outstanding, 0)} prefix={<DollarOutlined />} styles={{ content: { color: 'var(--color-error)' } }} />
          </Card>
        </Col>
      </Row>

      <Card >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
          <Input className="page-filter-inline"
            aria-label="Search customers"
            allowClear
            placeholder="Search customers..." 
            prefix={<SearchOutlined />} 
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
        </div>
        
        <ResponsiveDataTable columns={columns} dataSource={filteredData} loading={loading} scroll={{ x: 'max-content' }} emptyText={searchText ? 'No customers match your search' : 'No customers yet. Add one to get started.'} mobileRenderItem={(customer) => <><div className="mobile-data-list__title-row"><strong>{customer.name}</strong><Tag color={customer.status === 'Active' ? 'success' : 'default'}>{customer.status}</Tag></div><span className="mobile-data-list__code">{customer.contact || customer.phone || 'No contact'}</span><div className="mobile-data-list__metrics"><span>Outstanding <strong>₹{customer.outstanding.toLocaleString('en-IN')}</strong></span><span>Terms <strong>{customer.terms || '—'}</strong></span></div></>} />
      </Card>
      <Modal title="Add customer" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Add customer" okButtonProps={{ loading: saving }} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={createCustomer} initialValues={{ payment_terms: 30, credit_limit: 0 }}>
          <Form.Item name="name" label="Customer name" rules={[{ required: true, whitespace: true, message: 'Enter a customer name' }]}><Input autoFocus maxLength={120} /></Form.Item>
          <Form.Item name="contact_person" label="Contact person"><Input maxLength={120} /></Form.Item>
          <Row gutter={16}><Col xs={24} sm={12}><Form.Item name="phone" label="Phone"><Input type="tel" autoComplete="tel" /></Form.Item></Col><Col xs={24} sm={12}><Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email address' }]}><Input type="email" autoComplete="email" /></Form.Item></Col></Row>
          <Row gutter={16}><Col xs={24} sm={12}><Form.Item name="payment_terms" label="Payment terms (days)"><InputNumber min={0} max={365} style={{ width: '100%' }} /></Form.Item></Col><Col xs={24} sm={12}><Form.Item name="credit_limit" label="Credit limit (₹)"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col></Row>
        </Form>
      </Modal>
    </div>
  );
};

export default Customers;
