import type { LorryHirePaymentInput } from '@/lib/schemas/lorryHire.schema';
export interface LorryHireChallan {
    id: string; challan_no: string; vehicle_no: string; date_from: string;
    origin_branch_code: string; owner_name: string | null; broker_name: string | null;
    linked_cn_nos?: string[] | null;
    total_hire_amount: number; extra_hire_amount: number; advance_amount: number; less_tds: number;
    recorded_advance: number; paid_amount: number; remaining: number;
}
export interface LorryHirePayment extends LorryHirePaymentInput {
    id: string; created_at: string; net_paid_amount: number; active: boolean;
}
export interface LorryHireData {
    challans: LorryHireChallan[]; payments: LorryHirePayment[]; can_pay: boolean;
}
