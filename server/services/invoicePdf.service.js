const zlib = require('zlib');
const escapePdfText = value => String(value ?? '')
  .replace(/&nbsp;|&#x20;|&#32;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000]/g, ' ')
  .replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
  .normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\x20-\x7E]/g, '')
  .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const money = value => `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = value => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const crop = (value, length) => {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, Math.max(0, length - 3))}...` : text;
};
const textLine = (x, y, text, size = 10, bold = false, color = '0 0 0') => `${color} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;
const rule = (x1,y1,x2,y2,color='0.86 0.84 0.81 RG',width=.7) => `${color} ${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
const fill = (x,y,w,h,color) => `${color} rg ${x} ${y} ${w} ${h} re f`;

const makePdf = (content, logo) => {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> ${logo ? '/XObject << /Logo 6 0 R >>' : ''} >> /Contents ${logo ? (logo.mask ? '8' : '7') : '6'} 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  if (logo) {
    objects.push(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${logo.filter} ${logo.predictor ? `/DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${logo.width} >>` : ''} ${logo.mask ? '/SMask 7 0 R' : ''} /Length ${logo.data.length} >>\nstream\n`);
    objects[5] += logo.data.toString('latin1') + '\nendstream';
    if (logo.mask) objects.push(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 1 /BitsPerComponent 8 /Columns ${logo.width} >> /Length ${logo.mask.length} >>\nstream\n${logo.mask.toString('latin1')}\nendstream`);
  }
  objects.push(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
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

const decodeLogo = dataUrl => {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([\s\S]+)$/i.exec(String(dataUrl || ''));
  if (!match) return null;
  const data = Buffer.from(match[2], 'base64');
  // Trust the file signature rather than the data URL label: older uploads may
  // have valid JPEG bytes stored with an image/png prefix.
  if (data[0] === 0xff && data[1] === 0xd8) {
    let width, height;
    for (let p = 2; p < data.length - 9;) { if (data[p] !== 0xff) { p++; continue; } const marker = data[p + 1]; const size = data.readUInt16BE(p + 2); if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) { height=data.readUInt16BE(p+5); width=data.readUInt16BE(p+7); break; } p += 2 + size; }
    return width && height ? { width, height, data, filter: 'DCTDecode' } : null;
  }
  if (!/png/i.test(match[1]) || !data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return null;
  let width, height, depth, type, interlace; const chunks=[];
  for (let p=8;p+12<=data.length;) { const n=data.readUInt32BE(p); const name=data.toString('ascii',p+4,p+8); if(name==='IHDR'){width=data.readUInt32BE(p+8);height=data.readUInt32BE(p+12);depth=data[p+16];type=data[p+17];interlace=data[p+20];} if(name==='IDAT')chunks.push(data.subarray(p+8,p+8+n)); p+=12+n; if(name==='IEND')break; }
  if (!width || !height || depth!==8 || ![2,6].includes(type) || interlace!==0) return null;
  const packed=zlib.inflateSync(Buffer.concat(chunks));
  if(type===2)return {width,height,data:packed,filter:'FlateDecode',predictor:true};
  const bpp=4,stride=width*bpp,rgba=Buffer.alloc(stride*height),alpha=Buffer.alloc(width*height); let src=0;
  for(let y=0;y<height;y++){const f=packed[src++],row=y*stride,prev=row-stride;for(let x=0;x<stride;x++){const raw=packed[src++],a=x>=bpp?rgba[row+x-bpp]:0,b=y?rgba[prev+x]:0,c=y&&x>=bpp?rgba[prev+x-bpp]:0;let v=raw;if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=Math.floor((a+b)/2);else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}rgba[row+x]=v&255;}}
  const rgb=Buffer.alloc((width*3+1)*height),aData=Buffer.alloc((width+1)*height);for(let y=0;y<height;y++){let r=y*(width*3+1),a=y*(width+1);rgb[r++]=0;aData[a++]=0;for(let x=0;x<width;x++){const i=y*stride+x*4;rgb[r++]=rgba[i];rgb[r++]=rgba[i+1];rgb[r++]=rgba[i+2];aData[a++]=rgba[i+3];}}
  return {width,height,data:zlib.deflateSync(rgb),mask:zlib.deflateSync(aData),filter:'FlateDecode',predictor:true};
};

const createInvoicePdf = ({ sale, company }) => {
  const customer = sale.customer || {};
  const items = sale.retailSaleItems || [];
  const isArabelegance = /arabelegance|arabglance|arabglaance/i.test(String(company?.name || ''));
  const companyAddress = escapePdfText(company?.address || '').trim();
  const extractedPhones = [...companyAddress.matchAll(/(?:\+?91[ -]?)?[6-9]\d{9}/g)].map(match => match[0].trim());
  const cleanAddress = companyAddress.replace(/(?:\+?91[ -]?)?[6-9]\d{9}/g, '').replace(/[;,|]+\s*$/g, '').replace(/\s{2,}/g, ' ').trim();
  const phoneList = [company?.phone, ...extractedPhones].filter(Boolean).filter((value,index,array)=>array.indexOf(value)===index).join('  |  ');
  const headerColor = isArabelegance ? '0.588 0.529 0.475' : '0.94 0.93 1.00';
  const invoiceTitleColor = isArabelegance ? '1 1 1' : '0 0 0';
  const lines = [fill(0, 674, 595, 168, headerColor)];
  const logo = decodeLogo(company?.logo_url);
  if (logo) lines.push('q 185 0 0 94 42 722 cm /Logo Do Q');
  lines.push(textLine(472, 805, Number(sale.tax_amount||0)>0?'Tax Invoice':'Invoice', 15, true, invoiceTitleColor));
  lines.push(textLine(42, 654, 'Invoice No:', 11, true), textLine(112, 654, crop(sale.sale_number || sale.id, 25), 11));
  lines.push(textLine(425, 654, 'Date:', 11, true), textLine(458, 654, date(sale.sale_date), 11));
  lines.push(rule(42, 638, 553, 638));
  lines.push(textLine(42, 615, 'Invoice To:', 9, true, '0.35 0.32 0.40'), textLine(42, 594, crop(customer.name || 'Walk-in customer', 42), 13, true));
  if(customer.phone)lines.push(textLine(42, 574, customer.phone, 10, false, '0.35 0.38 0.52'));
  if(customer.address)lines.push(textLine(42, customer.phone ? 556 : 574, crop(customer.address, 58), 10, false, '0.35 0.38 0.52'));
  lines.push(textLine(318, 615, 'Invoice From:', 9, true, '0.35 0.32 0.40'), textLine(318, 594, crop(company?.name || 'Company', 40), 13, true));
  if(phoneList)lines.push(textLine(318, 574, crop(phoneList, 42), 10, false, '0.35 0.38 0.52'));
  if(cleanAddress)lines.push(textLine(318, phoneList ? 556 : 574, crop(cleanAddress, 42), 10, false, '0.35 0.38 0.52'));
  if (isArabelegance) lines.push(textLine(318, company?.tax_id ? 520 : (cleanAddress || phoneList ? 538 : 574), 'www.arabeleganceperfume.com', 9, false, '0.35 0.38 0.52'));
  if(company?.tax_id)lines.push(textLine(318, 502, crop(`${company?.tax_system||'GST'}IN: ${company.tax_id}`, 42), 9, false, '0.35 0.38 0.52'));
  lines.push(rule(42, 520, 553, 520));
  lines.push(fill(42, 495, 511, 25, '0.16 0.13 0.11'), textLine(51, 504, '#', 8, true,'1 1 1'), textLine(78, 504, 'PRODUCT', 8, true,'1 1 1'), textLine(354, 504, 'QTY', 8, true,'1 1 1'), textLine(415, 504, 'RATE', 8, true,'1 1 1'), textLine(493, 504, 'AMOUNT', 8, true,'1 1 1'));
  const rowHeight = items.length > 16 ? 17 : 22;
  const visibleItems = items.slice(0, Math.min(items.length, 21));
  let y = 481;
  visibleItems.forEach((item, index) => {
    const product = item.packagingMaterial?.name || item.finishedGood?.product?.name || item.finishedGood?.name || 'Product';
    const variant = isArabelegance
      ? (item.packagingMaterial ? '' : item.finishedGood?.size_label || '')
      : (item.packagingMaterial?.sku || item.finishedGood?.size_label || item.finishedGood?.sku || '');
    if(index%2===1)lines.push(fill(42,y-7,511,rowHeight,'0.985 0.98 0.97'));
    lines.push(textLine(51, y, String(index + 1), 8), textLine(78, y, crop(product, 42), 9, true));
    if (variant) lines.push(textLine(78, y - 9, crop(variant, 48), 7));
    lines.push(textLine(354, y, Number(item.quantity || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 }), 8), textLine(415, y, money(item.unit_price), 8), textLine(493, y, money(item.total ?? Number(item.quantity || 0) * Number(item.unit_price || 0)), 8));
    y -= rowHeight;
  });
  if (items.length > visibleItems.length) lines.push(textLine(51,y,`+ ${items.length-visibleItems.length} more items.`,8));
  const summaryY=Math.max(110,y-14);
  lines.push(rule(335,summaryY+12,553,summaryY+12),textLine(363,summaryY-5,'Subtotal',9),textLine(479,summaryY-5,money(sale.subtotal),9));
  let totalY=summaryY-23;
  if(Number(sale.discount_amount||0)){lines.push(textLine(363,totalY,'Discount',9),textLine(479,totalY,`- ${money(sale.discount_amount)}`,9));totalY-=18;}
  if(Number(sale.tax_amount||0)){lines.push(textLine(363,totalY,company?.tax_system||'Tax',9),textLine(479,totalY,money(sale.tax_amount),9));totalY-=18;}
  lines.push(fill(335,totalY-24,218,32,'0.16 0.13 0.11'),textLine(348,totalY-13,'TOTAL PAID',10,true,'1 1 1'),textLine(450,totalY-13,money(sale.total_amount),10,true,'1 1 1'));
  lines.push(rule(42,74,553,74),textLine(42,57,isArabelegance ? 'Thank you for choosing Arabelegance Perfume.' : 'Thank you for your business.',10,true));
  return makePdf(lines.join('\n'), logo);
};

module.exports = { createInvoicePdf };
