-- Fix the SELECT policy on branches to allow reading soft-deleted branches
-- This is necessary so historically assigned consignments don't break,
-- and so that setting is_active = false during soft-delete doesn't trigger RLS violation.

DROP POLICY IF EXISTS "Allow read access to branches for authenticated users" ON branches;

CREATE POLICY "Allow read access to branches for authenticated users" ON branches
    FOR SELECT TO authenticated
    USING (true);
