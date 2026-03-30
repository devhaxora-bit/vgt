ALTER TABLE public.consignments
ADD COLUMN IF NOT EXISTS consignor_pincode VARCHAR(10),
ADD COLUMN IF NOT EXISTS consignee_pincode VARCHAR(10);
