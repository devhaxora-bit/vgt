import type { createClient } from "@/utils/supabase/server";

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

const MANUAL_BILLING_CODE = "PERSONAL DELIVERY";

const normalizeText = (value: unknown) => String(value ?? "").trim();
const normalizeUpper = (value: unknown) => normalizeText(value).toUpperCase();

export interface BillingPartyResolutionInput {
    billing_party?: unknown;
    billing_party_code?: unknown;
    billing_party_gst?: unknown;
}

export interface BillingPartyResolutionResult {
    billingPartyId: string | null;
    error: string | null;
}

export async function resolveBillingPartyId(
    supabase: SupabaseLike,
    input: BillingPartyResolutionInput
): Promise<BillingPartyResolutionResult> {
    const billingPartyName = normalizeText(input.billing_party);
    const billingPartyCode = normalizeText(input.billing_party_code);
    const billingPartyGst = normalizeUpper(input.billing_party_gst);

    const hasBillingData = Boolean(billingPartyName || billingPartyCode || billingPartyGst);
    if (!hasBillingData) {
        return { billingPartyId: null, error: null };
    }

    if (billingPartyCode.toUpperCase() === MANUAL_BILLING_CODE) {
        return { billingPartyId: null, error: null };
    }

    if (billingPartyCode) {
        const { data, error } = await supabase
            .from("parties")
            .select("id")
            .eq("is_active", true)
            .eq("code", billingPartyCode)
            .limit(1)
            .maybeSingle();

        if (error) {
            return { billingPartyId: null, error: error.message };
        }
        if (!data?.id) {
            return {
                billingPartyId: null,
                error: `Billing party code "${billingPartyCode}" does not match an active party.`,
            };
        }

        return { billingPartyId: data.id, error: null };
    }

    if (billingPartyGst) {
        const { data, error } = await supabase
            .from("parties")
            .select("id")
            .eq("is_active", true)
            .eq("gstin", billingPartyGst);

        if (error) {
            return { billingPartyId: null, error: error.message };
        }
        if (data.length > 1) {
            return {
                billingPartyId: null,
                error: `Billing party GST "${billingPartyGst}" matches multiple active parties.`,
            };
        }
        if (data.length === 1) {
            return { billingPartyId: data[0].id, error: null };
        }
    }

    if (billingPartyName) {
        const { data, error } = await supabase
            .from("parties")
            .select("id")
            .eq("is_active", true)
            .ilike("name", billingPartyName);

        if (error) {
            return { billingPartyId: null, error: error.message };
        }
        if (data.length > 1) {
            return {
                billingPartyId: null,
                error: `Billing party name "${billingPartyName}" matches multiple active parties.`,
            };
        }
        if (data.length === 1) {
            return { billingPartyId: data[0].id, error: null };
        }
    }

    return {
        billingPartyId: null,
        error: "Billing party could not be linked to an active party. Select an existing billing party or use manual billing explicitly.",
    };
}
