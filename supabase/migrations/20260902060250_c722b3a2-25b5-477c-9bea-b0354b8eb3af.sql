REVOKE ALL ON FUNCTION public.create_payment_reservation(text, text, text, text, timestamp with time zone, text, jsonb, numeric, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_order_reference() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.slot_has_capacity_excluding(timestamp with time zone, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_payment_reservation(text, text, text, text, timestamp with time zone, text, jsonb, numeric, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_order_reference() TO service_role;
GRANT EXECUTE ON FUNCTION public.slot_has_capacity_excluding(timestamp with time zone, uuid) TO service_role;