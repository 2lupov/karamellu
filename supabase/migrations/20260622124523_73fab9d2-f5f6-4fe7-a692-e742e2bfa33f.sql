
-- email optional
ALTER TABLE public.orders ALTER COLUMN email DROP NOT NULL;

-- new delivery option
ALTER TYPE public.delivery_method ADD VALUE IF NOT EXISTS 'khmelnytskyi';

-- nova poshta details
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS np_city_ref text,
  ADD COLUMN IF NOT EXISTS np_warehouse_type text;
