const { z } = require('zod');

exports.createPaymentSchema = z.object({
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  party_type: z.enum(['supplier', 'customer']).optional(),
  party_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method_id: z.string().uuid().optional(),
  bank_account_id: z.string().uuid().optional(),
  payment_mode: z.string().max(30).optional(),
  reference_number: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  allocations: z.array(z.object({
    invoice_type: z.enum(['sale', 'purchase']),
    invoice_id: z.string().uuid(),
    allocated_amount: z.number().positive()
  })).optional()
}).refine(value => Boolean(value.payment_method_id || value.bank_account_id || value.payment_mode), {
  message: 'Select a payment method'
});
