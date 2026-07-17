CREATE TABLE public.promo_codes (
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