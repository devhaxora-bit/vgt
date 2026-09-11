-- Multi-invoice support on consignments (same pattern as packages JSONB)
ALTER TABLE public.consignments
  ADD COLUMN IF NOT EXISTS invoices JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.consignments.invoices IS
  'Array of invoice rows: [{id, invoice_no, invoice_date, invoice_amount, eway_bill, eway_from_date, eway_to_date}]';
