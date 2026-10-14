import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Tag, Button, DatePicker, Space } from 'antd';
import { PlusOutlined, ShoppingCartOutlined, CheckCircleOutlined, DownloadOutlined, FileTextOutlined, WhatsAppOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';
import ResponsiveDataTable from '../../components/common/ResponsiveDataTable';
import ResponsiveListPageHeader from '../../components/common/ResponsiveListPageHeader';
import { downloadReport } from '../reports/reportDownloads';
import { salesPdfReport, salesSpreadsheet } from './invoiceExport';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const paymentLabel = sale => {
  const payments = (sale.payments || []).filter(payment => Number(payment.amount || 0) > 0);
  if (payments.length > 1) {
    return payments.map(payment => `${payment.paymentMethod?.name || payment.payment_mode || 'Payment'} ${money(payment.amount)}`).join(' + ');
  }
  if (payments.length === 1) return payments[0].paymentMethod?.name || payments[0].payment_mode || 'Payment';
  return sale.paymentAccount?.name || sale.paymentMethod?.name || 'Cash / Bank';
};

const SalesOrders = () => {
  const navigate = useNavigate();
  const { data: salesData, loading, error } = useApiData('/retail-sales');
  const { data: company } = useApiData('/tenant/settings', { initialData: {} });
  const [listRange, setListRange] = useState(null);
  const salesRows = salesData.map(item => ({
    ...item,
    customerDetails: item.customer,
    customer: item.customer?.name || item.customer_id || '—',
    customerPhone: item.customer?.phone || '',
    date: item.sale_date,
    deliveryDate: paymentLabel(item),
    items: item.retailSaleItems?.length || 0,
    total: Number(item.total_amount || 0),
    returned: Number(item.returned_amount || 0),
    netTotal: Number(item.total_amount || 0) - Number(item.returned_amount || 0),
    status: item.return_status === 'full' ? 'Fully returned' : item.return_status === 'partial' ? 'Partially returned' : item.journal_entry_id ? 'Posted' : 'Pending'
  }));
  const visibleSales = salesRows.filter(sale => !listRange ||
    (String(sale.date || '').slice(0, 10) >= listRange[0].format('YYYY-MM-DD')
      && String(sale.date || '').slice(0, 10) <= listRange[1].format('YYYY-MM-DD')));
  const exportRange = listRange ? `${listRange[0].format('YYYY-MM-DD')}-${listRange[1].format('YYYY-MM-DD')}` : 'all';

  const handleWhatsAppShare = (record) => {
    const phone = record.customerPhone;
    if (!phone) return;
    const text = `*Wayon - ${record.gst_scheme === 'COMPOSITION' ? 'Bill of Supply' : record.gst_enabled ? 'Tax Invoice' : 'Sales Invoice'}*%0A%0A` +
                 `Dear *${record.customer}*,%0A` +
                 `Please find the invoice details for your order *${record.id}*:%0A%0A` +
                 `• *Order Date:* ${record.date}%0A` +
                 `• *Net Amount:* ₹${record.netTotal.toLocaleString('en-IN')}%0A` +
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
      title: 'Net Amount',
      dataIndex: 'netTotal',
      key: 'netTotal',
      render: (val, record) => <span>{`₹${val.toLocaleString('en-IN')}`}{record.returned > 0 && <><br /><small style={{ color: '#cf1322' }}>Returned ₹{record.returned.toLocaleString('en-IN')}</small></>}</span>,
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
        if (status === 'Partially returned') color = 'orange';
        if (status === 'Fully returned') color = 'default';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/app/retail-sales/${record.id}`)}>View</Button>
          <Button type="text" icon={<FileTextOutlined />} onClick={() => navigate(`/app/retail-sales/${record.id}/invoice`)}>{record.gst_scheme === 'COMPOSITION' ? 'Bill of supply' : record.gst_enabled ? 'Tax invoice' : 'Invoice'}</Button>
          {record.return_status === 'none' && <Button type="text" icon={<EditOutlined />} onClick={() => navigate(`/app/retail-sales/${record.id}/edit`)}>Edit</Button>}
          <Button type="text" icon={<WhatsAppOutlined />} style={{ color: '#25D366' }} onClick={() => handleWhatsAppShare(record)} />
        </Space>
      ),
    },
  ];
  const summary = <Row gutter={[12, 12]}><Col span={12}><Card size="small"><Statistic title="Total Sales" value={visibleSales.length} /></Card></Col><Col span={12}><Card size="small"><Statistic title="Net Revenue" value={visibleSales.reduce((sum, row) => sum + row.netTotal, 0)} prefix="₹" /></Card></Col><Col span={12}><Card size="small"><Statistic title="Customers" value={new Set(visibleSales.map(item => item.customer_id).filter(Boolean)).size} /></Card></Col><Col span={12}><Card size="small"><Statistic title="Returns" value={visibleSales.reduce((sum, row) => sum + row.returned, 0)} prefix="₹" /></Card></Col></Row>;

  return (
    <div className="standard-page">
      <ResponsiveListPageHeader title="Sales & Invoices" summary={summary} primaryAction={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/retail-sales/new')}>New Sale</Button>} />
      
      <Row className="page-summary-inline" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Total Sales Count</span>} value={visibleSales.length} prefix={<ShoppingCartOutlined />} styles={{ content: { color: 'var(--color-text-primary)' } }} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Net Revenue</span>} value={visibleSales.reduce((s, x) => s + x.netTotal, 0)} prefix="₹" styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Customers in Orders</span>} value={new Set(visibleSales.map(item => item.customer_id).filter(Boolean)).size} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#1677ff' } }} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card >
            <Statistic title={<span style={{ color: 'var(--color-text-secondary)' }}>Returns</span>} value={visibleSales.reduce((s, x) => s + x.returned, 0)} prefix="₹" styles={{ content: { color: '#cf1322' } }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}><DatePicker.RangePicker aria-label="Sales list date range" value={listRange} onChange={setListRange} placeholder={['From date', 'To date']} /><Button icon={<DownloadOutlined />} disabled={loading || !!error || !visibleSales.length} onClick={() => downloadReport(salesSpreadsheet(visibleSales, company, exportRange), 'xlsx')}>Excel</Button><Button icon={<DownloadOutlined />} disabled={loading || !!error || !visibleSales.length} onClick={() => downloadReport(salesPdfReport(visibleSales, company, exportRange), 'pdf')}>PDF</Button><span>{visibleSales.length} invoices</span></Space>
        <ResponsiveDataTable columns={columns} dataSource={visibleSales} loading={loading} emptyText="No sales found" mobileRenderItem={(sale) => <><div className="mobile-data-list__title-row"><strong>{sale.sale_number || sale.id}</strong><Tag color={sale.status === 'Posted' ? 'success' : sale.status === 'Partially returned' ? 'orange' : 'default'}>{sale.status}</Tag></div><span className="mobile-data-list__code">{sale.customer} · {sale.items} item{sale.items === 1 ? '' : 's'}</span><div className="mobile-data-list__metrics"><span>Net total <strong>₹{sale.netTotal.toLocaleString('en-IN')}</strong></span><span>Date <strong>{sale.date || '—'}</strong></span></div><Space.Compact block style={{ marginTop: 12 }}><Button icon={<EyeOutlined />} onClick={() => navigate(`/app/retail-sales/${sale.id}`)} style={{ width: '50%' }}>View Sale</Button><Button type="primary" icon={<FileTextOutlined />} onClick={() => navigate(`/app/retail-sales/${sale.id}/invoice`)} style={{ width: '50%' }}>Invoice</Button></Space.Compact></>} />
      </Card>
    </div>
  );
};

export default SalesOrders;
