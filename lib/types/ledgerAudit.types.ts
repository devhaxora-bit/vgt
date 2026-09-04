export const LEDGER_AUDIT_ENTITY_TYPES = [
    'bill',
    'payment',
    'consignment',
    'challan',
    'challan_bill',
    'challan_payment',
] as const;

export type LedgerAuditEntityType = (typeof LEDGER_AUDIT_ENTITY_TYPES)[number];

export const LEDGER_AUDIT_ACTIONS = [
    'insert',
    'update',
    'delete',
    'reassign',
    'cancel',
    'reverse',
] as const;

export type LedgerAuditAction = (typeof LEDGER_AUDIT_ACTIONS)[number];

export type LedgerAuditLog = {
    id: string;
    occurred_at: string;
    txid: number;
    actor_id: string | null;
    actor_name: string | null;
    actor_code: string | null;
    entity_type: LedgerAuditEntityType;
    entity_id: string;
    entity_ref: string | null;
    action: LedgerAuditAction;
    old_party_id: string | null;
    new_party_id: string | null;
    old_party_name: string | null;
    new_party_name: string | null;
    old_broker_id: string | null;
    new_broker_id: string | null;
    old_broker_name: string | null;
    new_broker_name: string | null;
    changed_fields: string[];
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
};
