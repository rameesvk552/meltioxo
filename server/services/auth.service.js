const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../models');
const { AppError } = require('../middleware/errorHandler');
const config = require('../config/jwt');
const { seedChartOfAccounts } = require('../seeders/seed-chart-of-accounts');

exports.register = async (data) => {
  const t = await db.sequelize.transaction();
  try {
    // Create tenant
    const newTenant = await db.tenant.create({
      name: data.company_name,
      slug: data.company_name.toLowerCase().replace(/\s+/g, '-'),
      email: data.email,
      currency: data.currency || 'INR',
      tax_system: data.tax_system || 'GST',
      fy_start_month: data.fy_start_month || 4,
    }, { transaction: t });
    
    // Create admin user
    const hashedPassword = await bcrypt.hash(data.password, 12);
    const newUser = await db.user.create({
      tenant_id: newTenant.id,
      name: data.name,
      email: data.email,
      password_hash: hashedPassword,
      role: 'admin'
    }, { transaction: t });

    // Seed Chart of Accounts
    await seedChartOfAccounts(newTenant.id, t);

    await t.commit();
    const tokens = this.generateTokens(newUser);
    return { user: newUser, tenant: newTenant, tokens };
  } catch (error) {
    await t.rollback();
    throw new AppError('Registration failed: ' + error.message, 400);
  }
};

exports.login = async (email, password) => {
  const foundUser = await db.user.findOne({ 
    where: { email },
    include: [{ model: db.tenant }]
  });
  if (!foundUser || !(await bcrypt.compare(password, foundUser.password_hash))) {
    throw new AppError('Incorrect email or password', 401);
  }
  if (!foundUser.is_active) {
    throw new AppError('Account is deactivated', 401);
  }
  // Update last login
  await foundUser.update({ last_login: new Date() });
  const tokens = this.generateTokens(foundUser);
  return { user: foundUser, tokens };
};

exports.generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, role: user.role, tenant_id: user.tenant_id },
    config.secret,
    { expiresIn: config.accessExpiration }
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    config.secret,
    { expiresIn: config.refreshExpiration }
  );
  return { accessToken, refreshToken };
};

exports.refreshAccessToken = async (refreshTokenStr) => {
  try {
    const decoded = jwt.verify(refreshTokenStr, config.secret);
    const user = await db.user.findByPk(decoded.id);
    if (!user) throw new AppError('User not found', 401);
    if (!user.is_active) throw new AppError('Account is deactivated', 401);
    const tokens = this.generateTokens(user);
    return tokens;
  } catch (error) {
    throw new AppError('Invalid refresh token', 401);
  }
};
