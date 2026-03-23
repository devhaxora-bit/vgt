import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

const parseNumber = (value: unknown, fallback = 0) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
};

const parseInteger = (value: unknown, fallback = 0) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};

const normalizeDate = (value: unknown) => {
    const normalized = String(value ?? "").trim();
    return normalized || null;
};

const getCurrentUserRole = async () => {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { supabase, user: null, role: null };
    }

    const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

    return { supabase, user, role: profile?.role ?? null };
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user } = await getCurrentUserRole();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const { data, error } = await supabase
            .from("consignments")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Failed to fetch consignment:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { supabase, user, role } = await getCurrentUserRole();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();

        const updateData = {
            cn_no: body.cn_no,
            bkg_date: normalizeDate(body.bkg_date),
            booking_branch: body.booking_branch,
            dest_branch: body.dest_branch,
            delivery_type: body.delivery_type,
            distance_km: parseInteger(body.distance_km),
            owner_risk: body.owner_risk ?? true,
            door_collection: body.door_collection ?? false,
            cancel_cn: body.cancel_cn ?? false,
            bkg_basis: body.bkg_basis,
            consignor_name: body.consignor_name,
            consignor_code: body.consignor_code,
            consignor_gst: body.consignor_gst,
            consignor_address: body.consignor_address,
            consignor_mobile: body.consignor_mobile,
            consignor_email: body.consignor_email,
            consignee_name: body.consignee_name,
            consignee_code: body.consignee_code,
            consignee_gst: body.consignee_gst,
            consignee_address: body.consignee_address,
            consignee_mobile: body.consignee_mobile,
            consignee_email: body.consignee_email,
            billing_party: body.billing_party,
            billing_party_code: body.billing_party_code,
            billing_party_gst: body.billing_party_gst,
            billing_party_address: body.billing_party_address,
            billing_branch: body.billing_branch,
            no_of_pkg: parseInteger(body.no_of_pkg),
            total_qty: parseInteger(body.total_qty),
            is_loose: body.is_loose ?? false,
            packages: body.packages || [],
            goods_value: parseNumber(body.goods_value),
            hsn_desc: body.hsn_desc,
            actual_weight: parseNumber(body.actual_weight),
            charged_weight: parseNumber(body.charged_weight),
            load_unit: body.load_unit || "KG",
            dimension_l: parseNumber(body.dimension_l),
            dimension_w: parseNumber(body.dimension_w),
            dimension_h: parseNumber(body.dimension_h),
            volume: parseNumber(body.volume),
            private_mark: body.private_mark,
            freight_pending: body.freight_pending ?? false,
            freight_rate: parseNumber(body.freight_rate),
            basic_freight: parseNumber(body.basic_freight),
            unload_charges: parseNumber(body.unload_charges),
            retention_charges: parseNumber(body.retention_charges),
            extra_km_charges: parseNumber(body.extra_km_charges),
            mhc_charges: parseNumber(body.mhc_charges),
            door_coll_charges: parseNumber(body.door_coll_charges),
            door_del_charges: parseNumber(body.door_del_charges),
            other_charges: parseNumber(body.other_charges),
            total_freight: parseNumber(body.total_freight),
            advance_amount: parseNumber(body.advance_amount),
            balance_amount: parseNumber(body.balance_amount),
            invoice_no: body.invoice_no,
            invoice_date: normalizeDate(body.invoice_date),
            invoice_amount: parseNumber(body.invoice_amount),
            eway_bill: body.eway_bill,
            eway_from_date: normalizeDate(body.eway_from_date),
            eway_to_date: normalizeDate(body.eway_to_date),
            insurance_company: body.insurance_company,
            policy_no: body.policy_no,
            policy_date: normalizeDate(body.policy_date),
            policy_amount: parseNumber(body.policy_amount),
            po_no: body.po_no,
            po_date: normalizeDate(body.po_date),
            stf_no: body.stf_no,
            stf_date: normalizeDate(body.stf_date),
            stf_valid_upto: normalizeDate(body.stf_valid_upto),
            business_type: body.business_type || "REGULAR",
            transport_mode: body.transport_mode || "BY ROAD",
            doc_prepared_by: body.doc_prepared_by,
            vehicle_no: body.vehicle_no,
            truck_no: body.vehicle_no,
            remarks: body.remarks,
        };

        const { data, error } = await supabase
            .from("consignments")
            .update(updateData)
            .eq("id", id)
            .select("*")
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Failed to update consignment:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
