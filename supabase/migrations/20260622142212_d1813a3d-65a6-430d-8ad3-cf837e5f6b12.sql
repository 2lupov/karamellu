CREATE TABLE public.client_bot_links (
  chat_id BIGINT PRIMARY KEY,
  phone TEXT,
  tg_username TEXT,
  tg_first_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.client_bot_links TO service_role;
ALTER TABLE public.client_bot_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.client_bot_links FOR ALL TO service_role USING (true) WITH CHECK (true);