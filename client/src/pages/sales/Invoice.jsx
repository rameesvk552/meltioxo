import React from 'react';
import { Card, Row, Col, Typography, Table, Divider, Button, Space } from 'antd';
import { PrinterOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';

const { Title, Text } = Typography;

const Invoice = () => {
  const { id } = useParams();
  const { data: order } = useApiData(`/sales/orders/${id}`, { initialData: {} });
  const { data: customer } = useApiData(
    order.customer_id ? `/sales/customers/${order.customer_id}` : null,
    { enabled: Boolean(order.customer_id), initialData: {} }
  );
  const { data: company } = useApiData('/tenant/settings', { initialData: {} });
  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const customerName = customer.name || 'Customer';
    const invoiceNo = order.order_number || id;
    const totalAmount = grandTotal;
    const phone = customer.phone || '';
    
    const text = `*Wayon - Sales Invoice*%0A%0A` +
                 `Dear *${customerName}*,%0A` +
                 `Please find the invoice details for invoice *${invoiceNo}* below:%0A%0A` +
                 `• *Invoice No:* ${invoiceNo}%0A` +
                 `• *Total Amount:* ₹${totalAmount.toLocaleString('en-IN')}%0A%0A` +
                 `You can view the full printable copy here:%0A` +
                 `${window.location.href}%0A%0A` +
                 `Thank you for doing business with us!%0A` +
                 `*Wayon Team*`;
                 
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${text}`, '_blank');
  };

  const columns = [
    { title: '#', dataIndex: 'key', key: 'key', width: '5%' },
    { title: 'Product', dataIndex: 'product', key: 'product' },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', align: 'center' },
    { title: 'Rate', dataIndex: 'rate', key: 'rate', align: 'right', render: val => `₹${val.toLocaleString('en-IN')}` },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: val => `₹${val.toLocaleString('en-IN')}` },
  ];

  const orderItems = order.salesOrderItems || [];
  const data = orderItems.map((item, index) => ({
    key: item.id || index + 1,
    product: item.finishedGood?.name || item.finished_good_id || '—',
    qty: Number(item.quantity || 0),
    rate: Number(item.unit_price || 0),
    amount: Number(item.total || 0)
  }));

  const subtotal = Number(order.subtotal || data.reduce((sum, item) => sum + item.amount, 0));
  const cgst = Number(order.tax_amount || 0) / 2;
  const sgst = Number(order.tax_amount || 0) / 2;
  const grandTotal = Number(order.total_amount || subtotal + cgst + sgst);
  const hasTax = Number(order.tax_amount || 0) > 0 || orderItems.some(item => Number(item.tax_rate || 0) > 0 || Number(item.tax_amount || 0) > 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <Space>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            Print Invoice
          </Button>
          <Button type="primary" icon={<WhatsAppOutlined />} style={{ background: '#25D366', borderColor: '#25D366' }} onClick={handleWhatsAppShare}>
            Send via WhatsApp
          </Button>
        </Space>
      </div>
      
      {/* Printable Area - Always white for printing */}
      <Card id="printable-invoice" style={{ maxWidth: 900, margin: '0 auto', background: '#fff', color: '#000', borderRadius: 0 }}>
        <Row justify="space-between" align="top" style={{ marginBottom: 40 }}>
          <Col span={12}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              {company.logo_url
                ? <img src={company.logo_url} alt={`${company.name || 'Company'} logo`} style={{ width: 64, height: 64, objectFit: 'contain', marginRight: 16 }} />
                : <div style={{ width: 50, height: 50, background: 'var(--color-gold)', borderRadius: 4, marginRight: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: 24 }}>{(company.name || 'Company').charAt(0).toUpperCase()}</div>}
              <Title level={2} style={{ margin: 0, color: 'var(--color-gold)', fontFamily: "'Playfair Display', serif" }}>{company.name || 'Company'}</Title>
            </div>
            <Text style={{ display: 'block' }}>{company.address || ''}</Text>
            <Text style={{ display: 'block' }}>Phone: {company.phone || '—'}</Text>
            {hasTax && company.tax_id && <Text style={{ display: 'block' }}>GSTIN: {company.tax_id}</Text>}
          </Col>
          <Col span={10} style={{ textAlign: 'right' }}>
            <Title level={2} style={{ color: '#333', marginBottom: 16, fontFamily: "'Playfair Display', serif" }}>{hasTax ? 'TAX INVOICE' : 'INVOICE'}</Title>
            <Row>
              <Col span={12}><Text strong>Invoice No:</Text></Col>
              <Col span={12}><Text>{order.order_number || id}</Text></Col>
              <Col span={12}><Text strong>Date:</Text></Col>
              <Col span={12}><Text>{order.order_date || '—'}</Text></Col>
              <Col span={12}><Text strong>Due Date:</Text></Col>
              <Col span={12}><Text>{order.delivery_date || '—'}</Text></Col>
            </Row>
          </Col>
        </Row>

        <Row style={{ marginBottom: 40 }}>
          <Col span={12}>
            <Title level={5} style={{ color: '#555', borderBottom: '1px solid #ddd', paddingBottom: 8, width: '80%' }}>Bill To:</Title>
            <Text strong style={{ display: 'block', fontSize: 16 }}>{customer.name || '—'}</Text>
            <Text style={{ display: 'block' }}>{customer.address || '—'}</Text>
            {hasTax && customer.tax_id && <Text style={{ display: 'block' }}>GSTIN: {customer.tax_id}</Text>}
          </Col>
        </Row>

        <Table 
          columns={columns} 
          dataSource={data} 
          pagination={false}
          bordered
          style={{ marginBottom: 24 }}
          rowClassName={() => 'invoice-row'}
        />

        <Row justify="end">
          <Col span={10}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <Text>Subtotal:</Text>
              <Text>₹{subtotal.toLocaleString('en-IN')}</Text>
            </div>
            {hasTax && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <Text>CGST (9%):</Text>
              <Text>₹{cgst.toLocaleString('en-IN')}</Text>
            </div>}
            {hasTax && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <Text>SGST (9%):</Text>
              <Text>₹{sgst.toLocaleString('en-IN')}</Text>
            </div>}
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <Title level={4} style={{ margin: 0 }}>Grand Total:</Title>
              <Title level={4} style={{ margin: 0 }}>₹{grandTotal.toLocaleString('en-IN')}</Title>
            </div>
          </Col>
        </Row>

        <Divider style={{ marginTop: 60 }} />

        <Row>
          <Col span={12}>
            <Title level={5} style={{ color: '#555' }}>Payment Terms</Title>
            <Text style={{ display: 'block' }}>{company.payment_terms_text || '—'}</Text>
          </Col>
          <Col span={12}>
            <Title level={5} style={{ color: '#555' }}>Bank Details</Title>
            <Text style={{ display: 'block' }}>Bank: {company.bank_name || '—'}</Text>
            <Text style={{ display: 'block' }}>A/C No: {company.bank_account_number || '—'}</Text>
            <Text style={{ display: 'block' }}>IFSC: {company.bank_ifsc || '—'}</Text>
          </Col>
        </Row>
      </Card>
      
      {/* Style for print media */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible;
          }
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .ant-table { background: #fff !important; }
          .ant-table-thead > tr > th { background: #f0f0f0 !important; color: #000 !important; }
        }
      `}</style>
    </div>
  );
};

export default Invoice;
