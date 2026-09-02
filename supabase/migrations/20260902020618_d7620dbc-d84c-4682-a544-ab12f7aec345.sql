CREATE OR REPLACE FUNCTION public.place_order(
  p_reference text,
  p_customer_name text,
  p_phone text,
  p_pickup_at timestamptz,
  p_pickup_label text,
  p_payment text,
  p_lines jsonb,
  p_total numeric,
  p_note text DEFAULT ''
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_paused boolean;
  v_count integer;
  v_row public.orders;
BEGIN
  SELECT max_orders_per_slot, orders_paused INTO v_max, v_paused
    FROM public.shop_settings WHERE id = 1;
  v_max := COALESCE(v_max, 4);

  IF COALESCE(v_paused, false) THEN
    RAISE EXCEPTION 'ORDERS_PAUSED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_pickup_at::text, 0));

  SELECT count(*) INTO v_count FROM public.orders
   WHERE pickup_at = p_pickup_at
     AND status NOT IN ('abgelehnt','storniert');

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'SLOT_FULL';
  END IF;

  INSERT INTO public.orders (reference, customer_name, phone, pickup_at, pickup_label,
                             payment, lines, total, note)
  VALUES (p_reference, p_customer_name, p_phone, p_pickup_at, p_pickup_label,
          p_payment, p_lines, p_total, COALESCE(p_note, ''))
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;