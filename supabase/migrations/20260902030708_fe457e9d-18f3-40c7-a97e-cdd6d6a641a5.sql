-- 1) Admin-Tabelle
CREATE TABLE public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_users self read" ON public.admin_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 2) Prüffunktion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 3) Policies neu setzen
DROP POLICY IF EXISTS "categories offen (kein auth vorhanden)" ON public.categories;
DROP POLICY IF EXISTS "ingredients offen (kein auth vorhanden)" ON public.ingredients;
DROP POLICY IF EXISTS "extras offen (kein auth vorhanden)" ON public.extras;
DROP POLICY IF EXISTS "products offen (kein auth vorhanden)" ON public.products;
DROP POLICY IF EXISTS "hours offen (kein auth vorhanden)" ON public.opening_hours;
DROP POLICY IF EXISTS "settings offen (kein auth vorhanden)" ON public.shop_settings;
DROP POLICY IF EXISTS "orders offen (kein auth vorhanden)" ON public.orders;

-- Öffentliche Katalogtabellen: lesen frei, schreiben nur Admin
CREATE POLICY "categories public read" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "ingredients public read" ON public.ingredients FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ingredients admin write" ON public.ingredients FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "extras public read" ON public.extras FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "extras admin write" ON public.extras FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "products public read" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "hours public read" ON public.opening_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "hours admin write" ON public.opening_hours FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "settings public read" ON public.shop_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "settings admin write" ON public.shop_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Bestellungen: nur Admin
CREATE POLICY "orders admin all" ON public.orders FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.orders FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.categories, public.ingredients, public.extras, public.products, public.opening_hours, public.shop_settings FROM anon;

-- 4) place_order bleibt öffentlich nutzbar (SECURITY DEFINER, da orders nun geschützt ist)
ALTER FUNCTION public.place_order(text, text, text, timestamptz, text, text, jsonb, numeric, text) SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.place_order(text, text, text, timestamptz, text, text, jsonb, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(text, text, text, timestamptz, text, text, jsonb, numeric, text) TO anon, authenticated;

-- 5) Datenschutzkonforme Slot-Auslastung
CREATE OR REPLACE FUNCTION public.get_slot_bookings()
RETURNS TABLE (pickup_at timestamptz, bookings integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.pickup_at, count(*)::integer
  FROM public.orders o
  WHERE o.pickup_at >= now() - interval '1 hour'
    AND o.pickup_at <= now() + interval '8 days'
    AND o.status NOT IN ('abgelehnt', 'storniert')
  GROUP BY o.pickup_at;
$$;

REVOKE ALL ON FUNCTION public.get_slot_bookings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_slot_bookings() TO anon, authenticated;