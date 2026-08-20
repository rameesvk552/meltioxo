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
    const [updated] = await tenant.update(req.body, { where: { id: req.tenantId } });
    if (!updated) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) { next(error); }
};
