const { AppError } = require('./errorHandler');

exports.validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    const message = error.errors.map(err => err.message).join(', ');
    next(new AppError(message, 400));
  }
};
