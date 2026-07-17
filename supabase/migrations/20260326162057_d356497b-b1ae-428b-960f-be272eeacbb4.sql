
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
