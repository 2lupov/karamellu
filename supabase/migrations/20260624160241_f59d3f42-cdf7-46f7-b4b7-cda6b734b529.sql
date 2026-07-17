
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique
  ON public.products (barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';
