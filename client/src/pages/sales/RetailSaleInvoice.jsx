import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Empty, Space, Spin, Typography, message } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, PrinterOutlined, ShopOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import useApiData from '../../hooks/useApiData';
import client from '../../api/client';
import { GST_STATE_NAMES } from '../../utils/gstStateNames';
import { downloadReport } from '../reports/reportDownloads';
import { invoiceSpreadsheet, invoiceTaxBreakup, invoiceTaxRates, invoiceTaxTotals } from './invoiceExport';
import './RetailSaleInvoice.css';

const { Title } = Typography;
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
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const items = sale.retailSaleItems || [];
  const customer = sale.customer || {};
  const isArabelegance = /arabelegance|arabglance|arabglaance/i.test(String(company.name || ''));
  const hasTax = Number(sale.tax_amount || 0) > 0 || items.some(item => Number(item.tax_rate || 0) > 0 || Number(item.tax_amount || 0) > 0);
  const composition = sale.gst_scheme === 'COMPOSITION';
  const regularGst = sale.gst_enabled === true;
  const interState = sale.supply_type === 'INTER';
  const gstTotals = invoiceTaxTotals(sale);
  const hasDiscount = Number(sale.discount_amount || 0) > 0 || items.some(item => Number(item.discount_pct || 0) > 0);

  const handlePrint = () => printInvoice(sale.sale_number || id);
  const handlePdf = async () => {
    setDownloadingPdf(true);
    try {
      const response = await client.get(`/retail-sales/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${String(sale.sale_number || id).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      message.error('Could not download the invoice PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };
  const handleSettle = () => navigate(`/app/payments/new?type=incoming&party_id=${sale.customer_id}&invoice_id=${sale.id}&amount=${Number(sale.balance_due || 0)}`);

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
      `*${company.name || 'Wayon'} - ${composition ? 'Bill of Supply' : regularGst ? 'Tax Invoice' : 'Sales Invoice'}*`,
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
          {Number(sale.balance_due || 0) > 0 && <Button type="primary" onClick={handleSettle}>Settle invoice · {money(sale.balance_due)}</Button>}
          <Button icon={<DownloadOutlined />} onClick={() => downloadReport(invoiceSpreadsheet(sale, company), 'xlsx')}>Excel</Button>
          <Button icon={<DownloadOutlined />} onClick={handlePdf} loading={downloadingPdf}>PDF</Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>Print Invoice</Button>
        </Space>
      </div>

      {searchParams.get('created') === '1' && (
        <Alert className="invoice-ready no-print" type="success" showIcon message={Number(sale.balance_due || 0) > 0 ? 'Sale completed. The remaining balance is recorded as customer credit.' : 'Sale completed. Your invoice is ready to print.'} />
      )}

      <article id="retail-sale-invoice" className="invoice-sheet">
        <header className={`invoice-header${isArabelegance ? ' invoice-header--gold' : ''}`}>
          <section className="invoice-company">
            {company.logo_url
              ? <img src={company.logo_url} alt={`${company.name || 'Company'} logo`} />
              : <div className="invoice-logo"><ShopOutlined /></div>}
          </section>

          <section className="invoice-identity">
            <Title level={2}>{composition ? 'Bill of Supply' : regularGst || hasTax ? 'Tax Invoice' : 'Invoice'}</Title>
            {composition && <span className="invoice-composition-note">Composition taxable person, not eligible to collect tax on supplies.</span>}
          </section>
        </header>

        <section className="invoice-number-row">
          <div><strong>Invoice No:</strong> <span>{sale.sale_number}</span></div>
          <div><strong>Date:</strong> <span>{date(sale.sale_date)}</span></div>
          {regularGst && <div><strong>Place of supply:</strong> <span>{GST_STATE_NAMES[sale.place_of_supply_state_code] || '—'} ({sale.place_of_supply_state_code || '—'}) · {interState ? 'Interstate' : 'Intrastate'}</span></div>}
        </section>

        <section className="invoice-overview">
          <div className="invoice-bill-to">
            <span className="invoice-label">Invoice To:</span>
            <strong>{customer.name || 'Walk-in customer'}</strong>
            {customer.phone && <span>{customer.phone}</span>}
            {customer.address && <span>{customer.address}</span>}
            {customer.email && <span>{customer.email}</span>}
            {regularGst && sale.customer_gstin && <span>GSTIN: {sale.customer_gstin}</span>}
          </div>
          <div className="invoice-from">
            <span className="invoice-label">Invoice From:</span>
            <strong>{company.name || 'Company'}</strong>
            {company.phone && <span>{company.phone}</span>}
            {company.address && <span>{company.address}</span>}
            {company.email && <span>{company.email}</span>}
            {isArabelegance && <a href="https://www.arabeleganceperfume.com" target="_blank" rel="noreferrer">www.arabeleganceperfume.com</a>}
            {(regularGst ? sale.seller_gstin : composition ? company.tax_id : null) && <span>GSTIN: {regularGst ? sale.seller_gstin : company.tax_id}</span>}
          </div>
        </section>

        <div className="invoice-table-wrap">
          <table className={`invoice-table${regularGst ? ' invoice-table--gst' : ''}`}>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                {regularGst && <th>HSN</th>}
                <th className="numeric">Qty</th>
                <th className="numeric">Rate</th>
                {regularGst && <th className="numeric">Taxable</th>}
                {regularGst ? <th className="numeric">GST breakup</th> : hasTax && <th className="numeric">Tax</th>}
                <th className="numeric">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const variant = item.finishedGood || {};
                const packingMaterial = item.packagingMaterial;
                const productName = packingMaterial?.name || variant.product?.name || variant.name || 'Product';
                const isMeasured = Boolean(variant.product?.sell_by_measurement);
                const variantName = isArabelegance
                  ? (packingMaterial ? null : (isMeasured ? null : variant.size_label))
                  : (packingMaterial?.sku || (isMeasured ? null : variant.size_label || variant.sku));
                const quantityUnit = packingMaterial ? ` ${packingMaterial.unit || 'pcs'}` : isMeasured ? ` ${variant.product.measurement_unit || 'ml'}` : '';
                const lineAmount = Number(item.quantity || 0) * Number(item.unit_price || 0);
                const split = invoiceTaxBreakup(sale, item);
                const rates = invoiceTaxRates(sale, item);
                const taxable = Number(item.total || 0) - Number(item.tax_amount || 0);
                return (
                  <tr key={item.id || index}>
                    <td>{index + 1}</td>
                    <td><strong>{productName}</strong>{variantName && <small>{variantName}{!isArabelegance && variant.sku && variantName !== variant.sku ? ` · ${variant.sku}` : ''}</small>}</td>
                    {regularGst && <td>{item.hsn_code || '—'}</td>}
                    <td className="numeric">{quantity(item.quantity)}{quantityUnit}</td>
                    <td className="numeric">{money(item.unit_price)}</td>
                    {regularGst && <td className="numeric">{money(taxable)}</td>}
                    {regularGst ? <td className="numeric">GST {Number(item.tax_rate || 0).toLocaleString('en-IN')}%{interState ? <small>IGST {rates.igst}% · {money(split.igst)}</small> : <><small>CGST {rates.cgst}% · {money(split.cgst)}</small><small>SGST {rates.sgst}% · {money(split.sgst)}</small></>}</td> : hasTax && <td className="numeric">{Number(item.tax_rate || 0).toLocaleString('en-IN')}%</td>}
                    <td className="numeric"><strong>{money(regularGst ? item.total : lineAmount)}</strong></td>
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
            {hasDiscount && <div><dt>Discount</dt><dd>− {money(sale.discount_amount)}</dd></div>}
            {regularGst ? interState ? <div><dt>IGST</dt><dd>{money(gstTotals.igst)}</dd></div> : <><div><dt>CGST</dt><dd>{money(gstTotals.cgst)}</dd></div><div><dt>SGST</dt><dd>{money(gstTotals.sgst)}</dd></div></> : hasTax && <div><dt>{company.tax_system || 'Tax'}</dt><dd>{money(sale.tax_amount)}</dd></div>}
            {regularGst && <div><dt>Total GST</dt><dd>{money(sale.tax_amount)}</dd></div>}
            <div className="invoice-grand-total"><dt>Total</dt><dd>{money(sale.total_amount)}</dd></div>
            {Number(sale.store_credit_used || 0) > 0 && <div><dt>Store credit used</dt><dd>{money(sale.store_credit_used)}</dd></div>}
            {Number(sale.paid_amount || 0) - Number(sale.store_credit_used || 0) > 0 && <div><dt>Amount received</dt><dd>{money(Number(sale.paid_amount || 0) - Number(sale.store_credit_used || 0))}</dd></div>}
            {Number(sale.balance_due || 0) > 0 && <div><dt>Balance due</dt><dd>{money(sale.balance_due)}</dd></div>}
          </dl>
        </section>

        <footer className="invoice-footer">
          <strong>{isArabelegance ? 'Thank you for choosing Arabelegance Perfume.' : 'Thank you for your business.'}</strong>
          {regularGst ? <span>For {company.name || 'Company'} · Authorized signatory</span> : !isArabelegance && <span>This is a computer-generated invoice.</span>}
        </footer>
      </article>
    </main>
  );
}
