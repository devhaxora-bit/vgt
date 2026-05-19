-- Add engagement_type to challans table to distinguish Broker vs Direct challans
ALTER TABLE challans
ADD COLUMN IF NOT EXISTS engagement_type TEXT DEFAULT 'broker' CHECK (engagement_type IN ('broker', 'direct'));
