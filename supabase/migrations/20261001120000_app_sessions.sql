-- App-owned login sessions (replaces Supabase refresh-token sessions for the web app).
-- The browser holds an opaque random token in an httpOnly cookie; only its SHA-256
-- hash is stored here. Sessions slide forward on use and never rotate, so
-- concurrent requests cannot invalidate each other.

CREATE TABLE IF NOT EXISTS public.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  remember_me boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip_address inet,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_active
  ON public.app_sessions (user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at
  ON public.app_sessions (expires_at);

-- Service role only: no policies for anon/authenticated.
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_sessions FROM anon, authenticated;
