const { z } = require('zod');

exports.createFormulaSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  output_quantity: z.number().positive(),
  unit_of_measure: z.string().min(1),
  ingredients: z.array(z.object({
    raw_material_id: z.string().uuid(),
    quantity: z.number().positive(),
    unit_of_measure: z.string().min(1)
  })).optional(),
  packaging: z.array(z.object({
    packaging_material_id: z.string().uuid(),
    quantity: z.number().positive()
  })).optional()
});

exports.updateFormulaSchema = exports.createFormulaSchema.partial();
