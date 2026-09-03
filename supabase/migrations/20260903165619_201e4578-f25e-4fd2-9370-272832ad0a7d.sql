ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_key text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_key_uidx
  ON public.orders (checkout_key)
  WHERE checkout_key IS NOT NULL;

DROP FUNCTION IF EXISTS public.place_order(text, text, text, timestamptz, text, text, jsonb, numeric, text);

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
  p_checkout_key text DEFAULT NULL::text
)
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
  v_key text;
BEGIN
  IF COALESCE(p_payment, '') NOT IN ('Barzahlung bei Abholung', 'Kartenzahlung bei Abholung') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_ALLOWED';
  END IF;

  v_key := NULLIF(btrim(COALESCE(p_checkout_key, '')), '');
  IF v_key IS NOT NULL AND v_key !~ '^[0-9a-f]{16,64}$' THEN
    RAISE EXCEPTION 'INVALID_CHECKOUT_KEY';
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
                                 payment_provider, payment_status, checkout_key)
      VALUES (v_reference, p_customer_name, p_phone, p_pickup_at, p_pickup_label,
              p_payment, v_valid->'lines', (v_valid->>'total')::numeric, COALESCE(p_note, ''),
              'manual', 'pay_on_pickup', v_key)
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
      IF v_try >= 5 THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.place_order(text, text, text, timestamptz, text, text, jsonb, numeric, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.place_order(text, text, text, timestamptz, text, text, jsonb, numeric, text, text) TO anon, authenticated, service_role;

-- Vollstaendige Stripe-Erstattung (auch aus dem Stripe-Dashboard) im Shop nachziehen.
CREATE OR REPLACE FUNCTION public.mark_refunded_by_payment_intent(p_payment_intent_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_touched boolean := false;
BEGIN
  IF p_payment_intent_id IS NULL OR length(p_payment_intent_id) < 5 THEN
    RETURN false;
  END IF;

  UPDATE public.orders
     SET payment_status = 'refunded'
   WHERE stripe_payment_intent_id = p_payment_intent_id
     AND payment_provider = 'stripe'
     AND COALESCE(payment_status, '') = 'paid';
  IF FOUND THEN v_touched := true; END IF;

  UPDATE public.payment_reservations
     SET status = 'refunded'
   WHERE stripe_payment_intent_id = p_payment_intent_id
     AND status <> 'refunded';

  RETURN v_touched;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_refunded_by_payment_intent(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_refunded_by_payment_intent(text) TO service_role;