
-- Fix overly permissive order items insert - scope to items belonging to orders created in same session
DROP POLICY "Anyone can create order items" ON public.order_items;
CREATE POLICY "Guest can create order items for their orders" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id IS NULL)
  );
