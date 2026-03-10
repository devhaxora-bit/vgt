-- Add Challan prefix and sequence tracking to branches
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS challan_prefix VARCHAR(5) DEFAULT 'KC',
ADD COLUMN IF NOT EXISTS next_challan_no BIGINT DEFAULT 300066955;

-- Update existing branches with specific prefixes/sequences if needed
UPDATE branches SET challan_prefix = 'KC', next_challan_no = 300066955 WHERE code = 'MRG';
UPDATE branches SET challan_prefix = 'PC', next_challan_no = 400000001 WHERE code = 'PNJ';
UPDATE branches SET challan_prefix = 'VC', next_challan_no = 500000001 WHERE code = 'VZG';
UPDATE branches SET challan_prefix = 'MC', next_challan_no = 600000001 WHERE code = 'MAP';
UPDATE branches SET challan_prefix = 'HC', next_challan_no = 700000001 WHERE code = 'HBL';
