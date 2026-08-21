import React from 'react';
import { Card, Row, Col, Statistic, Tag, Button, Space } from 'antd';
import { PlusOutlined, ShoppingCartOutlined, CheckCircleOutlined, FileTextOutlined, WhatsAppOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';
import ResponsiveDataTable from '../../components/common/ResponsiveDataTable';
import ResponsiveListPageHeader from '../../components/common/ResponsiveListPageHeader';

const SalesOrders = () => {
  const navigate = useNavigate();
  const { data: salesData, loading } = useApiData('/retail-sales');
  const salesRows = salesData.map(item => ({
    ...item,
    customer: item.customer?.name || item.customer_id || '—',
    customerPhone: item.customer?.phone || '',
    date: item.sale_date,
    deliveryDate: item.paymentAccount?.name || 'Cash / Bank',
    items: item.retailSaleItems?.length || 0,
    total: Number(item.total_amount || 0),
    status: item.journal_entry_id ? 'Posted' : 'Pending'
  }));

  const handleWhatsAppShare = (record) => {
    const phone = record.customerPhone;
    if (!phone) return;
    const text = `*Wayon - Sales Invoice*%0A%0A` +
                 `Dear *${record.customer}*,%0A` +
                 `Please find the invoice details for your order *${record.id}*:%0A%0A` +
                 `• *Order Date:* ${record.date}%0A` +
                 `• *Total Amount:* ₹${record.total.toLocaleString('en-IN')}%0A` +
                 `• *Status:* ${record.status}%0A%0A` +
                 `Sale #: ${record.sale_number}%0A%0A` +
                 `Thank you!%0A` +
                 `*Wayon Team*`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${text}`, '_blank');
  };

  const columns = [
    { title: 'Sale #', dataIndex: 'sale_number', key: 'sale_number' },
    { title: 'Customer', dataIndex: 'customer', key: 'customer' },
    { title: 'Sale Date', dataIndex: 'date', key: 'date', responsive: ['md'] },
    { title: 'Received In', dataIndex: 'deliveryDate', key: 'deliveryDate', responsive: ['lg'] },
    { title: 'Items', dataIndex: 'items', key: 'items', responsive: ['lg'] },
    { 
      title: 'Total Amount', 
      dataIndex: 'total', 
      key: 'total',
      render: (val) => `₹${val.toLocaleString('en-IN')}`,
      align: 'right'
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => {
        let color = 'default';
        if (status === 'Draft') color = 'warning';
        if (status === 'Confirmed') color = 'processing';
        if (status === 'Invoiced') color = 'purple';
        if (status === 'Delivered') color = 'success';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/app/retail-sales/${record.id}`)}>View</Button>
          <Button type="text" icon={<FileTextOutlined />} onClick={() => navigate(`/app/retail-sales/${record.id}/invoice`)}>Invoice</Button>
          <Button type="text" icon={<WhatsAppOutlined />} style={{ color: '#25D366' }} onClick={() => handleWhatsAppShare(record)} />
        </Space>
      ),
    },
  ];
  const summary = <Row gutter={[12, 12]}><Col span={12}><Card size="small"><Statistic title="Total Sales" value={salesRows.length} /></Card></Col><Col span={12}><Card size="small"><Statistic title="Revenue" value={salesRows.reduce((sum, row) => sum + row.total, 0)} prefix="₹" /></Card></Col><Col span={12}><Card size="small"><Statistic title="Customers" value={new Set(salesData.map(item => item.customer_id).filter(Boolean)).size} /></Card></Col><Col span={12}><Card size="small"><Statistic title="Average Ticket" value={salesRows.length ? Math.round(salesRows.reduce((sum, row) => sum + row.total, 0) / salesRows.length) : 0} prefix="₹" /></Card></Col></Row>;

  return (
    <div style={{ padding: 24 }}>
      <ResponsiveListPageHeader title="Sales & Invoices" summary={summary} primaryAction={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/retail-sales/new')}>New Sale</Button>} />
      
      <Row className="page-summary-inline" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Total Sales Count</span>} value={salesRows.length} prefix={<ShoppingCartOutlined />} styles={{ content: { color: 'var(--color-text-primary)' } }} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Total Revenue</span>} value={salesRows.reduce((s, x) => s + x.total, 0)} prefix="₹" styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Customers in Orders</span>} value={new Set(salesData.map(item => item.customer_id).filter(Boolean)).size} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#1677ff' } }} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Average Ticket Size</span>} value={salesRows.length ? Math.round(salesRows.reduce((s, x) => s + x.total, 0) / salesRows.length) : 0} prefix="₹" styles={{ content: { color: 'var(--color-gold)' } }} />
          </Card>
        </Col>
      </Row>

      <Card >
        <ResponsiveDataTable columns={columns} dataSource={salesRows} loading={loading} emptyText="No sales found" mobileRenderItem={(sale) => <><div className="mobile-data-list__title-row"><strong>{sale.sale_number || sale.id}</strong><Tag color={sale.status === 'Posted' ? 'success' : 'warning'}>{sale.status}</Tag></div><span className="mobile-data-list__code">{sale.customer} · {sale.items} item{sale.items === 1 ? '' : 's'}</span><div className="mobile-data-list__metrics"><span>Total <strong>₹{sale.total.toLocaleString('en-IN')}</strong></span><span>Date <strong>{sale.date || '—'}</strong></span></div><Space.Compact block style={{ marginTop: 12 }}><Button icon={<EyeOutlined />} onClick={() => navigate(`/app/retail-sales/${sale.id}`)} style={{ width: '50%' }}>View Sale</Button><Button type="primary" icon={<FileTextOutlined />} onClick={() => navigate(`/app/retail-sales/${sale.id}/invoice`)} style={{ width: '50%' }}>Invoice</Button></Space.Compact></>} />
      </Card>
    </div>
  );
};

export default SalesOrders;
