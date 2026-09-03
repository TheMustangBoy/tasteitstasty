ALTER TABLE public.shop_settings ADD COLUMN IF NOT EXISTS emergency_closed_date date;

CREATE OR REPLACE FUNCTION public.set_emergency_closure(p_closed boolean)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_date date;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  v_date := CASE WHEN COALESCE(p_closed, false)
                 THEN (now() AT TIME ZONE 'Europe/Berlin')::date
                 ELSE NULL END;
  UPDATE public.shop_settings SET emergency_closed_date = v_date WHERE id = 1;
  RETURN v_date;
END;
$$;

REVOKE ALL ON FUNCTION public.set_emergency_closure(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_emergency_closure(boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_order_payload(p_pickup_at timestamp with time zone, p_lines jsonb, p_total numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead integer;
  v_paused boolean;
  v_emergency date;
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
  SELECT min_lead_minutes, orders_paused, emergency_closed_date
    INTO v_lead, v_paused, v_emergency
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

  -- Notfall-Schließung: nur der markierte Tag (Europe/Berlin) ist gesperrt.
  IF v_emergency IS NOT NULL AND v_local::date = v_emergency THEN
    RAISE EXCEPTION 'DAY_CLOSED';
  END IF;

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