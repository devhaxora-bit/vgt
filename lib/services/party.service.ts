import { createClient } from '@/utils/supabase/client';
import { Party, PartyInput, PartyType } from '../types/party.types';

export const getParties = async (type?: PartyType, search?: string) => {
    const supabase = createClient();
    let query = supabase
        .from('parties')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (type) {
        query = query.eq('type', type);
    }

    if (search) {
        query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching parties:', error);
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

export const createParty = async (party: PartyInput) => {
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
