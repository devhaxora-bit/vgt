import { createClient } from '@/utils/supabase/server';
import { NextResponse } from "next/server";
import { resolveBillingPartyId } from '@/lib/server/resolveBillingParty';

type ManagedCnRange = {
    id: string;
    range_start: number;
    range_end: number;
    next_cn_no: number;
    status: 'active' | 'exhausted' | 'inactive';
};

const parseCnInteger = (value: unknown) => {
    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? null : parsed;
};

const getBranchCnContext = async (supabase: Awaited<ReturnType<typeof createClient>>, branchCode: string) => {
    const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id, code, next_cn_no')
        .eq('code', branchCode)
        .single();

    if (branchError || !branch) {
        return { error: `Booking branch ${branchCode} was not found.` };
    }

    const { data: cnRanges, error: cnRangesError } = await supabase
        .from('branch_cn_ranges')
        .select('id, range_start, range_end, next_cn_no, status')
        .eq('branch_id', branch.id)
        .order('created_at', { ascending: false });

    if (cnRangesError) {
        return { error: cnRangesError.message };
    }

    const activeRange = ((cnRanges || []) as ManagedCnRange[]).find((range) => range.status === 'active') || null;
    const latestRange = ((cnRanges || []) as ManagedCnRange[])[0] || null;

    if (activeRange) {
        const { data: normalizedNextValue, error: normalizedNextError } = await supabase.rpc('next_available_branch_cn', {
            p_range_id: activeRange.id,
            p_candidate: activeRange.next_cn_no,
        });

        if (normalizedNextError) {
            return { error: normalizedNextError.message };
        }

        const expectedCn = parseCnInteger(normalizedNextValue);

        return {
            branch,
            mode: 'range' as const,
            activeRange,
            latestRange,
            expectedCn,
        };
    }

    return {
        branch,
        mode: (latestRange ? 'range' : 'legacy') as 'range' | 'legacy',
        activeRange: null,
        latestRange,
        expectedCn: latestRange ? null : Number(branch.next_cn_no || 800001),
    };
};

export async function GET(request: Request) {
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    let query = supabase
        .from("consignments")
        .select("*")
        .order("cn_no", { ascending: false });

    if (search) {
        query = query.or(`cn_no.ilike.%${search}%,dest_branch.ilike.%${search}%`);
    }
    if (dateFrom) {
        query = query.gte("bkg_date", dateFrom);
    }
    if (dateTo) {
        query = query.lte("bkg_date", dateTo);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Failed to fetch consignments:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
}

export async function POST(request: Request) {
    const supabase = await createClient();

    // Get authenticated user
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const insertData: Record<string, unknown> = {
        cn_no: body.cn_no,
        bkg_date: body.bkg_date || new Date().toISOString().split("T")[0],
        booking_branch: body.booking_branch,
        dest_branch: body.dest_branch,
        loading_point: body.loading_point,
        delivery_point: body.delivery_point,
        delivery_type: body.delivery_type,
        distance_km: parseInt(body.distance_km) || 0,
        owner_risk: body.owner_risk ?? true,
        door_collection: body.door_collection ?? false,
        cancel_cn: body.cancel_cn ?? false,
        bkg_basis: body.bkg_basis,

        // Consignor
        consignor_name: body.consignor_name,
        consignor_code: body.consignor_code,
        consignor_gst: body.consignor_gst,
        consignor_address: body.consignor_address,
        consignor_pincode: body.consignor_pincode,
        consignor_mobile: body.consignor_mobile,
        consignor_email: body.consignor_email,

        // Consignee
        consignee_name: body.consignee_name,
        consignee_code: body.consignee_code,
        consignee_gst: body.consignee_gst,
        consignee_address: body.consignee_address,
        consignee_pincode: body.consignee_pincode,
        consignee_mobile: body.consignee_mobile,
        consignee_email: body.consignee_email,

        // Billing
        billing_party: body.billing_party,
        billing_party_code: body.billing_party_code,
        billing_party_gst: body.billing_party_gst,
        billing_party_address: body.billing_party_address,
        billing_branch: body.billing_branch,
        // billing_party_id will be set below after party lookup

        // Package & Goods
        no_of_pkg: parseInt(body.no_of_pkg) || 0,
        total_qty: parseInt(body.total_qty) || 0,
        is_loose: body.is_loose ?? false,
        packages: body.packages || [],
        goods_class: body.goods_class,
        goods_value: parseFloat(body.goods_value) || 0,
        goods_desc: body.goods_desc,
        hsn_desc: body.hsn_desc,
        cod_amount: parseFloat(body.cod_amount) || 0,
        actual_weight: parseFloat(body.actual_weight) || 0,
        charged_weight: parseFloat(body.charged_weight) || 0,
        load_unit: body.load_unit || "KG",
        dimension_l: parseFloat(body.dimension_l) || 0,
        dimension_w: parseFloat(body.dimension_w) || 0,
        dimension_h: parseFloat(body.dimension_h) || 0,
        volume: parseFloat(body.volume) || 0,
        private_mark: body.private_mark,

        // Freight
        freight_pending: body.freight_pending ?? false,
        freight_rate: parseFloat(body.freight_rate) || 0,
        basic_freight: parseFloat(body.basic_freight) || 0,
        unload_charges: parseFloat(body.unload_charges) || 0,
        retention_charges: parseFloat(body.retention_charges) || 0,
        extra_km_charges: parseFloat(body.extra_km_charges) || 0,
        mhc_charges: parseFloat(body.mhc_charges) || 0,
        door_coll_charges: parseFloat(body.door_coll_charges) || 0,
        door_del_charges: parseFloat(body.door_del_charges) || 0,
        other_charges: parseFloat(body.other_charges) || 0,
        total_freight: parseFloat(body.total_freight) || 0,
        advance_amount: parseFloat(body.advance_amount) || 0,
        balance_amount: parseFloat(body.balance_amount) || 0,

        // Invoice
        invoice_no: body.invoice_no,
        invoice_date: body.invoice_date || null,
        invoice_amount: parseFloat(body.invoice_amount) || 0,
        indent_no: body.indent_no,
        indent_date: body.indent_date || null,
        eway_bill: body.eway_bill,
        eway_from_date: body.eway_from_date || null,
        eway_to_date: body.eway_to_date || null,

        // Insurance
        insurance_company: body.insurance_company,
        policy_no: body.policy_no,
        policy_date: body.policy_date || null,
        policy_amount: parseFloat(body.policy_amount) || 0,
        po_no: body.po_no,
        po_date: body.po_date || null,
        stf_no: body.stf_no,
        stf_date: body.stf_date || null,
        stf_valid_upto: body.stf_valid_upto || null,

        // Others
        business_type: body.business_type || "REGULAR",
        transport_mode: body.transport_mode || "BY ROAD",
        doc_prepared_by: body.doc_prepared_by,
        remarks: body.remarks,
        vehicle_no: body.vehicle_no,
        amount_in_words: body.amount_in_words,

        created_by: user.id,
    };

    const { billingPartyId, error: billingPartyError } = await resolveBillingPartyId(supabase, body);
    if (billingPartyError) {
        return NextResponse.json({ error: billingPartyError }, { status: 400 });
    }

    if (billingPartyId) {
        insertData.billing_party_id = billingPartyId;
    }

    if (typeof insertData.booking_branch !== "string" || !insertData.booking_branch) {
        return NextResponse.json({ error: "Booking branch is required" }, { status: 400 });
    }

    const bookingBranchCode = insertData.booking_branch.toUpperCase();
    const submittedCnNo = parseCnInteger(insertData.cn_no);
    const branchCnContext = await getBranchCnContext(supabase, bookingBranchCode);

    if (branchCnContext.error) {
        return NextResponse.json({ error: branchCnContext.error }, { status: 400 });
    }

    if (branchCnContext.mode === 'range') {
        if (!branchCnContext.activeRange) {
            const exhaustedRange = branchCnContext.latestRange;
            const message = exhaustedRange?.status === 'exhausted'
                ? `CN range ${exhaustedRange.range_start}-${exhaustedRange.range_end} is exhausted for branch ${bookingBranchCode}. Update Branch Management with a new range before creating more CNs.`
                : `No active CN range is configured for branch ${bookingBranchCode}. Update Branch Management before creating more CNs.`;

            return NextResponse.json({ error: message }, { status: 409 });
        }

        if (submittedCnNo === null) {
            return NextResponse.json({ error: 'CN number must be numeric for range-managed branches.' }, { status: 400 });
        }

        if (branchCnContext.expectedCn === null || branchCnContext.expectedCn > Number(branchCnContext.activeRange.range_end)) {
            return NextResponse.json({
                error: `CN range ${branchCnContext.activeRange.range_start}-${branchCnContext.activeRange.range_end} is exhausted for branch ${bookingBranchCode}. Update Branch Management with a new range before creating more CNs.`,
            }, { status: 409 });
        }

        if (submittedCnNo !== branchCnContext.expectedCn) {
            return NextResponse.json({
                error: `CN Number "${insertData.cn_no}" is not the next available CN for branch ${bookingBranchCode}. Expected ${branchCnContext.expectedCn}.`,
            }, { status: 409 });
        }

        const { error: advanceError } = await supabase.rpc('advance_branch_cn_sequence', {
            p_branch_code: bookingBranchCode,
            p_cn_no: submittedCnNo,
        });

        if (advanceError) {
            return NextResponse.json({ error: advanceError.message }, { status: 409 });
        }
    } else {
        if (submittedCnNo === null) {
            return NextResponse.json({ error: 'CN number must be numeric.' }, { status: 400 });
        }

        if (submittedCnNo !== branchCnContext.expectedCn) {
            return NextResponse.json({
                error: `CN Number "${insertData.cn_no}" is not the next available legacy CN for branch ${bookingBranchCode}. Expected ${branchCnContext.expectedCn}.`,
            }, { status: 409 });
        }

        const { data: legacyUpdateRows, error: legacyUpdateError } = await supabase
            .from('branches')
            .update({ next_cn_no: submittedCnNo + 1 })
            .eq('code', bookingBranchCode)
            .eq('next_cn_no', submittedCnNo)
            .select('id');

        if (legacyUpdateError) {
            return NextResponse.json({ error: legacyUpdateError.message }, { status: 409 });
        }

        if (!legacyUpdateRows || legacyUpdateRows.length === 0) {
            return NextResponse.json({
                error: `CN Number "${insertData.cn_no}" is no longer available for branch ${bookingBranchCode}. Refresh the form and try again.`,
            }, { status: 409 });
        }
    }

    const { data, error } = await supabase
        .from("consignments")
        .insert(insertData)
        .select()
        .single();

    if (error) {
        console.error("Failed to create consignment:", error);

        if (branchCnContext.mode === 'legacy' && submittedCnNo !== null) {
            await supabase
                .from("branches")
                .update({ next_cn_no: submittedCnNo })
                .eq("code", bookingBranchCode);
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}
