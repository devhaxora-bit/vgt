-- Ensure every authenticated user can read their own profile row.
-- Missing this policy makes login succeed but APIs return "User profile not found".

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Keep anon login lookup working (employee_code → profile during sign-in)
DROP POLICY IF EXISTS "Allow anon to read users for login" ON public.users;
CREATE POLICY "Allow anon to read users for login"
  ON public.users
  FOR SELECT
  TO anon
  USING (true);
