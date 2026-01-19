-- Create the notes table
create table if not exists public.notes (
  id bigint primary key generated always as identity,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.notes enable row level security;

-- Create policy to make data publicly readable
create policy "public can read notes"
on public.notes
for select to anon
using (true);

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant select on public.notes to anon, authenticated;
grant all on public.notes to authenticated;
