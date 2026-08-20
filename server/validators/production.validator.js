const { z } = require('zod');

exports.createProductionOrderSchema = z.object({
  finished_good_id: z.string().uuid(),
  formula_id: z.string().uuid().optional(),
  planned_qty: z.number().positive(),
  planned_date: z.string().optional(),
  batch_number: z.string().optional(),
  notes: z.string().optional()
});

exports.updateProductionOrderSchema = exports.createProductionOrderSchema.partial();
