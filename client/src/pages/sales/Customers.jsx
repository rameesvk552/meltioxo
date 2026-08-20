import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Tag, Input, Button } from 'antd';
import { SearchOutlined, PlusOutlined, UserOutlined, GlobalOutlined, DollarOutlined } from '@ant-design/icons';
import useApiData from '../../hooks/useApiData';
import ResponsiveDataTable from '../../components/common/ResponsiveDataTable';
import ResponsiveListPageHeader from '../../components/common/ResponsiveListPageHeader';

const Customers = () => {
  const [searchText, setSearchText] = useState('');
  const { data, loading } = useApiData('/customers');
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
      dataIndex: 'outstanding', 
      key: 'outstanding',
      render: (val) => (
        <span style={{ color: val > 0 ? '#ff4d4f' : 'inherit' }}>
          ₹{val.toLocaleString('en-IN')}
        </span>
      ),
      sorter: (a, b) => a.outstanding - b.outstanding
    },
    { 
      title: 'Credit Limit', 
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
        <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
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
  const filters = <Input placeholder="Search customers..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} />;

  return (
    <div style={{ padding: 24 }}>
      <ResponsiveListPageHeader title="Customers" summary={summary} filters={filters} activeFilterCount={searchText ? 1 : 0} onReset={() => setSearchText('')} primaryAction={<Button type="primary" icon={<PlusOutlined />}>Add Customer</Button>} />
      
      <Row className="page-summary-inline" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Total Customers</span>} value={customerRows.length} prefix={<UserOutlined />} styles={{ content: { color: 'var(--color-text-primary)' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Active Customers</span>} value={customerRows.filter(item => item.status === 'Active').length} prefix={<GlobalOutlined />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={24} lg={8}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Outstanding Receivable</span>} value={customerRows.reduce((sum, item) => sum + item.outstanding, 0)} prefix={<DollarOutlined />} styles={{ content: { color: '#ff4d4f' } }} />
          </Card>
        </Col>
      </Row>

      <Card >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
          <Input className="page-filter-inline"
            placeholder="Search customers..." 
            prefix={<SearchOutlined />} 
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
          <Button className="desktop-only" type="primary" icon={<PlusOutlined />} >
            Add Customer
          </Button>
        </div>
        
        <ResponsiveDataTable columns={columns} dataSource={filteredData} loading={loading} scroll={{ x: 'max-content' }} emptyText="No customers found" mobileRenderItem={(customer) => <><div className="mobile-data-list__title-row"><strong>{customer.name}</strong><Tag color={customer.status === 'Active' ? 'green' : 'red'}>{customer.status}</Tag></div><span className="mobile-data-list__code">{customer.contact || customer.phone || 'No contact'}</span><div className="mobile-data-list__metrics"><span>Outstanding <strong>₹{customer.outstanding.toLocaleString('en-IN')}</strong></span><span>Terms <strong>{customer.terms || '—'}</strong></span></div></>} />
      </Card>
    </div>
  );
};

export default Customers;
