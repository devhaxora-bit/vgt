-- Create branches table if it doesn't exist
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Hub', 'Branch')),
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create challans table
CREATE TABLE IF NOT EXISTS challans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challan_no VARCHAR(20) NOT NULL UNIQUE,
    origin_branch_code VARCHAR(10) REFERENCES branches(code),
    destination_branch_code VARCHAR(10) REFERENCES branches(code),
    challan_type TEXT NOT NULL CHECK (challan_type IN ('MAIN', 'FOC')),
    vehicle_no VARCHAR(20) NOT NULL,
    driver_name TEXT,
    driver_mobile VARCHAR(15),
    
    -- Financials
    total_hire_amount DECIMAL(10, 2) DEFAULT 0,
    extra_hire_amount DECIMAL(10, 2) DEFAULT 0,
    advance_amount DECIMAL(10, 2) DEFAULT 0,
    balance_amount DECIMAL(10, 2) GENERATED ALWAYS AS (total_hire_amount + extra_hire_amount - advance_amount) STORED,
    
    -- Meta
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_by UUID REFERENCES auth.users(id),
    
    date_from DATE DEFAULT CURRENT_DATE,
    date_to DATE DEFAULT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed some default branches if table is empty
INSERT INTO branches (code, name, type, city, state)
SELECT 'MRG', 'Margao Hub', 'Hub', 'Margao', 'Goa'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'MRG');

INSERT INTO branches (code, name, type, city, state)
SELECT 'PNJ', 'Panjim Branch', 'Branch', 'Panjim', 'Goa'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'PNJ');

INSERT INTO branches (code, name, type, city, state)
SELECT 'VZG', 'Vasco Branch', 'Branch', 'Vasco', 'Goa'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'VZG');

INSERT INTO branches (code, name, type, city, state)
SELECT 'MAP', 'Mapusa Hub', 'Hub', 'Mapusa', 'Goa'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'MAP');

INSERT INTO branches (code, name, type, city, state)
SELECT 'PND', 'Ponda Branch', 'Branch', 'Ponda', 'Goa'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'PND');

INSERT INTO branches (code, name, type, city, state)
SELECT 'HBL', 'Hubballi Branch', 'Branch', 'Hubballi', 'Karnataka'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'HBL');


-- Enable RLS
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE challans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for branches
CREATE POLICY "Allow read access to branches for authenticated users" ON branches
    FOR SELECT TO authenticated
    USING (is_active = true);

-- RLS Policies for challans
CREATE POLICY "Allow read access to challans for authenticated users" ON challans
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow insert for authenticated users" ON challans
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Allow update for authenticated users" ON challans
    FOR UPDATE TO authenticated
    USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_challans_challan_no ON challans(challan_no);
CREATE INDEX IF NOT EXISTS idx_challans_origin ON challans(origin_branch_code);
CREATE INDEX IF NOT EXISTS idx_challans_destination ON challans(destination_branch_code);
CREATE INDEX IF NOT EXISTS idx_branches_code ON branches(code);

-- Triggers for updated_at
CREATE TRIGGER set_branches_updated_at
    BEFORE UPDATE ON branches
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_challans_updated_at
    BEFORE UPDATE ON challans
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();
