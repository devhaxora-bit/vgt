-- Add INSERT and UPDATE policies for branches table so admin users can manage branches

-- Allow admin users to insert new branches
CREATE POLICY "Allow insert for admin users" ON branches
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

-- Allow admin users to update existing branches
CREATE POLICY "Allow update for admin users" ON branches
    FOR UPDATE TO authenticated
    USING (public.is_admin(auth.uid()));
