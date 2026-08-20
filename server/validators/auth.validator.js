const { z } = require('zod');

exports.registerSchema = z.object({
  company_name: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  currency: z.string().optional(),
  tax_system: z.string().optional(),
  fy_start_month: z.number().min(1).max(12).optional()
});

exports.loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});
