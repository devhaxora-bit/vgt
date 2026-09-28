export type BookingRegisterRow = {
    id: string;
    cn_no: string;
    bkg_date: string | null;
    booking_branch: string | null;
    dest_branch: string | null;
    delivery_point: string | null;
    delivery_type: string | null;
    bkg_basis: string | null;
    consignor_name: string | null;
    consignee_name: string | null;
    billing_party: string | null;
    billing_party_code: string | null;
    billing_party_id: string | null;
    no_of_pkg: number | null;
    total_qty: number | null;
    actual_weight: number | null;
    charged_weight: number | null;
    load_unit: string | null;
    total_freight: number;
    vehicle_no: string | null;
    cancel_cn: boolean;
    bill_status: 'BILLED' | 'UNBILLED';
    bill_ref_no: string | null;
    bill_id: string | null;
};

export type BookingRegisterSummary = {
    count: number;
    freight_total: number;
    tbb_count: number;
    billed_count: number;
    unbilled_count: number;
    cancelled_count: number;
};
