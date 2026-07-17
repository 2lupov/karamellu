-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- User roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Categories table
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  image_url text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  skin_type text DEFAULT 'Для всіх типів шкіри',
  image text,
  image_hover text,
  description text DEFAULT '',
  ingredients text DEFAULT '',
  usage_instructions text DEFAULT '',
  best_seller boolean DEFAULT false,
  rating numeric(2,1) DEFAULT 0,
  review_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Site settings
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings" ON public.site_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings" ON public.site_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for products updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for site_settings updated_at
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Allow the has_role function to be called via RPC by authenticated users
-- Also create a promote_to_admin function that only existing admins can call
-- For bootstrapping: create a function that makes the first user admin if no admins exist
CREATE OR REPLACE FUNCTION public.make_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only works if there are no admins yet
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN false;
  END IF;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN true;
END;
$$;
-- Email infrastructure
-- Creates the queue system, send log, send state, suppression, and unsubscribe
-- tables used by both auth and transactional emails.

-- Extensions required for queue processing
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email queues (auth = high priority, transactional = normal)
-- Wrapped in DO blocks to handle "queue already exists" errors idempotently.
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dead-letter queues for messages that exceed max retries
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
-- (PostgREST only exposes functions in the public schema; pgmq functions are in the pgmq schema)
-- All wrappers auto-create the queue on undefined_table (42P01) so emails
-- are never lost if the queue was dropped (extension upgrade, restore, etc.).
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPC wrappers to service_role only (SECURITY DEFINER runs as owner,
-- so without this any authenticated user could manipulate the email queues)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ============================================================
-- POST-MIGRATION STEPS (applied dynamically by setup_email_infra)
-- These steps contain project-specific secrets and URLs and
-- cannot be expressed as static SQL. They are applied via the
-- Supabase Management API (ExecuteSQL) each time the tool runs.
-- ============================================================
--
-- 1. VAULT SECRET
--    Stores (or updates) the Supabase service_role key in
--    vault as 'email_queue_service_role_key'.
--    Uses vault.create_secret / vault.update_secret (upsert).
--    To revert: DELETE FROM vault.secrets WHERE name = 'email_queue_service_role_key';
--
-- 2. CRON JOB (pg_cron)
--    Creates job 'process-email-queue' with a 5-second interval.
--    The job checks:
--      a) rate-limit cooldown (email_send_state.retry_after_until)
--      b) whether auth_emails or transactional_emails queues have messages
--    If conditions are met, it calls the process-email-queue Edge Function
--    via net.http_post using the vault-stored service_role key.
--    To revert: SELECT cron.unschedule('process-email-queue');

-- Order status enum
CREATE TYPE public.order_status AS ENUM ('new', 'confirmed', 'processing', 'shipped', 'delivered', 'returned', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE public.delivery_method AS ENUM ('nova_poshta', 'ukrposhta', 'courier', 'pickup');

-- Orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number serial UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status order_status NOT NULL DEFAULT 'new',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_method text DEFAULT 'monobank',
  monobank_invoice_id text,
  delivery_method delivery_method NOT NULL DEFAULT 'nova_poshta',
  
  -- Contact info
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  
  -- Delivery address
  city text NOT NULL,
  address text NOT NULL,
  postal_code text,
  nova_poshta_warehouse text,
  
  -- Totals
  subtotal numeric NOT NULL DEFAULT 0,
  shipping_cost numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Order items table
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_brand text NOT NULL,
  product_image text,
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL,
  total numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_orders_monobank_invoice ON public.orders(monobank_invoice_id);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);

-- Updated_at trigger for orders
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can create orders (authenticated)
CREATE POLICY "Authenticated users can create orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for webhooks)
CREATE POLICY "Service role full access orders" ON public.orders
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Admins can manage all orders
CREATE POLICY "Admins can manage orders" ON public.orders
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Order items: users can view items for their orders
CREATE POLICY "Users can view own order items" ON public.order_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

-- Order items: insert with order creation
CREATE POLICY "Authenticated users can create order items" ON public.order_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

-- Service role full access for order items
CREATE POLICY "Service role full access order items" ON public.order_items
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Admins can manage all order items
CREATE POLICY "Admins can manage order items" ON public.order_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow anonymous order creation (for guest checkout)
CREATE POLICY "Anyone can create orders" ON public.orders
  FOR INSERT WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Anyone can create order items" ON public.order_items
  FOR INSERT WITH CHECK (true);

-- Fix overly permissive order items insert - scope to items belonging to orders created in same session
DROP POLICY "Anyone can create order items" ON public.order_items;
CREATE POLICY "Guest can create order items for their orders" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id IS NULL)
  );
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
  EXECUTE FUNCTION public.update_updated_at_column();CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  value numeric NOT NULL DEFAULT 0,
  min_order numeric DEFAULT 0,
  max_uses integer DEFAULT null,
  current_uses integer DEFAULT 0,
  is_active boolean DEFAULT true,
  expires_at timestamptz DEFAULT null,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access to promo_codes"
  ON public.promo_codes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Anyone can read active codes (for validation at checkout)
CREATE POLICY "Anyone can read active promo codes"
  ON public.promo_codes FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE TRIGGER update_promo_codes_updated_at
  BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
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

INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can update product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.categories (name, slug, sort_order, description) VALUES
  ('Очищення', 'cleansing', 1, 'Пінки, гелі, олії для очищення шкіри'),
  ('Тонери та есенції', 'toners-essences', 2, 'Тонери, есенції та лосьйони'),
  ('Сироватки', 'serums', 3, 'Сироватки та ампули для обличчя'),
  ('Креми', 'creams', 4, 'Креми для обличчя та зони навколо очей'),
  ('Маски та патчі', 'masks-patches', 5, 'Тканинні маски, патчі, нічні маски'),
  ('Сонцезахист', 'sunscreen', 6, 'SPF-креми та сонцезахисні засоби'),
  ('Макіяж', 'makeup', 7, 'Тональні засоби, помади, туші'),
  ('Догляд за тілом', 'body-care', 8, 'Лосьйони, скраби, креми для тіла'),
  ('Набори', 'sets', 9, 'Подарункові та догляд-набори')
ON CONFLICT DO NOTHING;
DELETE FROM order_items WHERE product_id IN (SELECT id FROM products);
DELETE FROM products;ALTER TABLE public.products ADD COLUMN IF NOT EXISTS promo_photo text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS promo_video text;CREATE TABLE public.video_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  operation_name text NOT NULL,
  chat_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.video_generations
  FOR ALL TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);UPDATE products SET promo_photo = 'https://guqhdtcvkhusjsxcbnwj.supabase.co/storage/v1/object/public/product-images/promo/violet-conditioner-promo.jpg' WHERE id = 'b5908c93-97f8-467a-aee6-bf4a3c1eeaf1';UPDATE products SET promo_video = 'https://guqhdtcvkhusjsxcbnwj.supabase.co/storage/v1/object/public/product-images/promo/generated/019d5edb-3c5b-7c53-a6b2-413b9cc6d9c6-1775412992973.mp4' WHERE id = 'b5908c93-97f8-467a-aee6-bf4a3c1eeaf1';
-- email optional
ALTER TABLE public.orders ALTER COLUMN email DROP NOT NULL;

-- new delivery option
ALTER TYPE public.delivery_method ADD VALUE IF NOT EXISTS 'khmelnytskyi';

-- nova poshta details
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS np_city_ref text,
  ADD COLUMN IF NOT EXISTS np_warehouse_type text;
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
-- Enum для статусу запису
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- Категорії послуг
CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  image_url text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.service_categories TO anon, authenticated;
GRANT ALL ON public.service_categories TO service_role;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON public.service_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.service_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Послуги
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes int NOT NULL DEFAULT 60,
  price_variants jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{label:"1-ша", price:500}, ...] або [{label:null, price:500}]
  order_index int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read services" ON public.services FOR SELECT USING (is_active);
CREATE POLICY "Admins manage services" ON public.services FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Майстри
CREATE TABLE public.masters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  photo_url text,
  bio text,
  specialties uuid[] NOT NULL DEFAULT '{}', -- масив category_id
  order_index int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.masters TO anon, authenticated;
GRANT ALL ON public.masters TO service_role;
ALTER TABLE public.masters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read masters" ON public.masters FOR SELECT USING (is_active);
CREATE POLICY "Admins manage masters" ON public.masters FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Графік роботи майстра
CREATE TABLE public.master_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES public.masters(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '20:00',
  is_working boolean NOT NULL DEFAULT true,
  UNIQUE (master_id, weekday)
);

GRANT SELECT ON public.master_schedule TO anon, authenticated;
GRANT ALL ON public.master_schedule TO service_role;
ALTER TABLE public.master_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read schedule" ON public.master_schedule FOR SELECT USING (true);
CREATE POLICY "Admins manage schedule" ON public.master_schedule FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Записи клієнтів
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  master_id uuid NOT NULL REFERENCES public.masters(id) ON DELETE RESTRICT,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL,
  price_variant_label text,
  price numeric(10,2),
  status booking_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_master_date ON public.bookings (master_id, scheduled_at);
CREATE INDEX idx_bookings_status ON public.bookings (status);

GRANT INSERT ON public.bookings TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create booking" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins read all bookings" ON public.bookings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update bookings" ON public.bookings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete bookings" ON public.bookings FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER set_service_categories_updated_at BEFORE UPDATE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_services_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_masters_updated_at BEFORE UPDATE ON public.masters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Функція для пошуку зайнятих інтервалів майстра на дату
CREATE OR REPLACE FUNCTION public.get_busy_intervals(_master_id uuid, _date date)
RETURNS TABLE (start_at timestamptz, end_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT scheduled_at, scheduled_at + (duration_minutes || ' minutes')::interval
  FROM public.bookings
  WHERE master_id = _master_id
    AND status IN ('pending', 'confirmed')
    AND scheduled_at::date = _date;
$$;

GRANT EXECUTE ON FUNCTION public.get_busy_intervals(uuid, date) TO anon, authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

-- Сідимо категорії
INSERT INTO public.service_categories (slug, name, order_index) VALUES
  ('farbuvannya', 'Фарбування', 1),
  ('stryzhky', 'Стрижки', 2),
  ('doglyad', 'Догляд за волоссям', 3),
  ('brovy', 'Брови', 4),
  ('viyi', 'Вії', 5),
  ('zachisky', 'Зачіски', 6),
  ('makiyazh', 'Макіяж', 7),
  ('cholovichi', 'Чоловічі послуги', 8);

-- Сідимо послуги
WITH cat AS (SELECT id, slug FROM public.service_categories)
INSERT INTO public.services (category_id, name, description, duration_minutes, price_variants, order_index) VALUES
  -- Фарбування
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Складне фарбування', 'Air touch / розтяжка кольору / Soft blond / балаяж', 180,
    '[{"label":"1-ша довжина","price":2000},{"label":"2-га довжина","price":2800},{"label":"3-тя довжина","price":4000}]', 1),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Total blond', 'Повне освітлення + тонування', 180,
    '[{"label":"1-ша довжина","price":1800},{"label":"2-га довжина","price":2500},{"label":"3-тя довжина","price":3000}]', 2),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Тонування', NULL, 90,
    '[{"label":"1-ша","price":500},{"label":"2-га","price":700},{"label":"3-тя","price":800},{"label":"від 4-ї","price":1000}]', 3),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Фарбування коренів', NULL, 90,
    '[{"label":"1-ша","price":500},{"label":"2-га","price":600},{"label":"3-тя","price":700},{"label":"від 4-ї","price":800}]', 4),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Освітлення коренів', NULL, 90,
    '[{"label":"1-ша","price":600},{"label":"2-га","price":700},{"label":"3-тя","price":800},{"label":"від 4-ї","price":900}]', 5),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Фарбування коренів + тонування', NULL, 120,
    '[{"label":"1-ша","price":1000},{"label":"2-га","price":1200},{"label":"3-тя","price":1300},{"label":"від 4-ї","price":1400}]', 6),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Вихід з чорного', NULL, 240,
    '[{"label":"1-ша","price":3500},{"label":"2-га","price":4000},{"label":"3-тя","price":4500},{"label":"від 4-ї","price":5000}]', 7),
  ((SELECT id FROM cat WHERE slug='farbuvannya'), 'Контуринг', NULL, 90,
    '[{"label":"1-ша","price":1500},{"label":"2-га","price":1700},{"label":"3-тя","price":2000},{"label":"від 4-ї","price":2500}]', 8),

  -- Стрижки
  ((SELECT id FROM cat WHERE slug='stryzhky'), 'Стрижка жіноча', NULL, 60,
    '[{"label":"1-ша","price":500},{"label":"2-га","price":600},{"label":"3-тя","price":700}]', 1),
  ((SELECT id FROM cat WHERE slug='stryzhky'), 'Стрижка + експрес зволоження', NULL, 75,
    '[{"label":null,"price":800}]', 2),
  ((SELECT id FROM cat WHERE slug='stryzhky'), 'Стрижка чілки', NULL, 20,
    '[{"label":null,"price":200}]', 3),
  ((SELECT id FROM cat WHERE slug='stryzhky'), 'Стрижка дитяча', NULL, 30,
    '[{"label":null,"price":400}]', 4),

  -- Догляд за волоссям
  ((SELECT id FROM cat WHERE slug='doglyad'), 'Реконструкція Cold', NULL, 90,
    '[{"label":null,"price":1700}]', 1),
  ((SELECT id FROM cat WHERE slug='doglyad'), 'Протеїнове відновлення', NULL, 90,
    '[{"label":null,"price":2100}]', 2),
  ((SELECT id FROM cat WHERE slug='doglyad'), 'Відновлення IR-праскою', NULL, 90,
    '[{"label":null,"price":1700}]', 3),
  ((SELECT id FROM cat WHERE slug='doglyad'), 'Глибоке живлення + зволоження', NULL, 60,
    '[{"label":null,"price":1700}]', 4),
  ((SELECT id FROM cat WHERE slug='doglyad'), 'Холодний ботокс', NULL, 90,
    '[{"label":null,"price":1800}]', 5),
  ((SELECT id FROM cat WHERE slug='doglyad'), 'Пілінг шкіри голови', NULL, 60,
    '[{"label":"1-ша","price":450},{"label":"2-га","price":550},{"label":"3-тя","price":650}]', 6),
  ((SELECT id FROM cat WHERE slug='doglyad'), '3-етапне відновлення + пілінг', NULL, 120,
    '[{"label":"1-ша","price":1700},{"label":"2-га","price":2100},{"label":"3-тя","price":2400}]', 7),

  -- Брови
  ((SELECT id FROM cat WHERE slug='brovy'), 'Корекція + фарбування', NULL, 45,
    '[{"label":null,"price":500}]', 1),
  ((SELECT id FROM cat WHERE slug='brovy'), 'Корекція форми брів / Чоловіча', NULL, 30,
    '[{"label":null,"price":350}]', 2),
  ((SELECT id FROM cat WHERE slug='brovy'), 'Моделювання форми брів', NULL, 30,
    '[{"label":null,"price":300}]', 3),
  ((SELECT id FROM cat WHERE slug='brovy'), 'Фарбування брів', NULL, 30,
    '[{"label":null,"price":300}]', 4),
  ((SELECT id FROM cat WHERE slug='brovy'), 'Ламінування брів + фарбування + корекція', NULL, 60,
    '[{"label":null,"price":700}]', 5),

  -- Вії
  ((SELECT id FROM cat WHERE slug='viyi'), 'Фарбування вій', NULL, 30,
    '[{"label":null,"price":300}]', 1),
  ((SELECT id FROM cat WHERE slug='viyi'), 'Фарбування + ламінування', NULL, 60,
    '[{"label":null,"price":600}]', 2),

  -- Зачіски
  ((SELECT id FROM cat WHERE slug='zachisky'), 'Укладка на браш', 'Миття + догляд', 60,
    '[{"label":"1-ша","price":400},{"label":"2-га","price":500},{"label":"3-тя","price":600}]', 1),
  ((SELECT id FROM cat WHERE slug='zachisky'), 'Накрутка локони', 'Без миття волосся', 60,
    '[{"label":"1-ша","price":400},{"label":"2-га","price":500},{"label":"3-тя","price":600}]', 2),
  ((SELECT id FROM cat WHERE slug='zachisky'), 'Накрутка афро-локони', NULL, 75,
    '[{"label":"1-ша","price":600},{"label":"2-га","price":700},{"label":"3-тя","price":800}]', 3),
  ((SELECT id FROM cat WHERE slug='zachisky'), 'Зачіска', NULL, 60,
    '[{"label":"1-ша","price":600},{"label":"2-га","price":700},{"label":"3-тя","price":800}]', 4),
  ((SELECT id FROM cat WHERE slug='zachisky'), 'Зачіска Весільна', NULL, 90,
    '[{"label":"1-ша","price":1200},{"label":"2-га","price":1400},{"label":"3-тя","price":1500}]', 5),

  -- Макіяж
  ((SELECT id FROM cat WHERE slug='makiyazh'), 'Макіяж-Експрес', NULL, 30,
    '[{"label":null,"price":500}]', 1),
  ((SELECT id FROM cat WHERE slug='makiyazh'), 'Макіяж Денний', NULL, 60,
    '[{"label":null,"price":600}]', 2),
  ((SELECT id FROM cat WHERE slug='makiyazh'), 'Макіяж Вечірній', NULL, 60,
    '[{"label":null,"price":800}]', 3),
  ((SELECT id FROM cat WHERE slug='makiyazh'), 'Макіяж Випускний', NULL, 60,
    '[{"label":null,"price":800}]', 4),
  ((SELECT id FROM cat WHERE slug='makiyazh'), 'Макіяж Весільний', NULL, 90,
    '[{"label":null,"price":1000}]', 5),
  ((SELECT id FROM cat WHERE slug='makiyazh'), 'Макіяж до 10:00 години', NULL, 60,
    '[{"label":null,"price":1000}]', 6),

  -- Чоловічі
  ((SELECT id FROM cat WHERE slug='cholovichi'), 'Стрижка однією насадкою', NULL, 20,
    '[{"label":null,"price":300}]', 1),
  ((SELECT id FROM cat WHERE slug='cholovichi'), 'Стрижка модельна', NULL, 40,
    '[{"label":null,"price":400}]', 2),
  ((SELECT id FROM cat WHERE slug='cholovichi'), 'Стрижка бороди', NULL, 20,
    '[{"label":null,"price":200}]', 3),
  ((SELECT id FROM cat WHERE slug='cholovichi'), 'Камуфляж сивини', NULL, 30,
    '[{"label":null,"price":200}]', 4),
  ((SELECT id FROM cat WHERE slug='cholovichi'), 'Чоловіча корекція воском', NULL, 15,
    '[{"label":null,"price":100}]', 5);

-- Майстер за замовчуванням з усіма категоріями
INSERT INTO public.masters (name, bio, specialties, order_index)
SELECT 'Майстер салону', 'Майстер з широким спектром послуг', ARRAY_AGG(id), 1
FROM public.service_categories;

-- Графік: щодня 9-20 для всіх майстрів
INSERT INTO public.master_schedule (master_id, weekday, start_time, end_time, is_working)
SELECT m.id, g.day, '09:00'::time, '20:00'::time, true
FROM public.masters m
CROSS JOIN generate_series(0, 6) AS g(day);

-- 1. Remove bookings from realtime publication (client data exposure)
ALTER PUBLICATION supabase_realtime DROP TABLE public.bookings;

-- 2. Remove overly-permissive "Anyone can create booking" policy.
-- Bookings are created server-side via create-booking edge function (service role).
DROP POLICY IF EXISTS "Anyone can create booking" ON public.bookings;

-- 3. Promo codes - remove public read. Validation must go through edge function.
DROP POLICY IF EXISTS "Anyone can read active promo codes" ON public.promo_codes;

-- 4. Site settings - hide sensitive internal keys from public
DROP POLICY IF EXISTS "Anyone can view settings" ON public.site_settings;
CREATE POLICY "Public can view non-sensitive settings"
  ON public.site_settings
  FOR SELECT
  TO anon, authenticated
  USING (key NOT IN ('telegram_admin_chat_ids'));

-- 5. Storage product-images: restrict listing + writes to admins only.
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

-- Public read via direct object path (no list). Restrict listing by requiring a name filter:
-- We allow SELECT only to admins to avoid bucket listing. Public URLs still work because
-- the bucket is public (served by storage CDN without RLS check on object metadata listing).
CREATE POLICY "Admins manage product images select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

-- 6. Set search_path on functions that are missing it.
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- 7. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated.
-- Keep callable: has_role (used in RLS), get_busy_intervals (booking page), make_first_admin (auth user).
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.make_first_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique
  ON public.products (barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

-- 1. SHOPS
CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- 2. SHOP MEMBERS
CREATE TYPE public.shop_role AS ENUM ('owner', 'admin', 'staff');

CREATE TABLE public.shop_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.shop_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_members TO authenticated;
GRANT ALL ON public.shop_members TO service_role;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;

-- 3. Security definer helpers
CREATE OR REPLACE FUNCTION public.is_shop_member(_user_id uuid, _shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shop_members WHERE user_id = _user_id AND shop_id = _shop_id);
$$;

CREATE OR REPLACE FUNCTION public.has_shop_role(_user_id uuid, _shop_id uuid, _roles public.shop_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shop_members WHERE user_id = _user_id AND shop_id = _shop_id AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.is_any_shop_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shop_members WHERE user_id = _user_id);
$$;

-- 4. CATALOG PRODUCTS (shared)
CREATE TABLE public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL UNIQUE,
  name text NOT NULL,
  brand text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  description text,
  ingredients text,
  usage_instructions text,
  skin_type text,
  image_url text,
  image_hover text,
  created_by_shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalog_products_barcode ON public.catalog_products(barcode);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_products TO authenticated;
GRANT ALL ON public.catalog_products TO service_role;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

-- 5. SHOP INVENTORY
CREATE TABLE public.shop_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  catalog_product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  barcode text NOT NULL,
  price numeric(10,2),
  cost_price numeric(10,2),
  stock_quantity integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT false,
  custom_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, catalog_product_id)
);
CREATE INDEX idx_shop_inventory_shop ON public.shop_inventory(shop_id);
CREATE INDEX idx_shop_inventory_barcode ON public.shop_inventory(barcode);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_inventory TO authenticated;
GRANT ALL ON public.shop_inventory TO service_role;
ALTER TABLE public.shop_inventory ENABLE ROW LEVEL SECURITY;

-- 6. POLICIES — shops
CREATE POLICY "Members can view their shops" ON public.shops
  FOR SELECT TO authenticated USING (public.is_shop_member(auth.uid(), id));
CREATE POLICY "Owner can update shop" ON public.shops
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Global admins can manage shops" ON public.shops
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- POLICIES — shop_members
CREATE POLICY "Members can view membership of their shops" ON public.shop_members
  FOR SELECT TO authenticated USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Owners/admins manage members" ON public.shop_members
  FOR ALL TO authenticated
  USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner','admin']::public.shop_role[]) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner','admin']::public.shop_role[]) OR public.has_role(auth.uid(), 'admin'));

-- POLICIES — catalog_products (shared between all shops)
CREATE POLICY "Any shop member reads catalog" ON public.catalog_products
  FOR SELECT TO authenticated USING (public.is_any_shop_member(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Any shop member inserts catalog" ON public.catalog_products
  FOR INSERT TO authenticated WITH CHECK (public.is_any_shop_member(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Any shop member updates catalog" ON public.catalog_products
  FOR UPDATE TO authenticated USING (public.is_any_shop_member(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Global admins delete catalog" ON public.catalog_products
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- POLICIES — shop_inventory (per shop)
CREATE POLICY "Members read shop inventory" ON public.shop_inventory
  FOR SELECT TO authenticated USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Members write shop inventory" ON public.shop_inventory
  FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

-- 7. Triggers
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_catalog_products_updated_at BEFORE UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shop_inventory_updated_at BEFORE UPDATE ON public.shop_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Seed shops + members
INSERT INTO public.shops (name, slug, owner_user_id) VALUES
  ('Підземка', 'pidzemka', NULL),
  ('Салон', 'salon', NULL);

INSERT INTO public.shop_members (shop_id, user_id, role)
SELECT s.id, ur.user_id, 'owner'::public.shop_role
FROM public.shops s
CROSS JOIN public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT DO NOTHING;
