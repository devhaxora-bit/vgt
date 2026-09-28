import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuthz } from '@/lib/server/requireAuthz';
import {
    LEDGER_AUDIT_ACTIONS,
    LEDGER_AUDIT_ENTITY_TYPES,
    type LedgerAuditLog,
} from '@/lib/types/ledgerAudit.types';

const dateFilterSchema = z
    .string()
    .trim()
    .min(1)
    .refine(
        (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isNaN(Date.parse(value)),
        'Invalid date',
    )
    .optional();

const querySchema = z.object({
    entity_type: z.enum(LEDGER_AUDIT_ENTITY_TYPES).optional(),
    action: z.enum(LEDGER_AUDIT_ACTIONS).optional(),
    entity_id: z.string().uuid().optional(),
    entity_ref: z.string().trim().min(1).optional(),
    q: z.string().trim().min(1).optional(),
    party_id: z.string().uuid().optional(),
    broker_id: z.string().uuid().optional(),
    txid: z.coerce.number().int().positive().optional(),
    from: dateFilterSchema,
    to: dateFilterSchema,
    format: z.enum(['json', 'csv']).optional().default('json'),
    limit: z.coerce.number().int().min(1).max(5000).optional().default(50),
});

type NamedRow = { id: string; name: string | null; code?: string | null };
type UserRow = { id: string; full_name: string | null; employee_code: string | null };

const uniqueIds = (values: Array<string | null | undefined>): string[] =>
    [...new Set(values.filter((id): id is string => Boolean(id)))];

const labelMap = (rows: NamedRow[] | null): Map<string, string> => {
    const map = new Map<string, string>();
    for (const row of rows || []) {
        const name = String(row.name || '').trim();
        const code = String(row.code || '').trim();
        map.set(row.id, [name, code ? `(${code})` : ''].filter(Boolean).join(' ') || row.id);
    }
    return map;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

const toInclusiveEndIso = (value: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return `${value}T23:59:59.999Z`;
    }
    return value;
};

const toStartIso = (value: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return `${value}T00:00:00.000Z`;
    }
    return value;
};

const csvEscape = (value: unknown): string => {
    const raw = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(raw)) {
        return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
};

const enrichedToCsv = (rows: LedgerAuditLog[]): string => {
    const headers = [
        'occurred_at',
        'txid',
        'actor_name',
        'actor_code',
        'entity_type',
        'entity_ref',
        'entity_id',
        'action',
        'reason',
        'movement_summary',
        'changed_fields',
        'old_party_name',
        'new_party_name',
        'old_broker_name',
        'new_broker_name',
        'old_data',
        'new_data',
    ];
    const lines = [headers.join(',')];
    for (const row of rows) {
        lines.push(
            [
                row.occurred_at,
                row.txid,
                row.actor_name,
                row.actor_code,
                row.entity_type,
                row.entity_ref,
                row.entity_id,
                row.action,
                row.reason,
                row.movement_summary,
                row.changed_fields.join('|'),
                row.old_party_name,
                row.new_party_name,
                row.old_broker_name,
                row.new_broker_name,
                row.old_data ? JSON.stringify(row.old_data) : '',
                row.new_data ? JSON.stringify(row.new_data) : '',
            ]
                .map(csvEscape)
                .join(','),
        );
    }
    return `${lines.join('\n')}\n`;
};

// GET /api/ledger/audit-logs
export async function GET(request: NextRequest) {
    const auth = await requireAuthz({ adminOnly: true, fullAccessOnly: true });
    if (!auth.ok) return auth.response;

    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid query' }, { status: 400 });
    }

    const {
        entity_type,
        action,
        entity_id,
        entity_ref,
        q,
        party_id,
        broker_id,
        txid,
        from,
        to,
        format,
        limit,
    } = parsed.data;

    const exportLimit = format === 'csv' ? Math.min(Math.max(limit, 1), 5000) : Math.min(limit, 200);

    let query = auth.supabase
        .from('ledger_audit_logs')
        .select('id, occurred_at, txid, actor_id, entity_type, entity_id, entity_ref, action, old_party_id, new_party_id, old_broker_id, new_broker_id, changed_fields, old_data, new_data, reason, movement_summary')
        .order('occurred_at', { ascending: false })
        .limit(exportLimit);

    if (entity_type) query = query.eq('entity_type', entity_type);
    if (action) query = query.eq('action', action);
    if (entity_id) query = query.eq('entity_id', entity_id);
    if (entity_ref) query = query.eq('entity_ref', entity_ref);
    if (q) query = query.ilike('entity_ref', `%${q}%`);
    if (txid) query = query.eq('txid', txid);
    if (party_id) query = query.or(`old_party_id.eq.${party_id},new_party_id.eq.${party_id}`);
    if (broker_id) query = query.or(`old_broker_id.eq.${broker_id},new_broker_id.eq.${broker_id}`);
    if (from) query = query.gte('occurred_at', toStartIso(from));
    if (to) query = query.lte('occurred_at', toInclusiveEndIso(to));

    const { data, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data || [];
    const actorIds = uniqueIds(rows.map((row) => row.actor_id));
    const partyIds = uniqueIds(rows.flatMap((row) => [row.old_party_id, row.new_party_id]));
    const brokerIds = uniqueIds(rows.flatMap((row) => [row.old_broker_id, row.new_broker_id]));

    const [actorsRes, partiesRes, brokersRes] = await Promise.all([
        actorIds.length
            ? auth.supabase.from('users').select('id, full_name, employee_code').in('id', actorIds)
            : Promise.resolve({ data: [] as UserRow[], error: null }),
        partyIds.length
            ? auth.supabase.from('parties').select('id, name, code').in('id', partyIds)
            : Promise.resolve({ data: [] as NamedRow[], error: null }),
        brokerIds.length
            ? auth.supabase.from('brokers').select('id, name, code').in('id', brokerIds)
            : Promise.resolve({ data: [] as NamedRow[], error: null }),
    ]);

    const actorById = new Map<string, { name: string; code: string | null }>();
    for (const actor of (actorsRes.data || []) as UserRow[]) {
        actorById.set(actor.id, {
            name: String(actor.full_name || '').trim() || 'Unknown user',
            code: actor.employee_code,
        });
    }
    const partyById = labelMap((partiesRes.data || []) as NamedRow[]);
    const brokerById = labelMap((brokersRes.data || []) as NamedRow[]);

    const enriched: LedgerAuditLog[] = rows.map((row) => {
        const actor = row.actor_id ? actorById.get(row.actor_id) : undefined;
        return {
            id: row.id,
            occurred_at: row.occurred_at,
            txid: Number(row.txid),
            actor_id: row.actor_id,
            actor_name: actor?.name ?? (row.actor_id ? null : 'System'),
            actor_code: actor?.code ?? null,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            entity_ref: row.entity_ref,
            action: row.action,
            old_party_id: row.old_party_id,
            new_party_id: row.new_party_id,
            old_party_name: row.old_party_id ? partyById.get(row.old_party_id) ?? null : null,
            new_party_name: row.new_party_id ? partyById.get(row.new_party_id) ?? null : null,
            old_broker_id: row.old_broker_id,
            new_broker_id: row.new_broker_id,
            old_broker_name: row.old_broker_id ? brokerById.get(row.old_broker_id) ?? null : null,
            new_broker_name: row.new_broker_id ? brokerById.get(row.new_broker_id) ?? null : null,
            changed_fields: Array.isArray(row.changed_fields) ? row.changed_fields : [],
            old_data: asRecord(row.old_data),
            new_data: asRecord(row.new_data),
            reason: row.reason ?? null,
            movement_summary: row.movement_summary ?? null,
        };
    });

    if (format === 'csv') {
        const stamp = new Date().toISOString().slice(0, 10);
        return new NextResponse(enrichedToCsv(enriched), {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="audit-logs-${stamp}.csv"`,
            },
        });
    }

    return NextResponse.json({ success: true, data: enriched });
}
