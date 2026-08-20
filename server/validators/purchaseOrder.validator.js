const { z } = require('zod');

exports.createPurchaseOrderSchema = z.object({
  supplier_id: z.string().uuid(),
  order_date: z.string().datetime().optional(),
  expected_date: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    material_type: z.enum(['raw', 'packaging']),
    material_id: z.string().uuid(),
    quantity: z.number().positive(),
    unit_price: z.number().nonnegative(),
    tax_rate: z.number().nonnegative().optional()
  })).min(1)
});

exports.updatePurchaseOrderSchema = exports.createPurchaseOrderSchema.partial();
