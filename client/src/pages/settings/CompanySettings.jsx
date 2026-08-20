import React from 'react';
import { Card, Form, Input, Button, Row, Col, Typography, Tabs, Select, Upload, Table, Space, Tag } from 'antd';
import { SaveOutlined, UploadOutlined, PlusOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const CompanySettings = () => {
  const [formCompany] = Form.useForm();
  const [formPrefs] = Form.useForm();
  const { data: tenant } = useApiData('/tenant/settings', { initialData: {} });
  const { data: userData, loading } = useApiData('/users');
  const users = userData.map(item => ({
    ...item,
    role: item.role || '—',
    status: item.is_active === false ? 'Inactive' : 'Active'
  }));

  React.useEffect(() => {
    formCompany.setFieldsValue({ name: tenant.name, email: tenant.email, phone: tenant.phone, taxId: tenant.tax_id });
    formPrefs.setFieldsValue({
      currency: tenant.currency,
      taxSystem: tenant.tax_system,
      fyStart: tenant.fy_start_month,
      dateFormat: tenant.date_format
    });
  }, [tenant, formCompany, formPrefs]);

  const handleSaveCompany = async (values) => {
    await client.put('/tenant/settings', {
      name: values.name, email: values.email, phone: values.phone, tax_id: values.taxId
    });
  };

  const handleSavePrefs = async (values) => {
    await client.put('/tenant/settings', {
      currency: values.currency,
      tax_system: values.taxSystem,
      fy_start_month: values.fyStart,
      date_format: values.dateFormat
    });
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
                <div style={{ width: 150, height: 150, background: 'rgba(255,255,255,0.1)', border: '1px dashed #30363d', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <UserOutlined style={{ fontSize: 48, color: '#8b949e' }} />
                </div>
                <Upload showUploadList={false}>
                  <Button icon={<UploadOutlined />}>Upload Logo</Button>
                </Upload>
              </div>
            </Col>
          </Row>
          <div style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} >
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
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', marginBottom: 24 }}>Company Settings</Title>

      <Card >
        <Tabs items={items} />
      </Card>
      
      <style>{`
        .ant-tabs-tab { color: #8b949e !important; }
        .ant-tabs-tab-active .ant-tabs-tab-btn { color: var(--color-gold) !important; }
        .ant-tabs-ink-bar { background: var(--color-gold) !important; }
      `}</style>
    </div>
  );
};

export default CompanySettings;
