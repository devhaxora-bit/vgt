-- Increase length for gstin and phone in parties table to prevent "value too long" errors
ALTER TABLE parties 
    ALTER COLUMN gstin TYPE VARCHAR(20),
    ALTER COLUMN phone TYPE VARCHAR(20);

-- Also update branch_code just in case
ALTER TABLE parties
    ALTER COLUMN branch_code TYPE VARCHAR(20);
