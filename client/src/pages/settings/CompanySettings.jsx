import React from 'react';
import { Card, Form, Input, InputNumber, Button, Row, Col, Typography, Tabs, Select, Upload, Table, Space, Tag, Modal, Switch, message } from 'antd';
import { SaveOutlined, UploadOutlined, PlusOutlined, DeleteOutlined, UserOutlined, EditOutlined, CreditCardOutlined } from '@ant-design/icons';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const paymentTypes = ['CASH', 'BANK', 'UPI', 'CARD', 'WALLET', 'GATEWAY', 'OTHER'];
const acceptedLogoTypes = ['image/png', 'image/jpeg', 'image/webp'];
const maxLogoSize = 5 * 1024 * 1024;

const CompanySettings = () => {
  const [formCompany] = Form.useForm();
  const [formPrefs] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [paymentModalOpen, setPaymentModalOpen] = React.useState(false);
  const [editingPayment, setEditingPayment] = React.useState(null);
  const [savingPayment, setSavingPayment] = React.useState(false);
  const [savingCompany, setSavingCompany] = React.useState(false);
  const [logoUrl, setLogoUrl] = React.useState(null);
  const { data: tenant } = useApiData('/tenant/settings', { initialData: {} });
  const { data: userData, loading } = useApiData('/users');
  const { data: paymentMethods, loading: loadingPaymentMethods, reload: reloadPaymentMethods } = useApiData('/accounts/payment-methods?active_only=false');
  const { data: paymentLedgers } = useApiData('/accounts/payment-method-ledgers');
  const users = userData.map(item => ({
    ...item,
    role: item.role || '—',
    status: item.is_active === false ? 'Inactive' : 'Active'
  }));

  React.useEffect(() => {
    formCompany.setFieldsValue({ name: tenant.name, email: tenant.email, phone: tenant.phone, taxId: tenant.tax_id, address: tenant.address });
    setLogoUrl(tenant.logo_url || null);
    formPrefs.setFieldsValue({
      currency: tenant.currency,
      taxSystem: tenant.tax_system,
      fyStart: tenant.fy_start_month,
      dateFormat: tenant.date_format
    });
  }, [tenant, formCompany, formPrefs]);

  const handleSaveCompany = async (values) => {
    try {
      setSavingCompany(true);
      await client.put('/tenant/settings', {
        name: values.name,
        email: values.email,
        phone: values.phone,
        tax_id: values.taxId,
        address: values.address,
        logo_url: logoUrl,
      });
      message.success('Company information saved.');
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not save company information.');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleLogoSelect = (file) => {
    if (!acceptedLogoTypes.includes(file.type)) {
      message.error('Choose a PNG, JPEG, or WebP image.');
      return Upload.LIST_IGNORE;
    }
    if (file.size > maxLogoSize) {
      message.error('The logo must be 5 MB or smaller.');
      return Upload.LIST_IGNORE;
    }

    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result);
    reader.onerror = () => message.error('Could not read that image. Please try another file.');
    reader.readAsDataURL(file);
    return false;
  };

  const handleSavePrefs = async (values) => {
    await client.put('/tenant/settings', {
      currency: values.currency,
      tax_system: values.taxSystem,
      fy_start_month: values.fyStart,
      date_format: values.dateFormat
    });
  };

  const openPaymentMethod = (method = null) => {
    setEditingPayment(method);
    paymentForm.resetFields();
    paymentForm.setFieldsValue(method ? {
      name: method.name,
      methodType: method.method_type,
      accountId: method.account_id,
      isDefault: method.is_default,
      isActive: method.is_active,
      sortOrder: method.sort_order,
    } : { methodType: 'CASH', isDefault: false, isActive: true, sortOrder: paymentMethods.length * 10 + 10 });
    setPaymentModalOpen(true);
  };

  const savePaymentMethod = async () => {
    try {
      const values = await paymentForm.validateFields();
      setSavingPayment(true);
      const payload = {
        name: values.name.trim(),
        method_type: values.methodType,
        account_id: values.accountId,
        is_default: Boolean(values.isDefault),
        is_active: Boolean(values.isActive),
        sort_order: Number(values.sortOrder || 0),
      };
      if (editingPayment) await client.patch(`/accounts/payment-methods/${editingPayment.id}`, payload);
      else await client.post('/accounts/payment-methods', payload);
      message.success(`Payment method ${editingPayment ? 'updated' : 'created'}.`);
      setPaymentModalOpen(false);
      setEditingPayment(null);
      await reloadPaymentMethods();
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.response?.data?.message || 'Could not save the payment method.');
    } finally {
      setSavingPayment(false);
    }
  };

  const userColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Role', dataIndex: 'role', key: 'role', render: val => <Tag color="blue">{val}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: val => <Tag color={val === 'Active' ? 'green' : 'red'}>{val}</Tag> },
    {
      title: 'Action',
      key: 'action',
      render: () => (
        <Space>
          <Button type="link" size="small">Edit</Button>
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Space>
      )
    }
  ];

  const paymentColumns = [
    { title: 'Method', dataIndex: 'name', render: (name, method) => <Space><CreditCardOutlined /><strong>{name}</strong>{method.is_default && <Tag color="gold">Default</Tag>}</Space> },
    { title: 'Type', dataIndex: 'method_type', render: value => <Tag>{value}</Tag> },
    { title: 'Posting ledger', render: (_, method) => method.account ? `${method.account.code} — ${method.account.name}` : 'Not mapped' },
    { title: 'Status', dataIndex: 'is_active', render: active => <Tag color={active ? 'success' : 'default'}>{active ? 'Active' : 'Inactive'}</Tag> },
    { title: 'Order', dataIndex: 'sort_order', width: 80 },
    { title: '', width: 80, render: (_, method) => <Button size="small" icon={<EditOutlined />} onClick={() => openPaymentMethod(method)}>Edit</Button> },
  ];

  const items = [
    {
      key: '1',
      label: 'Company Info',
      children: (
        <Form form={formCompany} layout="vertical" onFinish={handleSaveCompany}>
          <Row gutter={24}>
            <Col xs={24} md={16}>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="name" label={<span >Company Name</span>}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="email" label={<span >Email Address</span>}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="phone" label={<span >Phone Number</span>}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="taxId" label={<span >Tax ID / GSTIN</span>}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="address" label={<span >Registered Address</span>}>
                    <TextArea rows={4} />
                  </Form.Item>
                </Col>
              </Row>
            </Col>
            <Col xs={24} md={8}>
              <div style={{ marginBottom: 16 }}>
                <span style={{ color: '#fff', display: 'block', marginBottom: 8 }}>Company Logo</span>
                <div style={{ width: 150, height: 150, padding: 10, background: 'rgba(255,255,255,0.1)', border: '1px dashed #30363d', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  {logoUrl
                    ? <img src={logoUrl} alt="Company logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <UserOutlined style={{ fontSize: 48, color: '#8b949e' }} />}
                </div>
                <Space wrap>
                  <Upload
                    accept=".png,.jpg,.jpeg,.webp"
                    beforeUpload={handleLogoSelect}
                    maxCount={1}
                    showUploadList={false}
                  >
                    <Button icon={<UploadOutlined />}>{logoUrl ? 'Change Logo' : 'Upload Logo'}</Button>
                  </Upload>
                  {logoUrl && <Button danger icon={<DeleteOutlined />} onClick={() => setLogoUrl(null)}>Remove</Button>}
                </Space>
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                  PNG, JPEG, or WebP. Maximum 5 MB. The logo will appear on invoice headers.
                </Typography.Text>
              </div>
            </Col>
          </Row>
          <div style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={savingCompany}>
              Save Company Info
            </Button>
          </div>
        </Form>
      )
    },
    {
      key: '2',
      label: 'Preferences',
      children: (
        <Form form={formPrefs} layout="vertical" onFinish={handleSavePrefs}>
          <Row gutter={24}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="currency" label={<span >Base Currency</span>}>
                <Select>
                  <Option value="INR">Indian Rupee (₹)</Option>
                  <Option value="USD">US Dollar ($)</Option>
                  <Option value="EUR">Euro (€)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="taxSystem" label={<span >Tax System</span>}>
                <Select>
                  <Option value="GST">GST (India)</Option>
                  <Option value="VAT">VAT</Option>
                  <Option value="SalesTax">Sales Tax</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="fyStart" label={<span >Financial Year Start</span>}>
                <Select>
                  <Option value="January">January</Option>
                  <Option value="April">April</Option>
                  <Option value="July">July</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="dateFormat" label={<span >Date Format</span>}>
                <Select>
                  <Option value="DD/MM/YYYY">DD/MM/YYYY</Option>
                  <Option value="MM/DD/YYYY">MM/DD/YYYY</Option>
                  <Option value="YYYY-MM-DD">YYYY-MM-DD</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <div style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} >
              Save Preferences
            </Button>
          </div>
        </Form>
      )
    },
    {
      key: '3',
      label: 'Users & Roles',
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} >
              Invite User
            </Button>
          </div>
          <Table 
            columns={userColumns} 
            dataSource={users}
            loading={loading}
            rowKey="id" 
            pagination={false} 
            scroll={{ x: 'max-content' }}
          />
        </div>
      )
    },
    {
      key: '4',
      label: 'Payment Methods',
      children: (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
            <Typography.Text type="secondary">Define the methods available in POS and purchases. Every method must post to an active ledger under Cash & Bank.</Typography.Text>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openPaymentMethod()}>Add Method</Button>
          </div>
          <Table columns={paymentColumns} dataSource={paymentMethods} loading={loadingPaymentMethods} rowKey="id" pagination={false} scroll={{ x: 760 }} />
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', marginBottom: 24 }}>Company Settings</Title>

      <Card >
        <Tabs items={items} />
      </Card>

      <Modal
        title={editingPayment ? 'Edit payment method' : 'Add payment method'}
        open={paymentModalOpen}
        onCancel={() => setPaymentModalOpen(false)}
        onOk={savePaymentMethod}
        confirmLoading={savingPayment}
        okText={editingPayment ? 'Save changes' : 'Add method'}
        forceRender
      >
        <Form form={paymentForm} layout="vertical">
          <Row gutter={12}>
            <Col span={14}><Form.Item name="name" label="Display name" rules={[{ required: true, whitespace: true, message: 'Enter a payment method name' }]}><Input placeholder="e.g. UPI, Visa Card, HDFC Bank" /></Form.Item></Col>
            <Col span={10}><Form.Item name="methodType" label="Method type" rules={[{ required: true }]}><Select options={paymentTypes.map(type => ({ value: type, label: type }))} /></Form.Item></Col>
          </Row>
          <Form.Item name="accountId" label="Posting ledger" rules={[{ required: true, message: 'Select the ledger that receives or pays this money' }]} extra="Only active posting ledgers under Cash & Bank are available.">
            <Select showSearch optionFilterProp="label" placeholder="Select Cash or Bank ledger" options={paymentLedgers.map(ledger => ({ value: ledger.id, label: `${ledger.code} — ${ledger.name}` }))} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="sortOrder" label="Display order"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="isDefault" label="Default method" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={8}><Form.Item name="isActive" label="Available" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
      
      <style>{`
        .ant-tabs-tab { color: #8b949e !important; }
        .ant-tabs-tab-active .ant-tabs-tab-btn { color: var(--color-gold) !important; }
        .ant-tabs-ink-bar { background: var(--color-gold) !important; }
      `}</style>
    </div>
  );
};

export default CompanySettings;
