import { createClient } from '@/utils/supabase/client';
import { Party, PartyInput } from '../types/party.types';

export const getParties = async (search?: string) => {
    const supabase = createClient();
    let query = supabase
        .from('parties')
        .select('*')
        .eq('is_active', true);

    if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        query = query.or(`name.ilike.${searchTerm},code.ilike.${searchTerm}`);
    }

    query = query.order('name');
    const { data, error } = await query;

    if (error) {
        console.error('Error fetching parties:', error.message, error.code, error.details, error.hint);
        return [];
    }

    return data as Party[];
};

export const getPartyByCode = async (code: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('parties')
        .select('*')
        .eq('code', code)
        .single();

    if (error) {
        return null;
    }

    return data as Party;
};

export const getPartyByGstin = async (gstin: string, excludeId?: string): Promise<Party | null> => {
    const supabase = createClient();
    let query = supabase
        .from('parties')
        .select('*')
        .eq('is_active', true)
        .eq('gstin', gstin.toUpperCase().trim());

    if (excludeId) {
        query = query.neq('id', excludeId);
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error || !data) {
        return null;
    }

    return data as Party;
};

/**
 * Returns the next sequential party code as a zero-padded 6-digit string.
 * e.g. if max existing code is "000007", returns "000008".
 * Falls back to "000001" if no parties exist yet.
 */
export const getNextPartyCode = async (): Promise<string> => {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('parties')
        .select('code')
        .order('code', { ascending: false })
        .limit(1)
        .single();

    if (error || !data?.code) {
        return '000001';
    }

    const maxNum = parseInt(data.code, 10);
    if (isNaN(maxNum)) {
        return '000001';
    }

    return String(maxNum + 1).padStart(6, '0');
};


export const createParty = async (party: PartyInput) => {
    if (party.gstin) {
        const existing = await getPartyByGstin(party.gstin);
        if (existing) {
            throw new Error(`A party with GSTIN "${party.gstin}" already exists: "${existing.name}" (${existing.code})`);
        }
    }

    const supabase = createClient();
    const { data, error } = await supabase
        .from('parties')
        .insert(party)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data as Party;
};

export const updateParty = async (id: string, party: Partial<PartyInput>) => {
    if (party.gstin) {
        const existing = await getPartyByGstin(party.gstin, id);
        if (existing) {
            throw new Error(`A party with GSTIN "${party.gstin}" already exists: "${existing.name}" (${existing.code})`);
        }
    }

    const supabase = createClient();
    const { data, error } = await supabase
        .from('parties')
        .update(party)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data as Party;
};

export const deleteParty = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
        .from('parties')
        .update({ is_active: false })
        .eq('id', id);

    if (error) {
        throw error;
    }
    return true;
};
