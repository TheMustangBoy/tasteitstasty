-- 1) Checkout-Key (echte Idempotenz)
ALTER TABLE public.payment_reservations ADD COLUMN IF NOT EXISTS checkout_key text;
CREATE UNIQUE INDEX IF NOT EXISTS payment_reservations_checkout_key_uidx
  ON public.payment_reservations (checkout_key) WHERE checkout_key IS NOT NULL;

-- 2) Neue Status
ALTER TABLE public.payment_reservations DROP CONSTRAINT IF EXISTS payment_reservations_status_check;
ALTER TABLE public.payment_reservations ADD CONSTRAINT payment_reservations_status_check
  CHECK (status = ANY (ARRAY['pending','paid','failed','cancelled','expired','refunded','slot_full_after_expiry']));

-- 3) Kollisionsfreie Bestellnummern
CREATE SEQUENCE IF NOT EXISTS public.order_reference_seq START WITH 1000 INCREMENT BY 1;
REVOKE ALL ON SEQUENCE public.order_reference_seq FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.next_order_reference()
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT 'TIT-' || lpad(nextval('public.order_reference_seq')::text, 4, '0');
$$;
REVOKE ALL ON FUNCTION public.next_order_reference() FROM anon, authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS orders_reference_uidx ON public.orders (reference);

-- 4) Kapazitätsprüfung mit Ausschluss einer eigenen Reservierung
CREATE OR REPLACE FUNCTION public.assert_slot_capacity(p_pickup_at timestamp with time zone)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_max integer; v_count integer;
BEGIN
  SELECT max_orders_per_slot INTO v_max FROM public.shop_settings WHERE id = 1;
  v_max := COALESCE(v_max, 4);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_pickup_at::text, 0));
  SELECT
    (SELECT count(*) FROM public.orders o
      WHERE o.pickup_at = p_pickup_at AND o.status NOT IN ('abgelehnt','storniert'))
  + (SELECT count(*) FROM public.payment_reservations r
      WHERE r.pickup_at = p_pickup_at AND r.status = 'pending' AND r.expires_at > now())
  INTO v_count;
  IF v_count >= v_max THEN RAISE EXCEPTION 'SLOT_FULL'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.slot_has_capacity_excluding(
  p_pickup_at timestamp with time zone, p_reservation_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_max integer; v_count integer;
BEGIN
  SELECT max_orders_per_slot INTO v_max FROM public.shop_settings WHERE id = 1;
  v_max := COALESCE(v_max, 4);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_pickup_at::text, 0));
  SELECT
    (SELECT count(*) FROM public.orders o
      WHERE o.pickup_at = p_pickup_at AND o.status NOT IN ('abgelehnt','storniert'))
  + (SELECT count(*) FROM public.payment_reservations r
      WHERE r.pickup_at = p_pickup_at AND r.status = 'pending'
        AND r.expires_at > now() AND r.id <> p_reservation_id)
  INTO v_count;
  RETURN v_count < v_max;
END;
$$;
REVOKE ALL ON FUNCTION public.slot_has_capacity_excluding(timestamp with time zone, uuid) FROM anon, authenticated;

-- 5) Reservierung anlegen – idempotent über checkout_key, Referenz serverseitig
DROP FUNCTION IF EXISTS public.create_payment_reservation(text, text, text, text, timestamp with time zone, text, jsonb, numeric, text, integer);

CREATE OR REPLACE FUNCTION public.create_payment_reservation(
  p_token text, p_checkout_key text, p_customer_name text, p_phone text,
  p_pickup_at timestamp with time zone, p_pickup_label text, p_lines jsonb,
  p_total numeric, p_note text DEFAULT ''::text, p_ttl_minutes integer DEFAULT 20)
RETURNS payment_reservations LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_valid jsonb; v_row public.payment_reservations;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 THEN RAISE EXCEPTION 'INVALID_TOKEN'; END IF;
  IF p_checkout_key IS NULL OR length(p_checkout_key) < 16 THEN RAISE EXCEPTION 'INVALID_CHECKOUT_KEY'; END IF;

  UPDATE public.payment_reservations SET status = 'expired'
   WHERE status = 'pending' AND expires_at <= now();

  -- Gleicher Checkout-Snapshot -> bestehende, noch gueltige Reservierung wiederverwenden
  SELECT * INTO v_row FROM public.payment_reservations
   WHERE checkout_key = p_checkout_key
     AND ((status = 'pending' AND expires_at > now()) OR status = 'paid')
   LIMIT 1;
  IF FOUND THEN RETURN v_row; END IF;

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
  IF FOUND THEN RETURN v_row; END IF;
  RAISE;
END;
$$;
REVOKE ALL ON FUNCTION public.create_payment_reservation(text, text, text, text, timestamp with time zone, text, jsonb, numeric, text, integer) FROM anon, authenticated;

-- 6) Finalisierung: spaete Erfolge, Ablauf-Handling, Referenz-Kollisionen
CREATE OR REPLACE FUNCTION public.finalize_payment_reservation(
  p_reservation_id uuid, p_payment_intent_id text, p_amount_cents integer, p_currency text)
RETURNS orders LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

  -- Abgelaufene Reservierung: Slot ohne eigene Reservierung neu pruefen
  IF v_res.expires_at <= now() THEN
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
$$;

-- 7) Statusmarkierung inkl. refunded; 'pending' ist keine Vorbedingung mehr fuer Endzustaende
CREATE OR REPLACE FUNCTION public.mark_payment_reservation(
  p_reservation_id uuid, p_status text, p_error text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_status NOT IN ('failed','cancelled','expired','refunded') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;
  UPDATE public.payment_reservations
     SET status = p_status, last_error = p_error
   WHERE id = p_reservation_id
     AND status <> 'paid'
     AND (p_status = 'refunded' OR status = 'pending');
END;
$$;

-- 8) place_order: serverseitige Referenz
CREATE OR REPLACE FUNCTION public.place_order(
  p_reference text, p_customer_name text, p_phone text,
  p_pickup_at timestamp with time zone, p_pickup_label text, p_payment text,
  p_lines jsonb, p_total numeric, p_note text DEFAULT ''::text)
RETURNS orders LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_valid jsonb; v_row public.orders; v_try integer := 0;
BEGIN
  IF COALESCE(p_payment, '') NOT IN ('Barzahlung bei Abholung', 'Kartenzahlung bei Abholung') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_ALLOWED';
  END IF;
  v_valid := public.validate_order_payload(p_pickup_at, p_lines, p_total);
  PERFORM public.assert_slot_capacity(p_pickup_at);

  LOOP
    v_try := v_try + 1;
    BEGIN
      INSERT INTO public.orders (reference, customer_name, phone, pickup_at, pickup_label,
                                 payment, lines, total, note, payment_provider, payment_status)
      VALUES (public.next_order_reference(), p_customer_name, p_phone, p_pickup_at, p_pickup_label,
              p_payment, v_valid->'lines', (v_valid->>'total')::numeric, COALESCE(p_note, ''),
              'manual', 'pay_on_pickup')
      RETURNING * INTO v_row;
      RETURN v_row;
    EXCEPTION WHEN unique_violation THEN
      IF v_try >= 5 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;
