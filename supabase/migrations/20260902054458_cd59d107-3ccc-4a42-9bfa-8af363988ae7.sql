-- 1) Payment-Metadaten auf orders (nullable => Altbestand bleibt unmarkiert)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_provider_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_provider_check
  CHECK (payment_provider IS NULL OR payment_provider IN ('manual','stripe'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IS NULL OR payment_status IN ('pay_on_pickup','paid','refunded'));

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_payment_intent_id_key
  ON public.orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- 2) Reservierungen für Online-Zahlungen
CREATE TABLE IF NOT EXISTS public.payment_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  reference text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  pickup_at timestamptz NOT NULL,
  pickup_label text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  stripe_payment_intent_id text UNIQUE,
  stripe_session_id text,
  final_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_reservations_status_check
    CHECK (status IN ('pending','paid','failed','cancelled','expired'))
);

-- Zugriff ausschliesslich serverseitig (Service Role); keine Data-API-Rechte.
REVOKE ALL ON public.payment_reservations FROM anon, authenticated;
GRANT ALL ON public.payment_reservations TO service_role;
ALTER TABLE public.payment_reservations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS payment_reservations_pickup_idx
  ON public.payment_reservations (pickup_at) WHERE status = 'pending';

DROP TRIGGER IF EXISTS payment_reservations_updated_at ON public.payment_reservations;
CREATE TRIGGER payment_reservations_updated_at
  BEFORE UPDATE ON public.payment_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Gemeinsame Validierung (eine Quelle fuer Vor-Ort und Online)
CREATE OR REPLACE FUNCTION public.validate_order_payload(
  p_pickup_at timestamptz,
  p_lines jsonb,
  p_total numeric
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead integer;
  v_paused boolean;
  v_line jsonb;
  v_extra jsonb;
  v_option jsonb;
  v_product public.products%ROWTYPE;
  v_category public.categories%ROWTYPE;
  v_hours public.opening_hours%ROWTYPE;
  v_local timestamp;
  v_weekday integer;
  v_time text;
  v_qty integer;
  v_line_unit numeric;
  v_calc_total numeric := 0;
  v_extra_price numeric;
  v_extra_name text;
  v_option_delta numeric;
  v_option_found boolean;
  v_opt jsonb;
  v_removed text;
  v_norm_lines jsonb := '[]'::jsonb;
  v_norm_extras jsonb;
  v_norm_options jsonb;
  v_variant jsonb;
BEGIN
  SELECT min_lead_minutes, orders_paused INTO v_lead, v_paused
    FROM public.shop_settings WHERE id = 1;
  v_lead := COALESCE(v_lead, 15);

  IF COALESCE(v_paused, false) THEN
    RAISE EXCEPTION 'ORDERS_PAUSED';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO v_product FROM public.products WHERE id = (v_line->>'itemId');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE:%', COALESCE(v_line->>'name', v_line->>'itemId');
    END IF;
    IF NOT v_product.active OR v_product.sold_out THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE:%', v_product.name;
    END IF;

    SELECT * INTO v_category FROM public.categories WHERE id = v_product.category_id;
    IF NOT FOUND OR v_category.paused THEN
      RAISE EXCEPTION 'CATEGORY_PAUSED:%', v_product.name;
    END IF;

    v_qty := COALESCE((v_line->>'quantity')::numeric, 0)::integer;
    IF v_qty < 1 OR v_qty > 20 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY:%', v_product.name;
    END IF;

    IF (v_line ? 'basePrice')
       AND abs(v_product.price - COALESCE((v_line->>'basePrice')::numeric, -1)) > 0.005 THEN
      RAISE EXCEPTION 'PRICE_CHANGED';
    END IF;

    IF jsonb_typeof(COALESCE(v_line->'removed', 'null'::jsonb)) = 'array' THEN
      FOR v_removed IN SELECT jsonb_array_elements_text(v_line->'removed') LOOP
        IF NOT (v_removed = ANY (COALESCE(v_product.removable, ARRAY[]::text[]))) THEN
          RAISE EXCEPTION 'INVALID_REMOVAL:%', v_removed;
        END IF;
      END LOOP;
    END IF;

    v_line_unit := v_product.price;
    v_norm_extras := '[]'::jsonb;
    v_norm_options := '[]'::jsonb;

    IF jsonb_typeof(COALESCE(v_line->'extras', 'null'::jsonb)) = 'array' THEN
      FOR v_extra IN SELECT * FROM jsonb_array_elements(v_line->'extras') LOOP
        IF NOT ((v_extra->>'id') = ANY (v_product.extra_ids)) THEN
          RAISE EXCEPTION 'EXTRA_UNAVAILABLE:%', COALESCE(v_extra->>'name', v_extra->>'id');
        END IF;
        SELECT price, name INTO v_extra_price, v_extra_name
          FROM public.extras WHERE id = (v_extra->>'id');
        IF NOT FOUND THEN
          RAISE EXCEPTION 'EXTRA_UNAVAILABLE:%', COALESCE(v_extra->>'name', v_extra->>'id');
        END IF;
        IF abs(v_extra_price - COALESCE((v_extra->>'price')::numeric, -1)) > 0.005 THEN
          RAISE EXCEPTION 'PRICE_CHANGED';
        END IF;
        v_line_unit := v_line_unit + v_extra_price;
        v_norm_extras := v_norm_extras || jsonb_build_object(
          'id', v_extra->>'id', 'name', v_extra_name, 'price', v_extra_price);
      END LOOP;
    ELSIF COALESCE((v_line->>'bacon')::boolean, false) THEN
      IF NOT ('bacon' = ANY (v_product.extra_ids)) THEN
        RAISE EXCEPTION 'EXTRA_UNAVAILABLE:Bacon';
      END IF;
      SELECT price, name INTO v_extra_price, v_extra_name FROM public.extras WHERE id = 'bacon';
      v_line_unit := v_line_unit + COALESCE(v_extra_price, 0);
      v_norm_extras := v_norm_extras || jsonb_build_object(
        'id', 'bacon', 'name', COALESCE(v_extra_name, 'Bacon'), 'price', COALESCE(v_extra_price, 0));
    END IF;

    IF jsonb_typeof(COALESCE(v_line->'options', 'null'::jsonb)) = 'array'
       AND jsonb_array_length(v_line->'options') > 0 THEN
      FOR v_option IN SELECT * FROM jsonb_array_elements(v_line->'options') LOOP
        v_option_found := false;
        v_option_delta := 0;
        FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_product.options, '[]'::jsonb)) LOOP
          IF (v_opt->>'id') = (v_option->>'id')
             AND COALESCE((v_opt->>'active')::boolean, true) THEN
            v_option_found := true;
            v_option_delta := COALESCE((v_opt->>'priceDelta')::numeric, 0);
            v_norm_options := v_norm_options || jsonb_build_object(
              'id', v_opt->>'id', 'name', v_opt->>'name', 'priceDelta', v_option_delta);
          END IF;
        END LOOP;
        IF NOT v_option_found THEN
          RAISE EXCEPTION 'OPTION_UNAVAILABLE:%', COALESCE(v_option->>'name', v_option->>'id');
        END IF;
        IF abs(v_option_delta - COALESCE((v_option->>'priceDelta')::numeric, -999)) > 0.005 THEN
          RAISE EXCEPTION 'PRICE_CHANGED';
        END IF;
        v_line_unit := v_line_unit + v_option_delta;
      END LOOP;
    ELSIF jsonb_typeof(COALESCE(v_line->'variant', 'null'::jsonb)) = 'object' THEN
      v_variant := v_line->'variant';
      v_option_found := false;
      v_option_delta := 0;
      FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_product.options, '[]'::jsonb)) LOOP
        IF (v_opt->>'id') = (v_variant->>'id')
           AND COALESCE((v_opt->>'active')::boolean, true) THEN
          v_option_found := true;
          v_option_delta := COALESCE((v_opt->>'priceDelta')::numeric, 0);
          v_norm_options := v_norm_options || jsonb_build_object(
            'id', v_opt->>'id', 'name', v_opt->>'name', 'priceDelta', v_option_delta);
        END IF;
      END LOOP;
      IF NOT v_option_found THEN
        RAISE EXCEPTION 'OPTION_UNAVAILABLE:%', COALESCE(v_variant->>'name', v_variant->>'id');
      END IF;
      IF abs(v_option_delta - COALESCE((v_variant->>'priceDelta')::numeric, -999)) > 0.005 THEN
        RAISE EXCEPTION 'PRICE_CHANGED';
      END IF;
      v_line_unit := v_line_unit + v_option_delta;
    END IF;

    v_calc_total := v_calc_total + v_line_unit * v_qty;

    v_norm_lines := v_norm_lines || jsonb_build_object(
      'lineId', COALESCE(v_line->>'lineId', v_product.id || '-' || jsonb_array_length(v_norm_lines)::text),
      'itemId', v_product.id,
      'name', v_product.name,
      'basePrice', v_product.price,
      'quantity', v_qty,
      'removed', COALESCE(
        CASE WHEN jsonb_typeof(COALESCE(v_line->'removed','null'::jsonb)) = 'array'
             THEN v_line->'removed' END, '[]'::jsonb),
      'bacon', COALESCE((v_line->>'bacon')::boolean, false),
      'extras', v_norm_extras,
      'options', v_norm_options
    );
  END LOOP;

  IF abs(v_calc_total - COALESCE(p_total, -1)) > 0.01 THEN
    RAISE EXCEPTION 'PRICE_CHANGED';
  END IF;

  IF p_pickup_at IS NULL THEN
    RAISE EXCEPTION 'INVALID_PICKUP';
  END IF;
  IF EXTRACT(second FROM p_pickup_at) <> 0
     OR (EXTRACT(minute FROM p_pickup_at)::integer % 5) <> 0 THEN
    RAISE EXCEPTION 'INVALID_PICKUP';
  END IF;
  IF p_pickup_at < now() + make_interval(mins => v_lead) - interval '60 seconds' THEN
    RAISE EXCEPTION 'PICKUP_TOO_SOON';
  END IF;
  IF p_pickup_at > now() + interval '7 days' THEN
    RAISE EXCEPTION 'INVALID_PICKUP';
  END IF;

  v_local   := p_pickup_at AT TIME ZONE 'Europe/Berlin';
  v_weekday := EXTRACT(dow FROM v_local)::integer;
  v_time    := to_char(v_local, 'HH24:MI');

  SELECT * INTO v_hours FROM public.opening_hours WHERE weekday = v_weekday;
  IF NOT FOUND OR v_hours.closed THEN
    RAISE EXCEPTION 'CLOSED';
  END IF;
  IF v_time < v_hours.open_time OR v_time > v_hours.close_time THEN
    RAISE EXCEPTION 'CLOSED';
  END IF;

  RETURN jsonb_build_object('lines', v_norm_lines, 'total', v_calc_total);
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_order_payload(timestamptz, jsonb, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_order_payload(timestamptz, jsonb, numeric) TO service_role;

-- 4) Kapazitaet inkl. offener Reservierungen (atomar via Advisory Lock)
CREATE OR REPLACE FUNCTION public.assert_slot_capacity(p_pickup_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_max integer;
  v_count integer;
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

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'SLOT_FULL';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_slot_capacity(timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.assert_slot_capacity(timestamptz) TO service_role;

-- 5) place_order: nur noch Vor-Ort-Zahlungen, Validierung ausgelagert
CREATE OR REPLACE FUNCTION public.place_order(
  p_reference text, p_customer_name text, p_phone text,
  p_pickup_at timestamptz, p_pickup_label text, p_payment text,
  p_lines jsonb, p_total numeric, p_note text DEFAULT ''::text)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valid jsonb;
  v_row public.orders;
BEGIN
  IF COALESCE(p_payment, '') NOT IN ('Barzahlung bei Abholung', 'Kartenzahlung bei Abholung') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_ALLOWED';
  END IF;

  v_valid := public.validate_order_payload(p_pickup_at, p_lines, p_total);
  PERFORM public.assert_slot_capacity(p_pickup_at);

  INSERT INTO public.orders (reference, customer_name, phone, pickup_at, pickup_label,
                             payment, lines, total, note,
                             payment_provider, payment_status)
  VALUES (p_reference, p_customer_name, p_phone, p_pickup_at, p_pickup_label,
          p_payment, v_valid->'lines', (v_valid->>'total')::numeric, COALESCE(p_note, ''),
          'manual', 'pay_on_pickup')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- 6) Reservierung anlegen (nur Server / Service Role)
CREATE OR REPLACE FUNCTION public.create_payment_reservation(
  p_token text,
  p_reference text,
  p_customer_name text,
  p_phone text,
  p_pickup_at timestamptz,
  p_pickup_label text,
  p_lines jsonb,
  p_total numeric,
  p_note text DEFAULT ''::text,
  p_ttl_minutes integer DEFAULT 20
) RETURNS public.payment_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valid jsonb;
  v_row public.payment_reservations;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 THEN
    RAISE EXCEPTION 'INVALID_TOKEN';
  END IF;

  UPDATE public.payment_reservations
     SET status = 'expired'
   WHERE status = 'pending' AND expires_at <= now();

  v_valid := public.validate_order_payload(p_pickup_at, p_lines, p_total);
  PERFORM public.assert_slot_capacity(p_pickup_at);

  INSERT INTO public.payment_reservations (
    token, reference, customer_name, phone, pickup_at, pickup_label, note,
    lines, total, expires_at)
  VALUES (
    p_token, p_reference, COALESCE(p_customer_name,''), COALESCE(p_phone,''),
    p_pickup_at, COALESCE(p_pickup_label,''), COALESCE(p_note,''),
    v_valid->'lines', (v_valid->>'total')::numeric,
    now() + make_interval(mins => GREATEST(COALESCE(p_ttl_minutes, 20), 5)))
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_payment_reservation(text, text, text, text, timestamptz, text, jsonb, numeric, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.create_payment_reservation(text, text, text, text, timestamptz, text, jsonb, numeric, text, integer) TO service_role;

-- 7) PaymentIntent an Reservierung binden
CREATE OR REPLACE FUNCTION public.attach_payment_intent(
  p_reservation_id uuid, p_payment_intent_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.payment_reservations
     SET stripe_payment_intent_id = p_payment_intent_id
   WHERE id = p_reservation_id AND status = 'pending';
END;
$function$;

REVOKE ALL ON FUNCTION public.attach_payment_intent(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.attach_payment_intent(uuid, text) TO service_role;

-- 8) Reservierung abschliessen: idempotent, genau eine Bestellung
CREATE OR REPLACE FUNCTION public.finalize_payment_reservation(
  p_reservation_id uuid,
  p_payment_intent_id text,
  p_amount_cents integer,
  p_currency text
) RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_res public.payment_reservations;
  v_row public.orders;
BEGIN
  SELECT * INTO v_res FROM public.payment_reservations
   WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND';
  END IF;

  -- Bereits abgeschlossen -> bestehende Bestellung zurueckgeben (Idempotenz)
  IF v_res.status = 'paid' AND v_res.final_order_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.orders WHERE id = v_res.final_order_id;
    RETURN v_row;
  END IF;

  IF v_res.status NOT IN ('pending','failed') THEN
    RAISE EXCEPTION 'RESERVATION_NOT_PAYABLE:%', v_res.status;
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

  -- Falls dieselbe Zahlung schon eine Bestellung erzeugt hat
  SELECT * INTO v_row FROM public.orders
   WHERE stripe_payment_intent_id = p_payment_intent_id;
  IF FOUND THEN
    UPDATE public.payment_reservations
       SET status = 'paid', final_order_id = v_row.id,
           stripe_payment_intent_id = p_payment_intent_id
     WHERE id = v_res.id;
    RETURN v_row;
  END IF;

  INSERT INTO public.orders (reference, customer_name, phone, pickup_at, pickup_label,
                             payment, lines, total, note,
                             payment_provider, payment_status,
                             stripe_payment_intent_id, paid_at)
  VALUES (v_res.reference, v_res.customer_name, v_res.phone, v_res.pickup_at, v_res.pickup_label,
          'Online bezahlt', v_res.lines, v_res.total, v_res.note,
          'stripe', 'paid', p_payment_intent_id, now())
  RETURNING * INTO v_row;

  UPDATE public.payment_reservations
     SET status = 'paid', final_order_id = v_row.id,
         stripe_payment_intent_id = p_payment_intent_id, last_error = NULL
   WHERE id = v_res.id;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_payment_reservation(uuid, text, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.finalize_payment_reservation(uuid, text, integer, text) TO service_role;

-- 9) Reservierung als fehlgeschlagen/storniert markieren
CREATE OR REPLACE FUNCTION public.mark_payment_reservation(
  p_reservation_id uuid, p_status text, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_status NOT IN ('failed','cancelled','expired') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;
  UPDATE public.payment_reservations
     SET status = p_status, last_error = p_error
   WHERE id = p_reservation_id AND status = 'pending';
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_payment_reservation(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_payment_reservation(uuid, text, text) TO service_role;

-- 10) Slot-Auslastung inkl. offener Reservierungen
CREATE OR REPLACE FUNCTION public.get_slot_bookings()
RETURNS TABLE(pickup_at timestamptz, bookings integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.pickup_at, count(*)::integer
  FROM (
    SELECT o.pickup_at
      FROM public.orders o
     WHERE o.pickup_at >= now() - interval '1 hour'
       AND o.pickup_at <= now() + interval '8 days'
       AND o.status NOT IN ('abgelehnt', 'storniert')
    UNION ALL
    SELECT r.pickup_at
      FROM public.payment_reservations r
     WHERE r.pickup_at >= now() - interval '1 hour'
       AND r.pickup_at <= now() + interval '8 days'
       AND r.status = 'pending'
       AND r.expires_at > now()
  ) s
  GROUP BY s.pickup_at;
$function$;