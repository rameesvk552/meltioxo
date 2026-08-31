const marketingOsService = require('../services/marketingOs.service');

exports.getConnection = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await marketingOsService.getConnection(req.tenantId) });
  } catch (error) { next(error); }
};

exports.startConnection = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await marketingOsService.startConnection(req.tenantId, req.body) });
  } catch (error) { next(error); }
};

exports.completeConnection = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await marketingOsService.completeConnection(req.tenantId, req.body) });
  } catch (error) { next(error); }
};

exports.disconnectChannel = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await marketingOsService.disconnectChannel(req.tenantId, req.params.channelId) });
  } catch (error) { next(error); }
};
