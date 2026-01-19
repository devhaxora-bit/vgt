-- Create users table (extends Supabase auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_code varchar(20) unique not null,
  full_name varchar(100) not null,
  role varchar(20) not null check (role in ('admin', 'employee', 'agent')),
  department varchar(50),
  phone varchar(15),
  is_active boolean default true,
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create indexes for performance
create index if not exists idx_users_employee_code on public.users(employee_code);
create index if not exists idx_users_role on public.users(role);
create index if not exists idx_users_is_active on public.users(is_active);

-- Create user_sessions table for tracking login history
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  login_at timestamptz default now(),
  logout_at timestamptz,
  ip_address inet,
  user_agent text
);

create index if not exists idx_user_sessions_user_id on public.user_sessions(user_id);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.user_sessions enable row level security;

-- RLS Policies for users table

-- Users can read their own data
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

-- Admins can view all users
create policy "Admins can view all users"
  on public.users for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin' and is_active = true
    )
  );

-- Only admins can create users
create policy "Admins can create users"
  on public.users for insert
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin' and is_active = true
    )
  );

-- Admins can update users
create policy "Admins can update users"
  on public.users for update
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin' and is_active = true
    )
  );

-- RLS Policies for user_sessions table

-- Users can view their own sessions
create policy "Users can view own sessions"
  on public.user_sessions for select
  using (auth.uid() = user_id);

-- Admins can view all sessions
create policy "Admins can view all sessions"
  on public.user_sessions for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin' and is_active = true
    )
  );

-- Anyone authenticated can insert their own session
create policy "Users can create own sessions"
  on public.user_sessions for insert
  with check (auth.uid() = user_id);

-- Users can update their own sessions (for logout)
create policy "Users can update own sessions"
  on public.user_sessions for update
  using (auth.uid() = user_id);

-- Create function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger for updated_at
create trigger set_updated_at
  before update on public.users
  for each row
  execute function public.handle_updated_at();

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant select on public.users to anon, authenticated;
grant all on public.users to authenticated;
grant all on public.user_sessions to authenticated;
