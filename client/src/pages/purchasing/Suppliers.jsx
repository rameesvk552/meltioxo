import React, { useState } from 'react';
import { Table, Card, Row, Col, Statistic, Tag, Input, Button, Space, Modal, Form, Select, message, Typography } from 'antd';
import { SearchOutlined, PlusOutlined, UserOutlined, MailOutlined, PhoneOutlined, DollarOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import PageDrawerControls from '../../components/common/PageDrawerControls';
import MobileDataList from '../../components/common/MobileDataList';

const { Option } = Select;
const { Text } = Typography;

export default function Suppliers() {
  const navigate = useNavigate();
  const { data, loading, reload } = useApiData('/suppliers');
  const suppliers = data.map(item => ({
    ...item,
    contact: item.contact_person || '',
    terms: `${Number(item.payment_terms || 0)} Days`,
    outstanding: Number(item.outstanding || 0),
    limit: Number(item.credit_limit || 0),
    status: item.is_active === false ? 'Inactive' : 'Active'
  }));
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form] = Form.useForm();

  const handleSearch = (e) => {
    setSearchText(e.target.value);
  };

  const handleAddSupplier = async (values) => {
    const payload = {
      name: values.name,
      contact_person: values.contact,
      email: values.email?.trim() || null,
      phone: values.phone,
      payment_terms: Number.parseInt(values.terms, 10) || 0,
      credit_limit: values.limit || 0,
      is_active: values.status !== 'Inactive'
    };
    if (editingSupplier) await client.put(`/suppliers/${editingSupplier.id}`, payload);
    else await client.post('/suppliers', payload);
    await reload();
    setIsModalOpen(false);
    setEditingSupplier(null);
    form.resetFields();
    message.success(editingSupplier ? 'Supplier updated successfully!' : 'Supplier added successfully!');
  };

  const openEditSupplier = (supplier) => {
    setEditingSupplier(supplier);
    form.setFieldsValue({ name: supplier.name, contact: supplier.contact, email: supplier.email, phone: supplier.phone, terms: supplier.terms, limit: supplier.limit, status: supplier.status });
    setIsModalOpen(true);
  };
  const deleteSupplier = supplier => Modal.confirm({
    title: `Delete ${supplier.name}?`,
    content: 'Delete all purchases and purchase orders for this supplier first.',
    okText: 'Delete supplier', okButtonProps: { danger: true },
    onOk: async () => {
      try { await client.delete(`/suppliers/${supplier.id}`); message.success('Supplier deleted successfully.'); await reload(); }
      catch (error) { message.error(error.response?.data?.message || 'Could not delete supplier.'); }
    }
  });

  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchText.toLowerCase()) || 
                          s.contact.toLowerCase().includes(searchText.toLowerCase()) ||
                          (s.email || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  /* ── Computed stats ── */
  const activeCount = suppliers.filter(s => s.status === 'Active').length;
  const totalOutstanding = suppliers.reduce((s, x) => s + x.outstanding, 0);
  const avgCreditLimit = suppliers.length ? (suppliers.reduce((s, x) => s + x.limit, 0) / suppliers.length) : 0;

  /* ── Drawer content ── */
  const statCardStyle = { border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, background: '#ffffff' };

  const summary = (
    <Row gutter={[12, 12]}>
      <Col span={12}><Card size="small"><Text>Total Suppliers</Text><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{suppliers.length}</div></Card></Col>
      <Col span={12}><Card size="small"><Text>Active</Text><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: '#52c41a' }}>{activeCount}</div></Card></Col>
      <Col span={12}><Card size="small"><Text>Outstanding Payable</Text><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: '#ff4d4f' }}>₹{totalOutstanding.toLocaleString()}</div></Card></Col>
      <Col span={12}><Card size="small"><Text>Avg Credit Limit</Text><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>₹{Math.round(avgCreditLimit).toLocaleString()}</div></Card></Col>
    </Row>
  );

  const filters = (
    <>
      <Input placeholder="Search suppliers..." prefix={<SearchOutlined />} value={searchText} onChange={handleSearch} />
      <Select value={statusFilter} onChange={setStatusFilter} options={[
        { value: 'All', label: 'All Statuses' },
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' },
      ]} />
    </>
  );

  const activeFilterCount = [searchText, statusFilter !== 'All'].filter(Boolean).length;

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (t) => <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{t}</span> },
    { title: 'Contact Person', dataIndex: 'contact', key: 'contact' },
    { title: 'Email', dataIndex: 'email', key: 'email', responsive: ['md'] },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', responsive: ['lg'] },
    { title: 'Terms', dataIndex: 'terms', key: 'terms', responsive: ['lg'] },
    { title: 'Outstanding', dataIndex: 'outstanding', key: 'outstanding', align: 'right', render: v => <span style={{ color: v > 0 ? '#ff4d4f' : 'inherit' }}>₹{v.toLocaleString()}</span> },
    { title: 'Credit Limit', dataIndex: 'limit', key: 'limit', align: 'right', render: v => `₹${v.toLocaleString()}` },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status', 
      render: status => <Tag color={status === 'Active' ? 'success' : 'default'}>{status}</Tag> 
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EyeOutlined />} style={{ color: 'var(--color-gold)' }} onClick={() => navigate(`/app/suppliers/${record.id}`)} />
          <Button type="text" icon={<EditOutlined />} style={{ color: 'var(--color-text-secondary)' }} onClick={() => openEditSupplier(record)} />
          <Button type="text" danger icon={<DeleteOutlined />} aria-label="Delete supplier" onClick={() => deleteSupplier(record)} />
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>Suppliers</h1>
        </div>
        <Space>
          <PageDrawerControls
            title="Suppliers"
            summary={summary}
            filters={filters}
            activeFilterCount={activeFilterCount}
            onReset={() => { setSearchText(''); setStatusFilter('All'); }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
            Add Supplier
          </Button>
        </Space>
      </div>

      <Row className="page-summary-inline" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}>
          <div style={statCardStyle}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Total Suppliers</Text>
            <Text style={{ color: 'inherit', fontSize: 24, fontWeight: 600 }}>{suppliers.length}</Text>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div style={statCardStyle}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Active Suppliers</Text>
            <Text style={{ color: '#52c41a', fontSize: 24, fontWeight: 600 }}>{activeCount}</Text>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div style={statCardStyle}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Outstanding Payable</Text>
            <Text style={{ color: '#ff4d4f', fontSize: 24, fontWeight: 600 }}>₹{totalOutstanding.toLocaleString()}</Text>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div style={statCardStyle}>
            <Text style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Avg Credit Limit</Text>
            <Text style={{ color: 'inherit', fontSize: 24, fontWeight: 600 }}>₹{Math.round(avgCreditLimit).toLocaleString()}</Text>
          </div>
        </Col>
      </Row>

      <Card>
        <Space className="page-filter-inline" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input 
            placeholder="Search suppliers..." 
            prefix={<SearchOutlined />} 
            value={searchText} 
            onChange={handleSearch} 
            style={{ width: 250 }} 
          />
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }}>
            <Option value="All">All Statuses</Option>
            <Option value="Active">Active</Option>
            <Option value="Inactive">Inactive</Option>
          </Select>
        </Space>

        <div className="mobile-table-alternative">
          <MobileDataList items={filteredSuppliers} emptyText="No suppliers found" renderItem={(supplier) => (
            <>
              <div className="mobile-data-list__title-row">
                <strong>{supplier.name}</strong>
                <Tag color={supplier.status === 'Active' ? 'success' : 'default'}>{supplier.status}</Tag>
              </div>
              <span className="mobile-data-list__code">{supplier.contact}</span>
              <div className="mobile-data-list__metrics">
                <span>Outstanding <strong style={{ color: supplier.outstanding > 0 ? '#ff4d4f' : 'inherit' }}>₹{supplier.outstanding.toLocaleString()}</strong></span>
                <span>Limit <strong>₹{supplier.limit.toLocaleString()}</strong></span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <Button icon={<EyeOutlined />} onClick={() => navigate(`/app/suppliers/${supplier.id}`)}>View</Button>
                <Button type="primary" icon={<EditOutlined />} onClick={() => openEditSupplier(supplier)}>Edit</Button>
                <Button danger icon={<DeleteOutlined />} onClick={() => deleteSupplier(supplier)}>Delete</Button>
              </div>
            </>
          )} />
        </div>
        <div className="desktop-table-only">
          <Table dataSource={filteredSuppliers} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
        </div>
      </Card>

      <Modal
        title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); setEditingSupplier(null); form.resetFields(); }}
        footer={null}
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={handleAddSupplier}>
          <Form.Item name="name" label="Company Name" rules={[{ required: true, message: 'Please enter company name' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contact" label="Contact Person" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item name="email" label="Email Address (optional)" rules={[{ type: 'email', message: 'Enter a valid email address' }]}>
            <Input prefix={<MailOutlined />} />
          </Form.Item>
          <Form.Item name="phone" label="Phone Number" rules={[{ required: true }]}>
            <Input prefix={<PhoneOutlined />} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="terms" label="Payment Terms" defaultValue="30 Days">
                <Select>
                  <Option value="15 Days">15 Days</Option>
                  <Option value="30 Days">30 Days</Option>
                  <Option value="45 Days">45 Days</Option>
                  <Option value="60 Days">60 Days</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="limit" label="Credit Limit (₹)">
                <Input type="number" prefix="₹" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="Status" initialValue="Active">
            <Select>
              <Option value="Active">Active</Option>
              <Option value="Inactive">Inactive</Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setIsModalOpen(false); setEditingSupplier(null); form.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit">{editingSupplier ? 'Update' : 'Submit'}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
