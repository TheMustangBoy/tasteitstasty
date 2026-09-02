-- Punkt 1: Orders-Rechte auf das tatsächlich Genutzte einschränken.
DROP POLICY IF EXISTS "orders admin all" ON public.orders;

REVOKE ALL ON public.orders FROM authenticated;
REVOKE ALL ON public.orders FROM anon;

GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

CREATE POLICY "orders admin select" ON public.orders
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "orders admin update" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
