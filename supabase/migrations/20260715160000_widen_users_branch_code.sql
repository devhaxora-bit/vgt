-- Allow longer branch codes on users (match parties / branch masters)
ALTER TABLE public.users
  ALTER COLUMN branch_code TYPE VARCHAR(20);
