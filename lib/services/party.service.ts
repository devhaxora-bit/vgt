import { Party, PartyInput } from '../types/party.types';

const jsonOrThrow = async (res: Response): Promise<unknown> => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const record = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
        const message = String(
            record.error
            || record.message
            || record.msg
            || `Request failed (${res.status})`,
        );
        throw new Error(message);
    }
    return body;
};

export const getParties = async (search?: string): Promise<Party[]> => {
    const params = new URLSearchParams();
    if (search?.trim()) params.set('q', search.trim());

    const res = await fetch(`/api/parties?${params.toString()}`);
    if (!res.ok) {
        console.error('Error fetching parties:', res.status);
        return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? (data as Party[]) : [];
};

export const getPartyByCode = async (code: string): Promise<Party | null> => {
    const res = await fetch(`/api/parties?code=${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data ? (data as Party) : null;
};

export const getPartyByGstin = async (
    gstin: string,
    excludeId?: string,
): Promise<Party | null> => {
    const params = new URLSearchParams({ gstin: gstin.toUpperCase().trim() });
    if (excludeId) params.set('excludeId', excludeId);

    const res = await fetch(`/api/parties?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data ? (data as Party) : null;
};

export const getNextPartyCode = async (): Promise<string> => {
    const res = await fetch('/api/parties?nextCode=1');
    if (!res.ok) return '000001';
    const data = await res.json();
    return String(data?.nextCode || '000001');
};

export const createParty = async (party: PartyInput): Promise<Party> => {
    const res = await fetch('/api/parties', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(party),
    });
    const data = await jsonOrThrow(res);
    return data as Party;
};

export const updateParty = async (
    id: string,
    party: Partial<PartyInput>,
): Promise<Party> => {
    const res = await fetch(`/api/parties/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(party),
    });
    const data = await jsonOrThrow(res);
    return data as Party;
};

export const deleteParty = async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/parties/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    await jsonOrThrow(res);
    return true;
};
