const { z } = require('zod');

const quantity = z.number().finite().positive().refine(value => Math.abs(value * 10000 - Math.round(value * 10000)) < 0.000001, 'Use at most four decimal places');

exports.createRawMaterialMixSchema = z.object({
  output_material_id: z.string().uuid().optional(),
  new_material: z.object({
    name: z.string().trim().min(1).max(255),
    category: z.string().trim().min(1).max(100),
    unit: z.enum(['kg', 'g', 'L', 'ml', 'pcs']),
    sku: z.string().trim().max(100).optional()
  }).optional(),
  output_quantity: quantity,
  ingredients: z.array(z.object({ material_id: z.string().uuid(), quantity })).min(1).max(100),
  notes: z.string().trim().max(2000).optional()
}).superRefine((value, context) => {
  if (Boolean(value.output_material_id) === Boolean(value.new_material)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Select an output material or enter a new one' });
  }
  const ids = value.ingredients.map(item => item.material_id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Add each input material only once' });
  if (ids.includes(value.output_material_id)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'An output material cannot also be an input' });
});
