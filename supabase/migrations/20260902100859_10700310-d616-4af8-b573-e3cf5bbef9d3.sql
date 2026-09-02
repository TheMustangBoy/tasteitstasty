REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;

REVOKE ALL ON FUNCTION public.get_slot_bookings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_slot_bookings() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.place_order(text, text, text, timestamptz, text, text, jsonb, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(text, text, text, timestamptz, text, text, jsonb, numeric, text) TO anon, authenticated, service_role;