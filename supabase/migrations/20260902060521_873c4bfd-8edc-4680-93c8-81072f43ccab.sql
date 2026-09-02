CREATE OR REPLACE FUNCTION public.place_order(p_reference text, p_customer_name text, p_phone text, p_pickup_at timestamp with time zone, p_pickup_label text, p_payment text, p_lines jsonb, p_total numeric, p_note text DEFAULT ''::text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_valid jsonb;
  v_row public.orders;
  v_reference text;
BEGIN
  IF COALESCE(p_payment, '') NOT IN ('Barzahlung bei Abholung', 'Kartenzahlung bei Abholung') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_ALLOWED';
  END IF;

  v_valid := public.validate_order_payload(p_pickup_at, p_lines, p_total);
  PERFORM public.assert_slot_capacity(p_pickup_at);

  -- Bestellnummer ausschliesslich serverseitig (kollisionsfrei via Sequence).
  v_reference := public.next_order_reference();

  INSERT INTO public.orders (reference, customer_name, phone, pickup_at, pickup_label,
                             payment, lines, total, note,
                             payment_provider, payment_status)
  VALUES (v_reference, p_customer_name, p_phone, p_pickup_at, p_pickup_label,
          p_payment, v_valid->'lines', (v_valid->>'total')::numeric, COALESCE(p_note, ''),
          'manual', 'pay_on_pickup')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.place_order(text, text, text, timestamptz, text, text, jsonb, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(text, text, text, timestamptz, text, text, jsonb, numeric, text) TO anon, authenticated, service_role;