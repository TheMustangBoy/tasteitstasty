ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_status_token text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_customer_status_token_key
  ON public.orders (customer_status_token)
  WHERE customer_status_token IS NOT NULL;

DROP FUNCTION IF EXISTS public.place_order(text, text, text, timestamptz, text, text, jsonb, numeric, text, text);

CREATE OR REPLACE FUNCTION public.place_order(
  p_reference text,
  p_customer_name text,
  p_phone text,
  p_pickup_at timestamp with time zone,
  p_pickup_label text,
  p_payment text,
  p_lines jsonb,
  p_total numeric,
  p_note text DEFAULT ''::text,
  p_checkout_key text DEFAULT NULL::text,
  p_status_token text DEFAULT NULL::text
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valid jsonb;
  v_row public.orders;
  v_reference text;
  v_try integer := 0;
  v_key text;
  v_token text;
BEGIN
  IF COALESCE(p_payment, '') NOT IN ('Barzahlung bei Abholung', 'Kartenzahlung bei Abholung') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_ALLOWED';
  END IF;

  v_key := NULLIF(btrim(COALESCE(p_checkout_key, '')), '');
  IF v_key IS NOT NULL AND v_key !~ '^[0-9a-f]{16,64}$' THEN
    RAISE EXCEPTION 'INVALID_CHECKOUT_KEY';
  END IF;

  v_token := NULLIF(btrim(COALESCE(p_status_token, '')), '');
  IF v_token IS NOT NULL AND v_token !~ '^[0-9a-f]{32,128}$' THEN
    RAISE EXCEPTION 'INVALID_STATUS_TOKEN';
  END IF;

  -- Idempotenz: identischer Snapshot-Schluessel liefert exakt dieselbe Bestellung.
  IF v_key IS NOT NULL THEN
    SELECT * INTO v_row FROM public.orders WHERE checkout_key = v_key;
    IF FOUND THEN
      RETURN v_row;
    END IF;
  END IF;

  v_valid := public.validate_order_payload(p_pickup_at, p_lines, p_total);
  PERFORM public.assert_slot_capacity(p_pickup_at);

  LOOP
    v_try := v_try + 1;
    v_reference := public.next_order_reference();
    BEGIN
      INSERT INTO public.orders (reference, customer_name, phone, pickup_at, pickup_label,
                                 payment, lines, total, note,
                                 payment_provider, payment_status, checkout_key,
                                 customer_status_token)
      VALUES (v_reference, p_customer_name, p_phone, p_pickup_at, p_pickup_label,
              p_payment, v_valid->'lines', (v_valid->>'total')::numeric, COALESCE(p_note, ''),
              'manual', 'pay_on_pickup', v_key, v_token)
      RETURNING * INTO v_row;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- Paralleler Retry mit demselben Schluessel: bestehende Bestellung zurueckgeben.
      IF v_key IS NOT NULL THEN
        SELECT * INTO v_row FROM public.orders WHERE checkout_key = v_key;
        IF FOUND THEN
          RETURN v_row;
        END IF;
      END IF;
      IF v_token IS NOT NULL THEN
        SELECT * INTO v_row FROM public.orders WHERE customer_status_token = v_token;
        IF FOUND THEN
          RETURN v_row;
        END IF;
      END IF;
      IF v_try >= 5 THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN v_row;
END;
$function$;

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
                                 stripe_payment_intent_id, paid_at,
                                 customer_status_token)
      VALUES (v_ref, v_res.customer_name, v_res.phone, v_res.pickup_at, v_res.pickup_label,
              'Online bezahlt', v_res.lines, v_res.total, v_res.note,
              'stripe', 'paid', p_payment_intent_id, now(),
              v_res.token)
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