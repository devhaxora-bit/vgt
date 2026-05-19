-- Create vehicles master table (includes vehicle, owner, insurance, ewaybill, TDS)
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_no VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type TEXT DEFAULT 'open',
    vehicle_make TEXT,
    vehicle_model TEXT,
    engine_no TEXT,
    chasis_no TEXT,
    permit_no TEXT,
    permit_validity DATE,
    tax_token_no TEXT,
    tax_token_validity DATE,
    tax_token_issued_by TEXT,
    -- Owner
    owner_name TEXT,
    owner_mobile VARCHAR(20),
    owner_pan VARCHAR(20),
    owner_address TEXT,
    owner_tel VARCHAR(20),
    -- Insurance
    insurance_policy_no TEXT,
    insurance_validity DATE,
    insurance_company TEXT,
    insurance_city TEXT,
    finance_detail TEXT,
    -- eWaybill
    ewaybill_no TEXT,
    ewaybill_date DATE,
    -- TDS / ITDS
    tds_percent NUMERIC(5,2) DEFAULT 0,
    itds_ref_branch TEXT,
    itds_declare_date DATE,
    itds_financial_year TEXT,
    -- Meta
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_no ON vehicles (vehicle_no);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read vehicles"
    ON vehicles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage vehicles"
    ON vehicles FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );
