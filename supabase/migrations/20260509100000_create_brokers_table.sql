-- Create brokers master table
CREATE TABLE IF NOT EXISTS brokers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    mobile VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast name search (used in auto-fetch)
CREATE INDEX IF NOT EXISTS idx_brokers_name ON brokers USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_brokers_code ON brokers (code);

-- RLS
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read brokers"
    ON brokers FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage brokers"
    ON brokers FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );
