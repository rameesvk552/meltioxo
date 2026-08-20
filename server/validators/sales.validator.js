const { z } = require('zod');

exports.createCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  billing_address: z.string().optional(),
  shipping_address: z.string().optional(),
  tax_number: z.string().optional()
});

exports.updateCustomerSchema = exports.createCustomerSchema.partial();

exports.createSalesOrderSchema = z.object({
  customer_id: z.string().uuid(),
  order_date: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    finished_good_id: z.string().uuid(),
    quantity: z.number().positive(),
    unit_price: z.number().nonnegative(),
    tax_rate: z.number().nonnegative().optional()
  })).min(1)
});

exports.updateSalesOrderSchema = exports.createSalesOrderSchema.partial();
