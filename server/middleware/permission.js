const { AppError } = require('./errorHandler');
const { VIEW_PERMISSION_KEYS, DASHBOARD_WIDGET_KEYS } = require('../config/permissions');

const privilegedRoles = ['super_admin', 'admin'];

const hasPermission = (user, collection, permission) => {
  if (!user || !permission) return false;
  if (privilegedRoles.includes(user.role)) return true;
  if (!user.permissions || typeof user.permissions !== 'object') return true;
  return Array.isArray(user.permissions[collection])
    && user.permissions[collection].includes(permission);
};

exports.hasViewPermission = (user, permission) => hasPermission(user, 'views', permission);
exports.hasDashboardWidgetPermission = (user, permission) => hasPermission(user, 'dashboard_widgets', permission);

// Use this for data endpoints that back a screen.  The browser's navigation
// guards are useful UX, but they must not be the only protection because an
// API URL can be called directly.
exports.requireViewPermission = (...permissions) => {
  return (req, res, next) => {
    if (permissions.some(permission => exports.hasViewPermission(req.user, permission))) return next();
    return next(new AppError('You do not have permission to view this information', 403));
  };
};

exports.normalizePermissions = permissions => {
  if (permissions === null || permissions === undefined) return null;
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    throw new AppError('Permissions must contain view and dashboard widget selections', 400);
  }

  const views = Array.isArray(permissions.views) ? [...new Set(permissions.views)] : null;
  const dashboardWidgets = Array.isArray(permissions.dashboard_widgets)
    ? [...new Set(permissions.dashboard_widgets)]
    : null;
  if (!views || !dashboardWidgets) {
    throw new AppError('Permissions must include views and dashboard_widgets arrays', 400);
  }

  const invalidView = views.find(key => !VIEW_PERMISSION_KEYS.includes(key));
  const invalidWidget = dashboardWidgets.find(key => !DASHBOARD_WIDGET_KEYS.includes(key));
  if (invalidView || invalidWidget) {
    throw new AppError(`Unknown permission: ${invalidView || invalidWidget}`, 400);
  }

  return { views, dashboard_widgets: dashboardWidgets };
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};
