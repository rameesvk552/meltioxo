import React, { useState } from 'react';
import { Table, Card, Row, Col, Statistic, Tag, Input, Button, Space, message } from 'antd';
import { SearchOutlined, PlusOutlined, ExperimentOutlined, CloseCircleOutlined, CheckCircleOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import ResponsiveDataTable from '../../components/common/ResponsiveDataTable';
import ResponsiveListPageHeader from '../../components/common/ResponsiveListPageHeader';

export default function Formulas() {
  const navigate = useNavigate();
  const { data, loading, reload } = useApiData('/formulas');
  const formulas = data.map(item => ({
    ...item,
    output: Number(item.output_quantity || 0),
    unit: item.output_unit || '',
    ingredients: item.formulaIngredients?.length || 0,
    packaging: item.formulaPackagings?.length || 0,
    cost: Number(item.calculated_cost || 0),
    status: item.is_active ? 'Active' : 'Inactive'
  }));
  const [searchText, setSearchText] = useState('');

  const toggleStatus = async (id) => {
    const selected = formulas.find(item => item.id === id);
    await client.put(`/formulas/${id}`, { is_active: selected?.status !== 'Active' });
    await reload();
    message.success('Formula status updated');
  };

  const filteredFormulas = formulas.filter(f => 
    f.name.toLowerCase().includes(searchText.toLowerCase()) || 
    f.code.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code', render: text => <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{text}</span> },
    { title: 'Formula Name', dataIndex: 'name', key: 'name' },
    { title: 'Batch Size', key: 'batchSize', render: (_, record) => `${record.output} ${record.unit}` },
    { title: 'Ingredients', dataIndex: 'ingredients', key: 'ingredients', align: 'center' },
    { title: 'Packaging Items', dataIndex: 'packaging', key: 'packaging', align: 'center', responsive: ['md'] },
    { title: 'Est. Cost', dataIndex: 'cost', key: 'cost', align: 'right', render: v => `₹${v.toLocaleString()}` },
    { title: 'Unit Cost', key: 'unitCost', align: 'right', render: (_, record) => `₹${Math.round(record.cost / record.output).toLocaleString()}/L` },
    { title: 'Version', dataIndex: 'version', key: 'version', responsive: ['lg'] },
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
        <Space size="small">
          <Button type="text" icon={<EyeOutlined />} style={{ color: 'var(--color-gold)' }} onClick={() => navigate(`/app/formulas/${record.id}`)} />
          {record.status === 'Active' ? (
            <Button type="text" danger icon={<CloseCircleOutlined />} onClick={() => toggleStatus(record.id)}>Deactivate</Button>
          ) : (
            <Button type="text" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }} onClick={() => toggleStatus(record.id)}>Activate</Button>
          )}
        </Space>
      )
    }
  ];
  const summary = (
    <Row gutter={[12, 12]}>
      <Col span={12}><Card size="small"><Statistic title="Total Recipes" value={formulas.length} /></Card></Col>
      <Col span={12}><Card size="small"><Statistic title="Active Formulas" value={formulas.filter(x => x.status === 'Active').length} /></Card></Col>
      <Col span={12}><Card size="small"><Statistic title="Avg Cost / Unit" value={formulas.length ? Math.round(formulas.reduce((s, x) => s + (x.output ? x.cost / x.output : 0), 0) / formulas.length) : 0} prefix="₹" /></Card></Col>
      <Col span={12}><Card size="small"><Statistic title="Latest Version" value={formulas.length ? Math.max(...formulas.map(item => Number(item.version || 0))) : 0} /></Card></Col>
    </Row>
  );
  const filters = <Input placeholder="Search formulas..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} />;

  return (
    <div style={{ padding: 24 }}>
      <ResponsiveListPageHeader title="Formulas" summary={summary} filters={filters} activeFilterCount={searchText ? 1 : 0} onReset={() => setSearchText('')} primaryAction={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/formulas/new')}>New Formula</Button>} />

      <Row className="page-summary-inline" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="Total Recipes" value={formulas.length} prefix={<ExperimentOutlined />} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="Active Formulas" value={formulas.filter(x => x.status === 'Active').length} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="Avg Cost / Unit" value={formulas.length ? Math.round(formulas.reduce((s, x) => s + (x.output ? x.cost / x.output : 0), 0) / formulas.length) : 0} prefix="₹" />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="Latest Version" value={formulas.length ? Math.max(...formulas.map(item => Number(item.version || 0))) : 0} />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Input className="page-filter-inline"
            placeholder="Search formulas..." 
            prefix={<SearchOutlined />} 
            value={searchText} 
            onChange={e => setSearchText(e.target.value)} 
            style={{ width: 250 }} 
          />
        </div>

        <ResponsiveDataTable columns={columns} dataSource={filteredFormulas} loading={loading} emptyText="No formulas found" mobileRenderItem={(formula) => (
          <><div className="mobile-data-list__title-row"><strong>{formula.name}</strong><Tag color={formula.status === 'Active' ? 'success' : 'default'}>{formula.status}</Tag></div><span className="mobile-data-list__code">{formula.code} · {formula.output} {formula.unit}</span><div className="mobile-data-list__metrics"><span>Ingredients <strong>{formula.ingredients}</strong></span><span>Est. cost <strong>₹{formula.cost.toLocaleString()}</strong></span></div><Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/app/formulas/${formula.id}`)} style={{ width: '100%', marginTop: 12 }}>Edit Formula</Button></>
        )} />
      </Card>
    </div>
  );
}
