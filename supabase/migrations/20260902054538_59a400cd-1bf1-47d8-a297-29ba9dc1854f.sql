REVOKE ALL ON FUNCTION public.validate_order_payload(timestamptz, jsonb, numeric) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_slot_capacity(timestamptz) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.create_payment_reservation(text, text, text, text, timestamptz, text, jsonb, numeric, text, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.attach_payment_intent(uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_payment_reservation(uuid, text, integer, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_payment_reservation(uuid, text, text) FROM anon, authenticated;