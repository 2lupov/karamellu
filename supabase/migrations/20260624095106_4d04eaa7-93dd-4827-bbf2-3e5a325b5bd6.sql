
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
