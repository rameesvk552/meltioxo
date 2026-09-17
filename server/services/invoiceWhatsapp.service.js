const crypto = require('crypto');
const { decrypt } = require('./whatsappCredential.service');

const DEFAULT_WHATSAPP_API_URL = 'https://travelbot.wayon.in/api/public/v1/whatsapp/messages';
const DEFAULT_WHATSAPP_INVOICE_TEMPLATE = 'rental_invoice_5';
const INVOICE_PUBLIC_BASE_URL = String(process.env.INVOICE_PUBLIC_BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://perfume.wayon.in' : '')).replace(/\/+$/, '');
const INVOICE_LINK_SECRET = process.env.INVOICE_LINK_SECRET || process.env.JWT_SECRET || '';
const INVOICE_LINK_TTL_SECONDS = Math.max(60, Number(process.env.INVOICE_LINK_TTL_SECONDS || 600));
const WHATSAPP_TIMEOUT_MS = Math.max(1000, Number(process.env.WHATSAPP_TIMEOUT_MS || 15000));

const settingsForTenant = tenant => ({
  enabled: Boolean(tenant?.whatsapp_invoice_auto_send),
  apiUrl: String(tenant?.whatsapp_invoice_api_url || DEFAULT_WHATSAPP_API_URL).replace(/\/+$/, ''),
  apiToken: decrypt(tenant?.whatsapp_invoice_api_token),
  template: tenant?.whatsapp_invoice_template || DEFAULT_WHATSAPP_INVOICE_TEMPLATE,
});

const isEnabled = settings => Boolean(settings?.enabled && settings?.apiToken && INVOICE_PUBLIC_BASE_URL && INVOICE_LINK_SECRET);

const normalizePhone = value => {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (raw.startsWith('+')) return `+${digits}`;
  const defaultCountryCode = String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '');
  return digits.length === 10 && defaultCountryCode ? `+${defaultCountryCode}${digits}` : `+${digits}`;
};

const signInvoiceLink = ({ saleId, tenantId, expiresAt }) => crypto
  .createHmac('sha256', INVOICE_LINK_SECRET)
  .update(`${saleId}.${tenantId}.${expiresAt}`)
  .digest('hex');

const createInvoiceLink = ({ saleId, tenantId }) => {
  if (!INVOICE_PUBLIC_BASE_URL || !INVOICE_LINK_SECRET) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + INVOICE_LINK_TTL_SECONDS;
  const signature = signInvoiceLink({ saleId, tenantId, expiresAt });
  return `${INVOICE_PUBLIC_BASE_URL}/api/public/invoices/${encodeURIComponent(saleId)}.pdf?tenant=${encodeURIComponent(tenantId)}&expires=${expiresAt}&signature=${signature}`;
};

const verifyInvoiceLink = ({ saleId, tenantId, expiresAt, signature }) => {
  if (!INVOICE_LINK_SECRET || !saleId || !tenantId || !signature) return false;
  const expires = Number(expiresAt);
  if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = signInvoiceLink({ saleId, tenantId, expiresAt: expires });
  const supplied = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return supplied.length === expectedBuffer.length && crypto.timingSafeEqual(supplied, expectedBuffer);
};

const sendInvoice = async ({ sale, customer, tenant }) => {
  let settings;
  try { settings = settingsForTenant(tenant); }
  catch (error) { return { attempted: false, status: 'disabled', reason: error.message }; }
  if (!isEnabled(settings)) return { attempted: false, status: 'disabled' };
  const to = normalizePhone(customer?.phone);
  if (!to) return { attempted: false, status: 'skipped', reason: 'Customer has no phone number' };
  const documentUrl = createInvoiceLink({ saleId: sale.id, tenantId: sale.tenant_id });
  if (!documentUrl) return { attempted: false, status: 'disabled' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WHATSAPP_TIMEOUT_MS);
  try {
    const response = await fetch(settings.apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.apiToken}` },
      body: JSON.stringify({
        type: 'template', to,
        template: {
          name: settings.template,
          variables: [customer?.name || 'Customer'],
          header: { type: 'document', url: documentUrl, filename: `${sale.sale_number || 'invoice'}.pdf` },
        },
      }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = { message: raw }; }
    if (!response.ok) throw new Error(payload?.message || payload?.error?.message || `WhatsApp API returned ${response.status}`);
    return { attempted: true, status: 'sent' };
  } catch (error) {
    return { attempted: true, status: 'failed', reason: error.name === 'AbortError' ? 'WhatsApp API timed out' : error.message };
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = { createInvoiceLink, isEnabled, normalizePhone, sendInvoice, verifyInvoiceLink, _private: { settingsForTenant, signInvoiceLink } };
