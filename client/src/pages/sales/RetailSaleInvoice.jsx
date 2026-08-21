import React, { useEffect, useRef } from 'react';
import { Alert, Button, Empty, Space, Spin, Typography, message } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, ShopOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import useApiData from '../../hooks/useApiData';
import './RetailSaleInvoice.css';

const { Text, Title } = Typography;
const money = value => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const quantity = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 });
const date = value => value ? dayjs(value).format('DD MMM YYYY') : '—';
const printInvoice = invoiceNumber => {
  const previousTitle = document.title;
  document.title = `Invoice-${invoiceNumber}`;
  window.addEventListener('afterprint', () => { document.title = previousTitle; }, { once: true });
  window.print();
};

export default function RetailSaleInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: sale, loading, error } = useApiData(`/retail-sales/${id}`, { initialData: {} });
  const { data: company, loading: companyLoading } = useApiData('/tenant/settings', { initialData: {} });
  const autoPrintStarted = useRef(false);

  const items = sale.retailSaleItems || [];
  const customer = sale.customer || {};
  const hasTax = Number(sale.tax_amount || 0) > 0 || items.some(item => Number(item.tax_rate || 0) > 0 || Number(item.tax_amount || 0) > 0);

  const handlePrint = () => printInvoice(sale.sale_number || id);

  useEffect(() => {
    if (searchParams.get('created') !== '1' || loading || companyLoading || !sale.id || autoPrintStarted.current) return undefined;
    const timeoutId = window.setTimeout(() => {
      autoPrintStarted.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete('created');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      printInvoice(sale.sale_number || id);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [companyLoading, id, loading, sale.id, sale.sale_number, searchParams]);

  const handleWhatsAppShare = () => {
    const phone = (customer.phone || '').replace(/[^0-9]/g, '');
    if (!phone) {
      message.warning('Add a phone number to this customer before sharing on WhatsApp.');
      return;
    }
    const body = [
      `*${company.name || 'Wayon'} - Sales Invoice*`,
      '',
      `Dear *${customer.name || 'Customer'}*,`,
      `Invoice: *${sale.sale_number || id}*`,
      `Date: ${date(sale.sale_date)}`,
      `Total: *${money(sale.total_amount)}*`,
      '',
      'Thank you for your purchase!',
    ].join('\n');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <div className="invoice-loading"><Spin size="large" /></div>;
  if (error || !sale.id) return <div className="invoice-loading"><Empty description="Invoice not found"><Button onClick={() => navigate('/app/retail-sales')}>Back to sales</Button></Empty></div>;

  return (
    <main className="invoice-page">
      <div className="invoice-toolbar no-print">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/app/retail-sales/${sale.id}`)}>Back to sale</Button>
        <Space wrap>
          <Button icon={<WhatsAppOutlined />} disabled={!customer.phone} onClick={handleWhatsAppShare}>WhatsApp</Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>Print Invoice</Button>
        </Space>
      </div>

      {searchParams.get('created') === '1' && (
        <Alert className="invoice-ready no-print" type="success" showIcon message="Sale completed. Your invoice is ready to print." />
      )}

      <article id="retail-sale-invoice" className="invoice-sheet">
        <header className="invoice-header">
          <section className="invoice-company">
            {company.logo_url
              ? <img src={company.logo_url} alt={`${company.name || 'Company'} logo`} />
              : <div className="invoice-logo"><ShopOutlined /></div>}
            <div>
              <Title level={2}>{company.name || 'Company'}</Title>
              {company.address && <Text>{company.address}</Text>}
              <Text>{[company.phone, company.email].filter(Boolean).join(' · ') || ' '}</Text>
              {hasTax && company.tax_id && <Text>GSTIN: {company.tax_id}</Text>}
            </div>
          </section>

          <section className="invoice-identity">
            <span className="invoice-kicker">{hasTax ? 'TAX INVOICE' : 'INVOICE'}</span>
            <Title level={2}>{sale.sale_number}</Title>
            <span className="invoice-paid-badge">Paid in full</span>
          </section>
        </header>

        <section className="invoice-overview">
          <div className="invoice-bill-to">
            <span className="invoice-label">BILLED TO</span>
            <strong>{customer.name || 'Walk-in customer'}</strong>
            {customer.address && <span>{customer.address}</span>}
            {customer.phone && <span>{customer.phone}</span>}
            {hasTax && customer.tax_id && <span>GSTIN: {customer.tax_id}</span>}
          </div>
          <dl className="invoice-meta">
            <div><dt>Invoice date</dt><dd>{date(sale.sale_date)}</dd></div>
            <div><dt>Payment status</dt><dd>Paid</dd></div>
            <div><dt>Payment via</dt><dd>{sale.paymentMethod?.name || sale.paymentAccount?.name || 'Recorded payment'}</dd></div>
          </dl>
        </section>

        <div className="invoice-table-wrap">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th className="numeric">Qty</th>
                <th className="numeric">Rate</th>
                <th className="numeric">Disc.</th>
                {hasTax && <th className="numeric">Tax</th>}
                <th className="numeric">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const variant = item.finishedGood || {};
                const productName = variant.product?.name || variant.name || 'Product';
                const variantName = variant.size_label || variant.sku;
                return (
                  <tr key={item.id || index}>
                    <td>{index + 1}</td>
                    <td><strong>{productName}</strong>{variantName && <small>{variantName}{variant.sku && variantName !== variant.sku ? ` · ${variant.sku}` : ''}</small>}</td>
                    <td className="numeric">{quantity(item.quantity)}</td>
                    <td className="numeric">{money(item.unit_price)}</td>
                    <td className="numeric">{Number(item.discount_pct || 0).toLocaleString('en-IN')}%</td>
                    {hasTax && <td className="numeric">{Number(item.tax_rate || 0).toLocaleString('en-IN')}%</td>}
                    <td className="numeric"><strong>{money(item.total)}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <section className="invoice-summary-area">
          <div className="invoice-notes">
            {sale.notes && <><span className="invoice-label">NOTES</span><p>{sale.notes}</p></>}
          </div>
          <dl className="invoice-totals">
            <div><dt>Subtotal</dt><dd>{money(sale.subtotal)}</dd></div>
            <div><dt>Discount</dt><dd>− {money(sale.discount_amount)}</dd></div>
            {hasTax && <div><dt>{company.tax_system || 'GST'}</dt><dd>{money(sale.tax_amount)}</dd></div>}
            <div className="invoice-grand-total"><dt>Total paid</dt><dd>{money(sale.total_amount)}</dd></div>
          </dl>
        </section>

        <footer className="invoice-footer">
          <strong>Thank you for your business.</strong>
          <span>This is a computer-generated invoice.</span>
        </footer>
      </article>
    </main>
  );
}
