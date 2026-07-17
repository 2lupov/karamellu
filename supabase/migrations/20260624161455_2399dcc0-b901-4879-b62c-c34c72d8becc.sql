
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
