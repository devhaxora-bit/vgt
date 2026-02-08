import { z } from 'zod';

export const PARTY_TYPES = ['consignor', 'consignee', 'billing'] as const;
export type PartyType = typeof PARTY_TYPES[number];

export interface Party {
    id: string;
    name: string;
    code: string; // 6 digit code
    address: string | null;
    city: string | null;
    pincode: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    type: PartyType;
    branch_code?: string | null; // For billing parties linked to a branch
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export const PartySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    code: z.string().length(6, 'Code must be exactly 6 digits').regex(/^\d+$/, 'Code must be numeric'),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    pincode: z.string().length(6, 'Pincode must be 6 digits').optional().nullable(),
    state: z.string().optional().nullable(),
    phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits').optional().nullable(),
    email: z.string().email('Invalid email').optional().nullable(),
    gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN').optional().nullable(),
    type: z.enum(PARTY_TYPES),
    branch_code: z.string().optional().nullable(),
    is_active: z.boolean().default(true),
});

export type PartyInput = z.infer<typeof PartySchema>;
