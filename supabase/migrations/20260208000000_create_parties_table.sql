-- Create parties table
CREATE TABLE IF NOT EXISTS parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code VARCHAR(6) NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('consignor', 'consignee', 'both', 'billing')),
    gstin VARCHAR(15),
    address TEXT,
    city TEXT,
    state TEXT,
    pincode VARCHAR(6),
    phone VARCHAR(15),
    email TEXT,
    branch_code VARCHAR(10),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on code for faster lookups
CREATE INDEX IF NOT EXISTS idx_parties_code ON parties(code);

-- Create index on type for filtering
CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(type);

-- Create index on name for search
CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name);

-- Enable RLS
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow all authenticated users to read active parties
CREATE POLICY "Allow read access to parties for authenticated users" ON parties
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Allow users with admin role to insert
CREATE POLICY "Allow insert for admin users" ON parties
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Allow users with admin role to update
CREATE POLICY "Allow update for admin users" ON parties
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Updated at trigger
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_parties_updated_at
    BEFORE UPDATE ON parties
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();
