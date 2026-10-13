const { tenant } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const { encrypt } = require('../services/whatsappCredential.service');

const serializeSettings = item => {
  const data = item.toJSON();
  data.whatsapp_invoice_token_configured = Boolean(data.whatsapp_invoice_api_token);
  delete data.whatsapp_invoice_api_token;
  return data;
};

exports.getSettings = async (req, res, next) => {
  try {
    const item = await tenant.findByPk(req.tenantId);
    if (!item) throw new AppError('Not found', 404);
    res.status(200).json(serializeSettings(item));
  } catch (error) { next(error); }
};

exports.updateWhatsappInvoiceSettings = async (req, res, next) => {
  try {
    const item = await tenant.findByPk(req.tenantId);
    if (!item) throw new AppError('Not found', 404);
    const { auto_send, api_url, api_token, template_name, clear_api_token = false } = req.body;
    const values = {};
    if (auto_send !== undefined) values.whatsapp_invoice_auto_send = Boolean(auto_send);
    if (api_url !== undefined) {
      const normalizedUrl = String(api_url || '').trim();
      if (!/^https:\/\//i.test(normalizedUrl)) throw new AppError('WhatsApp API URL must use HTTPS.', 400);
      values.whatsapp_invoice_api_url = normalizedUrl;
    }
    if (template_name !== undefined) {
      const template = String(template_name || '').trim();
      if (!template || template.length > 255) throw new AppError('Enter a valid WhatsApp template name.', 400);
      values.whatsapp_invoice_template = template;
    }
    if (clear_api_token) values.whatsapp_invoice_api_token = null;
    else if (api_token !== undefined && String(api_token).trim()) values.whatsapp_invoice_api_token = encrypt(String(api_token).trim());
    if (values.whatsapp_invoice_auto_send && !(values.whatsapp_invoice_api_token || (!clear_api_token && item.whatsapp_invoice_api_token))) {
      throw new AppError('Paste a WhatsApp API token before enabling automatic invoice delivery.', 400);
    }
    await item.update(values);
    res.status(200).json({ message: 'WhatsApp invoice settings saved.', settings: serializeSettings(item) });
  } catch (error) { next(error); }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const incentiveKeys = ['incentive_enabled', 'incentive_salesperson_mode', 'incentive_rate', 'incentive_basis', 'incentive_min_sale_amount'];
    if (incentiveKeys.some(key => Object.hasOwn(req.body, key)) && !['super_admin', 'admin'].includes(req.user.role)) {
      throw new AppError('Only administrators can change incentive settings', 403);
    }
    const allowed = ['name', 'address', 'phone', 'email', 'tax_id', 'logo_url', 'currency', 'tax_system', 'gst_scheme', 'gst_composition_rate', 'fy_start_month', 'date_format', 'measured_packaging_enabled', 'measured_packaging_required', 'measured_packaging_auto_select', 'show_formula_in_sales', 'packaging_material_sales_enabled', 'raw_material_mixing_enabled', 'credit_sales_enabled', ...incentiveKeys];
    const values = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (values.gst_scheme !== undefined) {
      if (!['super_admin', 'admin'].includes(req.user.role)) throw new AppError('Only administrators can change the GST scheme', 403);
      if (!['REGULAR', 'COMPOSITION'].includes(values.gst_scheme)) throw new AppError('Invalid GST scheme', 400);
    }
    if (values.gst_composition_rate !== undefined) {
      if (!['super_admin', 'admin'].includes(req.user.role)) throw new AppError('Only administrators can change the composition rate', 403);
      if (![1, 5, 6].includes(Number(values.gst_composition_rate))) throw new AppError('Composition rate must be 1%, 5%, or 6%', 400);
      values.gst_composition_rate = Number(values.gst_composition_rate);
    }
    if (values.gst_scheme !== undefined || values.tax_system !== undefined) {
      const current = await tenant.findByPk(req.tenantId);
      if (!current) throw new AppError('Not found', 404);
      if ((values.gst_scheme || current.gst_scheme) === 'COMPOSITION' && (values.tax_system || current.tax_system) !== 'GST') throw new AppError('Composition scheme requires GST as the tax system', 400);
    }
    if (values.raw_material_mixing_enabled !== undefined) {
      if (typeof values.raw_material_mixing_enabled !== 'boolean') throw new AppError('Raw material mixing setting must be true or false', 400);
      if (!['super_admin', 'admin'].includes(req.user.role)) throw new AppError('Only administrators can change raw material mixing settings', 403);
    }
    if (values.incentive_salesperson_mode !== undefined && !['LOGGED_IN', 'SELECT'].includes(values.incentive_salesperson_mode)) throw new AppError('Invalid salesperson assignment mode', 400);
    if (values.incentive_basis !== undefined && !['NET_EX_TAX', 'TOTAL_INCL_TAX'].includes(values.incentive_basis)) throw new AppError('Invalid incentive basis', 400);
    for (const key of ['incentive_rate', 'incentive_min_sale_amount']) {
      if (values[key] === undefined) continue;
      const parsed = Number(values[key]);
      if (!Number.isFinite(parsed) || parsed < 0 || (key === 'incentive_rate' && parsed > 100)) throw new AppError(`Invalid ${key.replaceAll('_', ' ')}`, 400);
      values[key] = parsed;
    }
    if (values.fy_start_month !== undefined) {
      const legacyMonths = { january: 1, april: 4, july: 7 };
      const month = legacyMonths[String(values.fy_start_month).toLowerCase()] || Number(values.fy_start_month);
      if (!Number.isInteger(month) || month < 1 || month > 12) throw new AppError('Financial year start must be a valid month', 400);
      values.fy_start_month = month;
    }
    const [updated] = await tenant.update(values, { where: { id: req.tenantId } });
    if (!updated) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) { next(error); }
};
