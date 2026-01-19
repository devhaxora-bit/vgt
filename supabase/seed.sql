-- Delete existing notes data
truncate table public.notes cascade;

-- Create default admin user
-- Password: Admin@123 (change this in production!)
insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) values (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'admin@vgt.com',
  crypt('Admin@123', gen_salt('bf')),
  now(),
  now(),
  now()
) on conflict do nothing;

-- Create admin profile
insert into public.users (
  id,
  employee_code,
  full_name,
  role,
  department,
  phone,
  is_active
) values (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'EMP001',
  'System Administrator',
  'admin',
  'IT',
  '+91-9999999999',
  true
) on conflict do nothing;

-- Create sample employee
insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) values (
  'b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'employee@vgt.com',
  crypt('Employee@123', gen_salt('bf')),
  now(),
  now(),
  now()
) on conflict do nothing;

insert into public.users (
  id,
  employee_code,
  full_name,
  role,
  department,
  phone,
  is_active,
  created_by
) values (
  'b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'EMP002',
  'John Doe',
  'employee',
  'Operations',
  '+91-9876543210',
  true,
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
) on conflict do nothing;

-- Create sample agent
insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) values (
  'c2ffde99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'agent@vgt.com',
  crypt('Agent@123', gen_salt('bf')),
  now(),
  now(),
  now()
) on conflict do nothing;

insert into public.users (
  id,
  employee_code,
  full_name,
  role,
  department,
  phone,
  is_active,
  created_by
) values (
  'c2ffde99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'AGT001',
  'Jane Smith',
  'agent',
  'Sales',
  '+91-9876543211',
  true,
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
) on conflict do nothing;
