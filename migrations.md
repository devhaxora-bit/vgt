# Challan Database Migrations (May 2026)

Copy and run this combined SQL script inside your Supabase SQL Editor on your main/production branch database.

```sql
-- ==========================================
-- 1. ENHANCE CHALLAN CONSTRAINTS & ROUTING
-- ==========================================
ALTER TABLE public.challans DROP CONSTRAINT IF EXISTS challans_challan_type_check;
ALTER TABLE public.challans ADD CONSTRAINT challans_challan_type_check CHECK (challan_type IN ('MAIN', 'INCLUDE', 'FOC'));

ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS linked_cn_nos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS loading_point TEXT;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS destination_point TEXT;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS engagement_type TEXT DEFAULT 'broker' CHECK (engagement_type IN ('broker', 'direct'));

-- ==========================================
-- 2. CREATE BROKERS MASTER TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.brokers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    mobile VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brokers_name ON public.brokers USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_brokers_code ON public.brokers (code);

ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read brokers" ON public.brokers;
CREATE POLICY "Authenticated users can read brokers"
    ON public.brokers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage brokers" ON public.brokers;
CREATE POLICY "Admins can manage brokers"
    ON public.brokers FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- ==========================================
-- 3. CREATE VEHICLES MASTER TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.vehicles (
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
    -- Owner Details
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

CREATE INDEX IF NOT EXISTS idx_vehicles_no ON public.vehicles (vehicle_no);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read vehicles" ON public.vehicles;
CREATE POLICY "Authenticated can read vehicles"
    ON public.vehicles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage vehicles" ON public.vehicles;
CREATE POLICY "Admins can manage vehicles"
    ON public.vehicles FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- ==========================================
-- 4. ADD NEW COLUMNS TO CHALLANS TABLE
-- ==========================================
ALTER TABLE public.challans
ADD COLUMN IF NOT EXISTS owner_pan VARCHAR(20),
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS owner_mobile VARCHAR(20),
ADD COLUMN IF NOT EXISTS owner_address TEXT,
ADD COLUMN IF NOT EXISTS owner_tel VARCHAR(20),
ADD COLUMN IF NOT EXISTS broker_name TEXT,
ADD COLUMN IF NOT EXISTS broker_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS broker_mobile VARCHAR(20),
ADD COLUMN IF NOT EXISTS broker_address TEXT,
ADD COLUMN IF NOT EXISTS slip_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS slip_date DATE,
ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
ADD COLUMN IF NOT EXISTS permit_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS permit_validity DATE,
ADD COLUMN IF NOT EXISTS vehicle_make TEXT,
ADD COLUMN IF NOT EXISTS engine_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS chasis_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_token_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_token_validity DATE,
ADD COLUMN IF NOT EXISTS tax_token_issued_by TEXT,
ADD COLUMN IF NOT EXISTS vehicle_model TEXT,
ADD COLUMN IF NOT EXISTS insurance_policy_no TEXT,
ADD COLUMN IF NOT EXISTS insurance_validity DATE,
ADD COLUMN IF NOT EXISTS insurance_company_name TEXT,
ADD COLUMN IF NOT EXISTS insurance_city TEXT,
ADD COLUMN IF NOT EXISTS finance_detail TEXT,
ADD COLUMN IF NOT EXISTS ewaybill_no TEXT,
ADD COLUMN IF NOT EXISTS ewaybill_date DATE,
ADD COLUMN IF NOT EXISTS itds_ref_branch TEXT,
ADD COLUMN IF NOT EXISTS itds_declare_date DATE,
ADD COLUMN IF NOT EXISTS itds_financial_year TEXT,
ADD COLUMN IF NOT EXISTS driver_dl_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS driver_dl_validity DATE,
ADD COLUMN IF NOT EXISTS driver_address TEXT,
ADD COLUMN IF NOT EXISTS trip_tracking_consent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS remarks TEXT,
ADD COLUMN IF NOT EXISTS hire_rate_per_kg DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS hire_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_over_weight DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_over_length DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_over_height DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_over_width DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_km_charges DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS detent_charges DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transit_pass_charges DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_extra_charges DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tds_percent DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS less_tds DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unloading_charges NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS truck_schedule_date DATE DEFAULT NULL;

-- ==========================================
-- 5. RELOAD SCHEMA CACHE
-- ==========================================
NOTIFY pgrst, 'reload schema';
```
