const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const { user } = require('../models');
const config = require('../config/jwt');

exports.authenticate = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    const decoded = jwt.verify(token, config.secret);
    const currentUser = await user.findByPk(decoded.id);

    if (!currentUser) {
      return next(new AppError('The user belonging to this token does no longer exist.', 401));
    }

    req.user = currentUser;
    next();
  } catch (err) {
    next(new AppError('Invalid token or token expired', 401));
  }
};
