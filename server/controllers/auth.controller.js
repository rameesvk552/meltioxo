const authService = require('../services/auth.service');

exports.register = async (req, res, next) => {
  try {
    res.status(201).json(await authService.register(req.body));
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    res.status(200).json(await authService.login(req.body.email, req.body.password));
  } catch (error) {
    next(error);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    res.status(200).json({ tokens: await authService.refreshAccessToken(req.body.refreshToken) });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    res.status(200).json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    res.status(200).json({ user: req.user });
  } catch (error) {
    next(error);
  }
};
