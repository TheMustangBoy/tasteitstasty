CREATE OR REPLACE FUNCTION public.place_order(
  p_reference text,
  p_customer_name text,
  p_phone text,
  p_pickup_at timestamp with time zone,
  p_pickup_label text,
  p_payment text,
  p_lines jsonb,
  p_total numeric,
  p_note text DEFAULT ''::text
)
RETURNS orders
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_max integer;
  v_lead integer;
  v_paused boolean;
  v_count integer;
  v_row public.orders;
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
  v_option_delta numeric;
  v_option_found boolean;
  v_opt jsonb;
BEGIN
  SELECT max_orders_per_slot, min_lead_minutes, orders_paused
    INTO v_max, v_lead, v_paused
    FROM public.shop_settings WHERE id = 1;
  v_max  := COALESCE(v_max, 4);
  v_lead := COALESCE(v_lead, 15);

  IF COALESCE(v_paused, false) THEN
    RAISE EXCEPTION 'ORDERS_PAUSED';
  END IF;

  ------------------------------------------------------------------ Positionen
  IF p_lines IS NULL
     OR jsonb_typeof(p_lines) <> 'array'
     OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO v_product FROM public.products
      WHERE id = (v_line->>'itemId');
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

    v_line_unit := v_product.price;

    -- Extras: müssen zum Produkt gehören und den hinterlegten Preis tragen
    IF jsonb_typeof(COALESCE(v_line->'extras', 'null'::jsonb)) = 'array' THEN
      FOR v_extra IN SELECT * FROM jsonb_array_elements(v_line->'extras') LOOP
        IF NOT ((v_extra->>'id') = ANY (v_product.extra_ids)) THEN
          RAISE EXCEPTION 'EXTRA_UNAVAILABLE:%', COALESCE(v_extra->>'name', v_extra->>'id');
        END IF;
        SELECT price INTO v_extra_price FROM public.extras WHERE id = (v_extra->>'id');
        IF NOT FOUND THEN
          RAISE EXCEPTION 'EXTRA_UNAVAILABLE:%', COALESCE(v_extra->>'name', v_extra->>'id');
        END IF;
        IF abs(v_extra_price - COALESCE((v_extra->>'price')::numeric, -1)) > 0.005 THEN
          RAISE EXCEPTION 'PRICE_CHANGED';
        END IF;
        v_line_unit := v_line_unit + v_extra_price;
      END LOOP;
    ELSIF COALESCE((v_line->>'bacon')::boolean, false) THEN
      -- Legacy-Zeilen ohne Extras-Liste
      IF NOT ('bacon' = ANY (v_product.extra_ids)) THEN
        RAISE EXCEPTION 'EXTRA_UNAVAILABLE:Bacon';
      END IF;
      SELECT price INTO v_extra_price FROM public.extras WHERE id = 'bacon';
      v_line_unit := v_line_unit + COALESCE(v_extra_price, 0);
    END IF;

    -- Auswahl-Optionen: müssen im Produkt hinterlegt, aktiv und preisgleich sein
    IF jsonb_typeof(COALESCE(v_line->'options', 'null'::jsonb)) = 'array' THEN
      FOR v_option IN SELECT * FROM jsonb_array_elements(v_line->'options') LOOP
        v_option_found := false;
        v_option_delta := 0;
        FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_product.options, '[]'::jsonb)) LOOP
          IF (v_opt->>'id') = (v_option->>'id')
             AND COALESCE((v_opt->>'active')::boolean, true) THEN
            v_option_found := true;
            v_option_delta := COALESCE((v_opt->>'priceDelta')::numeric, 0);
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
    END IF;

    v_calc_total := v_calc_total + v_line_unit * v_qty;
  END LOOP;

  IF abs(v_calc_total - COALESCE(p_total, -1)) > 0.01 THEN
    RAISE EXCEPTION 'PRICE_CHANGED';
  END IF;

  ------------------------------------------------------------------ Abholzeit
  IF p_pickup_at IS NULL THEN
    RAISE EXCEPTION 'INVALID_PICKUP';
  END IF;

  IF EXTRACT(second FROM p_pickup_at) <> 0
     OR (EXTRACT(minute FROM p_pickup_at)::integer % 5) <> 0 THEN
    RAISE EXCEPTION 'INVALID_PICKUP';
  END IF;

  -- 60 s Toleranz für Laufzeit zwischen Auswahl und Absenden
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

  ------------------------------------------------- Kapazität (atomar, zuletzt)
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
          p_payment, p_lines, v_calc_total, COALESCE(p_note, ''))
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;