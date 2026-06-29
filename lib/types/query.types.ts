/** Shared types for the Query / Lookup module. */

export type QueryEntity = 'cns' | 'challan' | 'bill' | 'truck';

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
    party: QueryBillParty;
    consignments: QueryConsignment[];
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
