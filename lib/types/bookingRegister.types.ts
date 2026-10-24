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
    /**
     * Unique vehicle-days in the filtered set.
     * Same vehicle + same booking date with multiple LRs = 1.
     * Same vehicle on a different day = another count.
     */
    vehicle_count: number;
};

/** One vehicle on one booking date (may cover multiple LRs). */
export type BookingRegisterVehicleDay = {
    vehicle_no: string;
    bkg_date: string;
    lr_count: number;
    freight_total: number;
    cn_nos: string[];
    booking_branch: string | null;
};
