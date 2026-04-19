ALTER TABLE public.party_billing_records
ADD COLUMN IF NOT EXISTS extra_charge_items JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.party_billing_records
SET extra_charge_items = '[]'::jsonb
WHERE extra_charge_items IS NULL;

ALTER TABLE public.party_billing_records
DROP CONSTRAINT IF EXISTS party_billing_records_extra_charge_items_is_array;

ALTER TABLE public.party_billing_records
ADD CONSTRAINT party_billing_records_extra_charge_items_is_array
CHECK (jsonb_typeof(extra_charge_items) = 'array');
