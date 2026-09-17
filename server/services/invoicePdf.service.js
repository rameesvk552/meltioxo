const escapePdfText = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?');
const money = value => `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = value => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const crop = (value, length) => {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, Math.max(0, length - 3))}...` : text;
};
const textLine = (x, y, text, size = 10, bold = false) => `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;

const makePdf = content => {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
};

const createInvoicePdf = ({ sale, company }) => {
  const customer = sale.customer || {};
  const items = sale.retailSaleItems || [];
  const lines = [
    textLine(42, 800, crop(company?.name || 'Company', 55), 19, true),
    textLine(42, 782, crop(company?.address || '', 80), 9),
    textLine(42, 768, company?.phone ? `Phone: ${company.phone}` : '', 9),
    textLine(405, 800, 'TAX INVOICE', 15, true),
    textLine(405, 780, `Invoice: ${sale.sale_number || sale.id}`, 10, true),
    textLine(405, 765, `Date: ${date(sale.sale_date)}`, 10),
    '0.85 w 42 742 m 553 742 l S',
    textLine(42, 721, 'BILL TO', 9, true),
    textLine(42, 706, crop(customer.name || 'Walk-in customer', 55), 11, true),
    textLine(42, 691, crop(customer.address || '', 75), 9),
    textLine(42, 677, customer.phone ? `Phone: ${customer.phone}` : '', 9),
    '0.85 w 42 655 m 553 655 l S',
    textLine(46, 638, '#', 9, true), textLine(70, 638, 'PRODUCT', 9, true), textLine(370, 638, 'QTY', 9, true), textLine(420, 638, 'RATE', 9, true), textLine(492, 638, 'AMOUNT', 9, true),
    '0.5 w 42 628 m 553 628 l S',
  ];
  let y = 611;
  items.slice(0, 22).forEach((item, index) => {
    const product = item.packagingMaterial?.name || item.finishedGood?.product?.name || item.finishedGood?.name || 'Product';
    const variant = item.packagingMaterial?.sku || item.finishedGood?.size_label || item.finishedGood?.sku || '';
    lines.push(textLine(46, y, String(index + 1), 9), textLine(70, y, crop(product, 48), 9, true));
    if (variant) lines.push(textLine(70, y - 10, crop(variant, 55), 8));
    lines.push(textLine(370, y, Number(item.quantity || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 }), 9), textLine(420, y, money(item.unit_price), 9), textLine(492, y, money(item.total ?? Number(item.quantity || 0) * Number(item.unit_price || 0)), 9));
    y -= variant ? 28 : 18;
  });
  if (items.length > 22) lines.push(textLine(42, y, `+ ${items.length - 22} more item(s); see ERP invoice for the complete list.`, 8));
  const totalsY = Math.min(Math.max(y - 18, 108), 190);
  lines.push(`0.85 w 330 ${totalsY + 15} m 553 ${totalsY + 15} l S`, textLine(370, totalsY, 'Subtotal', 9), textLine(492, totalsY, money(sale.subtotal), 9));
  let totalLineY = totalsY - 17;
  if (Number(sale.discount_amount || 0)) { lines.push(textLine(370, totalLineY, 'Discount', 9), textLine(492, totalLineY, `- ${money(sale.discount_amount)}`, 9)); totalLineY -= 17; }
  if (Number(sale.tax_amount || 0)) { lines.push(textLine(370, totalLineY, company?.tax_system || 'Tax', 9), textLine(492, totalLineY, money(sale.tax_amount), 9)); totalLineY -= 17; }
  lines.push(`0.85 w 330 ${totalLineY + 8} m 553 ${totalLineY + 8} l S`, textLine(370, totalLineY - 10, 'TOTAL PAID', 11, true), textLine(492, totalLineY - 10, money(sale.total_amount), 11, true), textLine(42, 48, 'Thank you for your business. This is a computer-generated invoice.', 9));
  return makePdf(lines.join('\n'));
};

module.exports = { createInvoicePdf };
