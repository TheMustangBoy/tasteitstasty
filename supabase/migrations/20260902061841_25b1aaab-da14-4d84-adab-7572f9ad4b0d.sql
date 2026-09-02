-- 3) Sequenz auf hoechsten bestehenden numerischen TIT-Suffix setzen
DO $$
DECLARE v_max bigint;
BEGIN
  SELECT COALESCE(MAX((substring(reference from '^TIT-([0-9]+)$'))::bigint), 0)
    INTO v_max
    FROM public.orders
   WHERE reference ~ '^TIT-[0-9]+$';
  IF v_max < 1 THEN
    PERFORM setval('public.order_reference_seq', 1, false);
  ELSE
    PERFORM setval('public.order_reference_seq', v_max, true);
  END IF;
END $$;

-- 1a) Nur Fehlerhinweis vermerken, Reservierung bleibt pending (Slot bleibt belegt)
CREATE OR REPLACE FUNCTION public.note_payment_failure(p_reservation_id uuid, p_error text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.payment_reservations
     SET last_error = p_error
   WHERE id = p_reservation_id
     AND status = 'pending';
END;
$function$;

REVOKE ALL ON FUNCTION public.note_payment_failure(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.note_payment_failure(uuid, text) TO service_role;

-- 1b) finalize: defensiv bei nicht-pending Reservierungen (keine Ueberbuchung)
CREATE OR REPLACE FUNCTION public.finalize_payment_reservation(p_reservation_id uuid, p_payment_intent_id text, p_amount_cents integer, p_currency text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_res public.payment_reservations; v_row public.orders; v_ref text; v_try integer := 0;
BEGIN
  SELECT * INTO v_res FROM public.payment_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVATION_NOT_FOUND'; END IF;

  IF v_res.status = 'paid' AND v_res.final_order_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.orders WHERE id = v_res.final_order_id;
    RETURN v_row;
  END IF;

  IF v_res.status IN ('refunded','slot_full_after_expiry') THEN
    RAISE EXCEPTION 'SLOT_FULL_AFTER_EXPIRY';
  END IF;

  IF v_res.stripe_payment_intent_id IS NOT NULL
     AND v_res.stripe_payment_intent_id <> p_payment_intent_id THEN
    RAISE EXCEPTION 'PAYMENT_INTENT_MISMATCH';
  END IF;
  IF lower(COALESCE(p_currency, '')) <> lower(v_res.currency) THEN
    RAISE EXCEPTION 'CURRENCY_MISMATCH';
  END IF;
  IF p_amount_cents IS DISTINCT FROM round(v_res.total * 100)::integer THEN
    RAISE EXCEPTION 'AMOUNT_MISMATCH';
  END IF;

  SELECT * INTO v_row FROM public.orders WHERE stripe_payment_intent_id = p_payment_intent_id;
  IF FOUND THEN
    UPDATE public.payment_reservations
       SET status = 'paid', final_order_id = v_row.id,
           stripe_payment_intent_id = p_payment_intent_id
     WHERE id = v_res.id;
    RETURN v_row;
  END IF;

  -- Abgelaufen ODER terminaler Status (failed/cancelled/expired):
  -- Slot ohne eigene Reservierung neu pruefen, damit keine Ueberbuchung entsteht.
  IF v_res.expires_at <= now() OR v_res.status <> 'pending' THEN
    IF NOT public.slot_has_capacity_excluding(v_res.pickup_at, v_res.id) THEN
      UPDATE public.payment_reservations
         SET status = 'slot_full_after_expiry',
             stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, p_payment_intent_id),
             last_error = 'slot_full_after_expiry'
       WHERE id = v_res.id;
      RAISE EXCEPTION 'SLOT_FULL_AFTER_EXPIRY';
    END IF;
  END IF;

  LOOP
    v_try := v_try + 1;
    v_ref := COALESCE(NULLIF(v_res.reference, ''), public.next_order_reference());
    IF v_try > 1 THEN v_ref := public.next_order_reference(); END IF;
    BEGIN
      INSERT INTO public.orders (reference, customer_name, phone, pickup_at, pickup_label,
                                 payment, lines, total, note,
                                 payment_provider, payment_status,
                                 stripe_payment_intent_id, paid_at)
      VALUES (v_ref, v_res.customer_name, v_res.phone, v_res.pickup_at, v_res.pickup_label,
              'Online bezahlt', v_res.lines, v_res.total, v_res.note,
              'stripe', 'paid', p_payment_intent_id, now())
      RETURNING * INTO v_row;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_try >= 5 THEN RAISE; END IF;
    END;
  END LOOP;

  UPDATE public.payment_reservations
     SET status = 'paid', final_order_id = v_row.id, reference = v_row.reference,
         stripe_payment_intent_id = p_payment_intent_id, last_error = NULL
   WHERE id = v_res.id;
  RETURN v_row;
END;
$function$;

-- 2) checkout_key-Rotation: terminale Reservierung => CHECKOUT_KEY_STALE
CREATE OR REPLACE FUNCTION public.create_payment_reservation(p_token text, p_checkout_key text, p_customer_name text, p_phone text, p_pickup_at timestamp with time zone, p_pickup_label text, p_lines jsonb, p_total numeric, p_note text DEFAULT ''::text, p_ttl_minutes integer DEFAULT 20)
 RETURNS payment_reservations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_valid jsonb; v_row public.payment_reservations;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 THEN RAISE EXCEPTION 'INVALID_TOKEN'; END IF;
  IF p_checkout_key IS NULL OR length(p_checkout_key) < 16 THEN RAISE EXCEPTION 'INVALID_CHECKOUT_KEY'; END IF;

  UPDATE public.payment_reservations SET status = 'expired'
   WHERE status = 'pending' AND expires_at <= now();

  SELECT * INTO v_row FROM public.payment_reservations
   WHERE checkout_key = p_checkout_key
   LIMIT 1;

  IF FOUND THEN
    -- Aktive oder bezahlte Reservierung wiederverwenden.
    IF v_row.status = 'paid' OR (v_row.status = 'pending' AND v_row.expires_at > now()) THEN
      RETURN v_row;
    END IF;
    -- Terminaler Zustand: Schluessel ist verbraucht, Browser muss rotieren.
    RAISE EXCEPTION 'CHECKOUT_KEY_STALE';
  END IF;

  v_valid := public.validate_order_payload(p_pickup_at, p_lines, p_total);
  PERFORM public.assert_slot_capacity(p_pickup_at);

  INSERT INTO public.payment_reservations (
    token, checkout_key, reference, customer_name, phone, pickup_at, pickup_label, note,
    lines, total, expires_at)
  VALUES (
    p_token, p_checkout_key, public.next_order_reference(), COALESCE(p_customer_name,''),
    COALESCE(p_phone,''), p_pickup_at, COALESCE(p_pickup_label,''), COALESCE(p_note,''),
    v_valid->'lines', (v_valid->>'total')::numeric,
    now() + make_interval(mins => GREATEST(COALESCE(p_ttl_minutes, 20), 5)))
  RETURNING * INTO v_row;
  RETURN v_row;
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_row FROM public.payment_reservations WHERE checkout_key = p_checkout_key LIMIT 1;
  IF FOUND AND (v_row.status = 'paid' OR (v_row.status = 'pending' AND v_row.expires_at > now())) THEN
    RETURN v_row;
  END IF;
  RAISE EXCEPTION 'CHECKOUT_KEY_STALE';
END;
$function$;

-- 3b) place_order: defensives Retry bei Referenz-Kollision
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
  v_try integer := 0;
BEGIN
  IF COALESCE(p_payment, '') NOT IN ('Barzahlung bei Abholung', 'Kartenzahlung bei Abholung') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_ALLOWED';
  END IF;

  v_valid := public.validate_order_payload(p_pickup_at, p_lines, p_total);
  PERFORM public.assert_slot_capacity(p_pickup_at);

  LOOP
    v_try := v_try + 1;
    v_reference := public.next_order_reference();
    BEGIN
      INSERT INTO public.orders (reference, customer_name, phone, pickup_at, pickup_label,
                                 payment, lines, total, note,
                                 payment_provider, payment_status)
      VALUES (v_reference, p_customer_name, p_phone, p_pickup_at, p_pickup_label,
              p_payment, v_valid->'lines', (v_valid->>'total')::numeric, COALESCE(p_note, ''),
              'manual', 'pay_on_pickup')
      RETURNING * INTO v_row;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_try >= 5 THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_payment_reservation(text, text, text, text, timestamptz, text, jsonb, numeric, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_reservation(text, text, text, text, timestamptz, text, jsonb, numeric, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_payment_reservation(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payment_reservation(uuid, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.place_order(text, text, text, timestamptz, text, text, jsonb, numeric, text) TO anon, authenticated, service_role;