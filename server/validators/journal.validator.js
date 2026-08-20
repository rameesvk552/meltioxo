const { z } = require('zod');

exports.createJournalSchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference_type: z.string().optional(),
  reference_id: z.string().uuid().optional(),
  narration: z.string().optional(),
  lines: z.array(z.object({
    account_id: z.string().uuid(),
    description: z.string().optional(),
    debit_amount: z.number().nonnegative().optional(),
    credit_amount: z.number().nonnegative().optional()
  }).refine(line => Number(line.debit_amount || 0) > 0 !== Number(line.credit_amount || 0) > 0, {
    message: 'Each line must contain either a debit or a credit'
  })).min(2)
}).refine(data => {
  const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
  const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
  return totalDebit > 0 && Math.round(totalDebit * 100) === Math.round(totalCredit * 100);
}, {
  message: "Total debit must equal total credit"
});
