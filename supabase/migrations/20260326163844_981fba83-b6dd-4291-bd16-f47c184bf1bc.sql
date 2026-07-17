-- Table to store Telegram auth OTP codes
CREATE TABLE public.telegram_auth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id bigint NOT NULL,
  telegram_username text,
  telegram_first_name text,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Table to link Telegram users to Supabase users
CREATE TABLE public.telegram_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  telegram_user_id bigint NOT NULL UNIQUE,
  telegram_username text,
  telegram_first_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_telegram_auth_codes_telegram_user ON public.telegram_auth_codes(telegram_user_id);
CREATE INDEX idx_telegram_auth_codes_code ON public.telegram_auth_codes(code);
CREATE INDEX idx_telegram_users_telegram_id ON public.telegram_users(telegram_user_id);
CREATE INDEX idx_telegram_users_user_id ON public.telegram_users(user_id);

-- RLS
ALTER TABLE public.telegram_auth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;

-- Users can read their own telegram link
CREATE POLICY "Users can view own telegram link"
  ON public.telegram_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Cleanup trigger
CREATE TRIGGER update_telegram_users_updated_at
  BEFORE UPDATE ON public.telegram_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();