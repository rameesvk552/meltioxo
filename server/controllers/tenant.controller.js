const { tenant } = require('../models');
const { AppError } = require('../middleware/errorHandler');

exports.getSettings = async (req, res, next) => {
  try {
    const item = await tenant.findByPk(req.tenantId);
    if (!item) throw new AppError('Not found', 404);
    res.status(200).json(item);
  } catch (error) { next(error); }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const allowed = ['name', 'address', 'phone', 'email', 'tax_id', 'logo_url', 'currency', 'tax_system', 'fy_start_month', 'date_format', 'measured_packaging_enabled', 'measured_packaging_required', 'measured_packaging_auto_select', 'show_formula_in_sales', 'packaging_material_sales_enabled'];
    const values = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
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
