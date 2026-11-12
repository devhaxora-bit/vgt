import { z } from 'zod';

const money = z.number().finite().nonnegative().max(99999999).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, 'Use at most two decimal places');
const item = z.object({ label: z.string().trim().min(1, 'Adjustment description is required').max(200), amount: money.refine(v => v > 0, 'Adjustment amount must be positive') });
export const lorryHirePaymentSchema = z.object({
    challan_id: z.uuid(),
    payment_type: z.enum(['ADVANCE', 'BALANCE']),
    payment_date: z.iso.date(),
    amount: money,
    payment_mode: z.enum(['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI']),
    paid_to: z.string().trim().min(1, 'Paid to is required').max(200),
    reference_no: z.string().trim().max(100),
    bank_name: z.string().trim().max(200),
    narration: z.string().trim().min(1, 'Description is required').max(1000),
    deduction_items: z.array(item).max(30),
    addition_items: z.array(item).max(30),
}).superRefine((v, ctx) => {
    const additions = v.addition_items.reduce((sum, item) => sum + item.amount, 0);
    const deductions = v.deduction_items.reduce((sum, item) => sum + item.amount, 0);
    if (v.payment_type === 'ADVANCE' && v.amount <= 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Advance must be positive' });
    if (v.amount === 0 && additions <= deductions) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter a balance amount or additions with a positive final payment' });
    if (v.amount + additions - deductions < 0) ctx.addIssue({ code: 'custom', path: ['deduction_items'], message: 'Deductions cannot exceed the balance amount plus additions' });
    if (v.payment_mode !== 'CASH') {
        if (!v.reference_no) ctx.addIssue({ code: 'custom', path: ['reference_no'], message: 'Payment reference is required' });
        if (!v.bank_name) ctx.addIssue({ code: 'custom', path: ['bank_name'], message: 'Bank name is required' });
    }
    if (v.payment_type === 'ADVANCE' && (v.addition_items.length || v.deduction_items.length)) ctx.addIssue({ code: 'custom', message: 'Add adjustments when paying the balance' });
});
export type LorryHirePaymentInput = z.infer<typeof lorryHirePaymentSchema>;
