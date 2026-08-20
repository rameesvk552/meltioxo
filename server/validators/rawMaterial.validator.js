const { z } = require('zod');

exports.createRawMaterialSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string().trim().min(1).max(100),
  unit_of_measure: z.string().min(1),
  reorder_level: z.number().nonnegative().optional(),
  cost_price: z.number().nonnegative().optional(),
  description: z.string().optional()
});

exports.updateRawMaterialSchema = exports.createRawMaterialSchema.partial();
