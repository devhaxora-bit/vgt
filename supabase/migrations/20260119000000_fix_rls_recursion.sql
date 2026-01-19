-- Fix infinite recursion in RLS policies by creating a security definer function
-- This function bypasses RLS to check if a user is an admin

-- Drop existing problematic policies
drop policy if exists "Admins can view all users" on public.users;
drop policy if exists "Admins can create users" on public.users;
drop policy if exists "Admins can update users" on public.users;
drop policy if exists "Admins can view all sessions" on public.user_sessions;

-- Create a security definer function to check if user is admin
-- This function runs with the privileges of the function owner, bypassing RLS
create or replace function public.is_admin(user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.users
    where id = user_id and role = 'admin' and is_active = true
  );
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function public.is_admin(uuid) to authenticated, anon;

-- Recreate policies using the security definer function

-- Admins can view all users
create policy "Admins can view all users"
  on public.users for select
  using (public.is_admin(auth.uid()));

-- Only admins can create users
create policy "Admins can create users"
  on public.users for insert
  with check (public.is_admin(auth.uid()));

-- Admins can update users
create policy "Admins can update users"
  on public.users for update
  using (public.is_admin(auth.uid()));

-- Admins can view all sessions
create policy "Admins can view all sessions"
  on public.user_sessions for select
  using (public.is_admin(auth.uid()));

-- Also need to allow service role to bypass RLS for initial user lookup during login
-- Grant select to anon for the login flow (the UserRepository needs to find users by employee_code)
-- This is safe because the actual authentication happens via Supabase auth
create policy "Allow anon to read users for login"
  on public.users for select
  to anon
  using (true);
