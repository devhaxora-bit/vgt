/** Shared types for the Query / Lookup module. */

export type QueryEntity = 'cns' | 'challan' | 'bill' | 'truck' | 'party';

/** A consignment row as returned by the search/detail consignment APIs. */
export interface QueryConsignment {
    id: string;
    cn_no: string;
    bkg_date?: string | null;
    booking_branch?: string | null;
    loading_point?: string | null;
    dest_branch?: string | null;
    delivery_point?: string | null;
    consignor_name?: string | null;
    consignee_name?: string | null;
    invoice_no?: string | null;
    vehicle_no?: string | null;
    no_of_pkg?: number | null;
    total_qty?: number | null;
    goods_class?: string | null;
    goods_desc?: string | null;
    actual_weight?: number | null;
    charged_weight?: number | null;
    load_unit?: string | null;
    freight_rate?: number | null;
    basic_freight?: number | null;
    unload_charges?: number | null;
    retention_charges?: number | null;
    extra_km_charges?: number | null;
    mhc_charges?: number | null;
    door_coll_charges?: number | null;
    door_del_charges?: number | null;
    traffic_challan_charges?: number | null;
    other_charges?: number | null;
    total_freight?: number | null;
    advance_amount?: number | null;
    balance_amount?: number | null;
    freight_included?: boolean | null;
    parent_cn_id?: string | null;
    [key: string]: unknown;
}

/** Generic suggestion row shown in the type-ahead dropdown. */
export interface QuerySuggestion {
    /** Stable identifier used to load the full record. */
    value: string;
    /** Bold primary line. */
    primary: string;
    /** Muted secondary line. */
    secondary?: string;
    /** Optional right-aligned trailing label (e.g. amount, date). */
    trailing?: string;
    /** Original record, for callers that want extra fields. */
    raw?: Record<string, unknown>;
}

/** Bill search row. */
export interface QueryBillSummary {
    id: string;
    bill_ref_no: string | null;
    billing_date: string | null;
    amount: number | null;
    status: string;
    party_id: string;
    party_name: string;
    party_code: string | null;
    covered_count: number;
}

export interface QueryBillParty {
    id: string;
    name: string;
    code: string;
    type: string;
    phone?: string | null;
    gstin?: string | null;
    address?: string | null;
    branch_code?: string | null;
}

export interface QueryBillDetail {
    record: Record<string, unknown>;
    party: QueryBillParty & { branch_name?: string | null };
    consignments: QueryConsignment[];
    party_summary: QueryPartySummary | null;
}

export interface QueryChallanLink {
    cn_no: string;
    loading_point?: string | null;
    delivery_point?: string | null;
    dest_branch?: string | null;
    goods_class?: string | null;
    goods_desc?: string | null;
    no_of_pkg?: number | null;
    total_qty?: number | null;
    actual_weight?: number | null;
    charged_weight?: number | null;
    load_unit?: string | null;
}

/** A bill that a record (CN / challan) is linked to. */
export interface QueryLinkedBill {
    id: string;
    bill_ref_no: string | null;
    billing_date: string | null;
    amount: number;
    status: string;
    party_name?: string | null;
    broker_name?: string | null;
}

/** A payment receipt shown against a linked bill. */
export interface QueryLinkedPayment {
    id: string;
    receipt_date: string | null;
    amount: number;
    payment_mode?: string | null;
    reference_no?: string | null;
    status: string;
}

/** Full CNS lookup payload: the consignment plus its included children and billing status. */
export interface QueryCnsDetail {
    consignment: Record<string, unknown>;
    children: QueryConsignment[];
    parent_cn_no: string | null;
    bill: QueryLinkedBill | null;
}

/** Full challan lookup payload: the challan plus its hire settlement and payment status. */
export interface QueryChallanDetail {
    challan: Record<string, unknown>;
    settlement: {
        gross_hire: number;
        advance: number;
        tds: number;
        balance_payable: number;
    };
    broker_bill: QueryLinkedBill | null;
    payments: QueryLinkedPayment[];
    paid_total: number;
    pending_amount: number;
}

/** Party ledger snapshot shown inside the bill query. */
export interface QueryPartySummary {
    opening_balance: number;
    total_billed: number;
    total_paid: number;
    outstanding: number;
    unbilled_amount: number;
}

export interface QueryTruckDetail {
    vehicle_no: string;
    vehicle: Record<string, unknown> | null;
    consignments: QueryConsignment[];
    challans: Array<Record<string, unknown>>;
    totals: {
        cn_count: number;
        challan_count: number;
        total_freight: number;
        total_hire: number;
    };
}

/** Party search suggestion row. */
export interface QueryPartySummaryRow {
    id: string;
    name: string;
    code: string | null;
    gstin: string | null;
    phone: string | null;
    branch_code: string | null;
    branch_name: string | null;
    outstanding: number;
    total_billed: number;
    total_paid: number;
}

export interface QueryPartyBillRow {
    id: string;
    bill_ref_no: string | null;
    billing_date: string | null;
    amount: number;
    paid_amount: number;
    balance_amount: number;
    status: string;
    covered_count: number;
}

export interface QueryPartyPaymentRow {
    id: string;
    receipt_date: string | null;
    amount: number;
    payment_mode: string | null;
    reference_no: string | null;
    status: string;
    linked_bills: string;
}

export interface QueryPartyChallanRow {
    id: string;
    challan_no: string;
    date_from: string | null;
    vehicle_no: string | null;
    broker_name: string | null;
    total_hire_amount: number;
    linked_cn_count: number;
}

export interface QueryPartyDetail {
    party: QueryBillParty & { branch_name?: string | null };
    summary: QueryPartySummary & {
        total_cns_amount: number;
        total_cns_count: number;
        total_bills_count: number;
        overbilled_amount: number;
    };
    bills: QueryPartyBillRow[];
    payments: QueryPartyPaymentRow[];
    consignments: QueryConsignment[];
    challans: QueryPartyChallanRow[];
}
