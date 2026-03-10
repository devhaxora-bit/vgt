-- Add CN prefix and sequence tracking to branches
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS cn_prefix VARCHAR(5) DEFAULT 'S',
ADD COLUMN IF NOT EXISTS next_cn_no BIGINT DEFAULT 800001;

-- Update existing branches with specific prefixes/sequences if needed
-- For now, setting different prefixes for some branches to demonstrate
UPDATE branches SET cn_prefix = 'K', next_cn_no = 730001 WHERE code = 'MRG';
UPDATE branches SET cn_prefix = 'S', next_cn_no = 800001 WHERE code = 'PNJ';
UPDATE branches SET cn_prefix = 'V', next_cn_no = 100001 WHERE code = 'VZG';
UPDATE branches SET cn_prefix = 'M', next_cn_no = 200001 WHERE code = 'MAP';
UPDATE branches SET cn_prefix = 'P', next_cn_no = 300001 WHERE code = 'PND';
UPDATE branches SET cn_prefix = 'H', next_cn_no = 400001 WHERE code = 'HBL';
