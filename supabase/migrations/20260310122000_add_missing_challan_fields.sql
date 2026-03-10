-- Add missing fields for Insurance, eWaybill and ITDS Declaration to challans table
ALTER TABLE challans 
ADD COLUMN IF NOT EXISTS insurance_policy_no TEXT,
ADD COLUMN IF NOT EXISTS insurance_validity DATE,
ADD COLUMN IF NOT EXISTS insurance_company_name TEXT,
ADD COLUMN IF NOT EXISTS insurance_city TEXT,
ADD COLUMN IF NOT EXISTS finance_detail TEXT,
ADD COLUMN IF NOT EXISTS ewaybill_no TEXT,
ADD COLUMN IF NOT EXISTS ewaybill_date DATE,
ADD COLUMN IF NOT EXISTS itds_ref_branch TEXT,
ADD COLUMN IF NOT EXISTS itds_declare_date DATE,
ADD COLUMN IF NOT EXISTS itds_financial_year TEXT;
