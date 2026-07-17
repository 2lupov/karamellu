
CREATE TABLE public.telegram_registration_state (
  chat_id bigint PRIMARY KEY,
  step text NOT NULL DEFAULT 'awaiting_nickname',
  nickname text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_registration_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.telegram_registration_state
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);
