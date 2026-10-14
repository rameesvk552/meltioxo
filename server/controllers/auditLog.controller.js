const { Op } = require('sequelize');
const db = require('../models');
const { AppError } = require('../middleware/errorHandler');

exports.getAll = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(req.query.page_size, 10) || 50));
    const where = { tenant_id: req.tenantId };

    if (req.query.action) where.action = req.query.action;
    if (req.query.entity_type) where.entity_type = req.query.entity_type;
    if (req.query.actor_user_id) where.actor_user_id = req.query.actor_user_id;
    if (req.query.entity_id) where.entity_id = req.query.entity_id;
    if (req.query.from || req.query.to) {
      where.created_at = {
        ...(req.query.from ? { [Op.gte]: new Date(`${req.query.from}T00:00:00.000Z`) } : {}),
        ...(req.query.to ? { [Op.lte]: new Date(`${req.query.to}T23:59:59.999Z`) } : {})
      };
    }
    if (req.query.search) {
      const search = `%${req.query.search}%`;
      where[Op.or] = [
        { actor_name: { [Op.iLike]: search } },
        { actor_email: { [Op.iLike]: search } },
        { entity_type: { [Op.iLike]: search } },
        { entity_id: { [Op.iLike]: search } },
        { route: { [Op.iLike]: search } }
      ];
    }

    const result = await db.auditLog.findAndCountAll({
      where,
      include: [{
        model: db.user,
        as: 'actor',
        attributes: ['id', 'name', 'email', 'role'],
        required: false
      }],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      distinct: true
    });

    res.json({
      data: result.rows,
      pagination: { page, page_size: pageSize, total: result.count, total_pages: Math.ceil(result.count / pageSize) }
    });
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await db.auditLog.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      include: [{ model: db.user, as: 'actor', attributes: ['id', 'name', 'email', 'role'], required: false }]
    });
    if (!item) throw new AppError('Audit log not found', 404);
    res.json(item);
  } catch (error) { next(error); }
};

exports.getFilters = async (req, res, next) => {
  try {
    const [actions, entities, actors] = await Promise.all([
      db.auditLog.findAll({ where: { tenant_id: req.tenantId }, attributes: ['action'], group: ['action'], order: [['action', 'ASC']], raw: true }),
      db.auditLog.findAll({ where: { tenant_id: req.tenantId }, attributes: ['entity_type'], group: ['entity_type'], order: [['entity_type', 'ASC']], raw: true }),
      db.auditLog.findAll({ where: { tenant_id: req.tenantId, actor_user_id: { [Op.ne]: null } }, attributes: ['actor_user_id', 'actor_name', 'actor_email'], group: ['actor_user_id', 'actor_name', 'actor_email'], order: [['actor_name', 'ASC']], raw: true })
    ]);
    res.json({
      actions: actions.map(row => row.action),
      entity_types: entities.map(row => row.entity_type),
      actors
    });
  } catch (error) { next(error); }
};
