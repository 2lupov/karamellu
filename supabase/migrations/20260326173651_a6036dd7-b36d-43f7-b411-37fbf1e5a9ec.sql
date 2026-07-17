
CREATE TABLE public.telegram_bot_last_messages (
  chat_id bigint PRIMARY KEY,
  message_ids bigint[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_bot_last_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.telegram_bot_last_messages
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);
