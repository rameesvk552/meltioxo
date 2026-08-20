module.exports = {
  secret: process.env.JWT_SECRET || 'super-secret-jwt-key',
  accessExpiration: '15m',
  refreshExpiration: '7d'
};
