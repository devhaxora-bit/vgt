ALTER TABLE challans
DROP CONSTRAINT IF EXISTS challans_challan_type_check;

ALTER TABLE challans
ADD CONSTRAINT challans_challan_type_check
CHECK (challan_type IN ('MAIN', 'INCLUDE', 'FOC'));
