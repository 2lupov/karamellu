
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
