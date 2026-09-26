import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sets transaction-local app.actor_id for audit triggers.
 * Only effective when called in the same DB transaction as the mutation
 * (e.g. inside an RPC). Prefer auth.uid() via the user-scoped client, or
 * row attribution columns (created_by / cancelled_by / …).
 */
export async function setAuditActor(
    client: SupabaseClient,
    actorId: string | null | undefined,
): Promise<void> {
    if (!actorId) return;
    const { error } = await client.rpc('fn_set_audit_actor', { p_actor_id: actorId });
    if (error) {
        // Non-fatal: row attribution / auth.uid() still cover most paths.
        console.warn('fn_set_audit_actor failed:', error.message);
    }
}

/**
 * Allows intentional audit purge in the current transaction (service role scripts).
 */
export async function allowAuditPurge(client: SupabaseClient): Promise<void> {
    const { error } = await client.rpc('fn_allow_audit_purge');
    if (error) {
        throw new Error(`fn_allow_audit_purge failed: ${error.message}`);
    }
}
