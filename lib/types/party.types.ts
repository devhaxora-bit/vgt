import { z } from 'zod';

export interface Party {
    id: string;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    pincode: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    branch_code?: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export const PartySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    code: z.string().length(6, 'Code must be exactly 6 digits').regex(/^\d+$/, 'Code must be numeric'),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    pincode: z.preprocess(
        (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
        z.string().length(6, 'Pincode must be 6 digits').optional().nullable(),
    ),
    state: z.string().optional().nullable(),
    phone: z.preprocess(
        (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
        z.string().regex(/^\d{10}$/, 'Phone must be 10 digits').optional().nullable(),
    ),
    email: z.preprocess(
        (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
        z.string().email('Invalid email').optional().nullable(),
    ),
    gstin: z.preprocess(
        (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
        z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN').optional().nullable(),
    ),
    branch_code: z.string().optional().nullable(),
    is_active: z.boolean().default(true),
});

export type PartyInput = z.infer<typeof PartySchema>;
