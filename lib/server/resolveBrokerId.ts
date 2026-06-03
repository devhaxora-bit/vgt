import type { createClient } from '@/utils/supabase/server';

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

const normalizeText = (value: unknown) => String(value ?? '').trim();

export interface BrokerResolutionInput {
    engagement_type?: unknown;
    broker_id?: unknown;
    broker_code?: unknown;
}

export interface BrokerResolutionResult {
    brokerId: string | null;
    error: string | null;
}

export async function resolveBrokerId(
    supabase: SupabaseLike,
    input: BrokerResolutionInput
): Promise<BrokerResolutionResult> {
    const engagementType = normalizeText(input.engagement_type).toLowerCase() || 'broker';

    if (engagementType === 'direct') {
        return { brokerId: null, error: null };
    }

    const explicitBrokerId = normalizeText(input.broker_id);
    if (explicitBrokerId) {
        const { data, error } = await supabase
            .from('brokers')
            .select('id')
            .eq('id', explicitBrokerId)
            .eq('is_active', true)
            .maybeSingle();

        if (error) return { brokerId: null, error: error.message };
        if (!data?.id) {
            return { brokerId: null, error: 'Selected broker is not active or does not exist.' };
        }

        return { brokerId: data.id, error: null };
    }

    const brokerCode = normalizeText(input.broker_code);
    if (!brokerCode) {
        return { brokerId: null, error: null };
    }

    const { data, error } = await supabase
        .from('brokers')
        .select('id')
        .eq('is_active', true)
        .eq('code', brokerCode)
        .limit(1)
        .maybeSingle();

    if (error) return { brokerId: null, error: error.message };
    if (!data?.id) {
        return {
            brokerId: null,
            error: `Broker code "${brokerCode}" does not match an active broker.`,
        };
    }

    return { brokerId: data.id, error: null };
}
