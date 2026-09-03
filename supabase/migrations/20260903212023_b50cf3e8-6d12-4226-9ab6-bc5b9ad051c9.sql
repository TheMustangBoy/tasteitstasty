CREATE OR REPLACE FUNCTION public.rename_ingredient(p_id text, p_old_name text, p_new_name text, p_sort_order integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_current text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_id IS NULL OR btrim(p_id) = ''
     OR p_old_name IS NULL OR btrim(p_old_name) = ''
     OR p_new_name IS NULL OR btrim(p_new_name) = '' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  SELECT name INTO v_current FROM public.ingredients WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ingredient_not_found';
  END IF;
  IF v_current <> p_old_name THEN
    RAISE EXCEPTION 'ingredient_stale';
  END IF;

  IF EXISTS (SELECT 1 FROM public.ingredients WHERE name = p_new_name AND id <> p_id) THEN
    RAISE EXCEPTION 'ingredient_name_conflict';
  END IF;

  UPDATE public.ingredients
     SET name = p_new_name,
         sort_order = COALESCE(p_sort_order, sort_order),
         updated_at = now()
   WHERE id = p_id;

  IF p_old_name <> p_new_name THEN
    WITH updated AS (
      UPDATE public.products p
      SET ingredients = (
            SELECT COALESCE(array_agg(v ORDER BY ord), '{}'::text[]) FROM (
              SELECT DISTINCT ON (v) v, ord FROM (
                SELECT CASE WHEN x = p_old_name THEN p_new_name ELSE x END AS v, o AS ord
                FROM unnest(p.ingredients) WITH ORDINALITY AS t(x, o)
              ) s ORDER BY v, ord
            ) d
          ),
          removable = (
            SELECT COALESCE(array_agg(v ORDER BY ord), '{}'::text[]) FROM (
              SELECT DISTINCT ON (v) v, ord FROM (
                SELECT CASE WHEN x = p_old_name THEN p_new_name ELSE x END AS v, o AS ord
                FROM unnest(p.removable) WITH ORDINALITY AS t(x, o)
              ) s ORDER BY v, ord
            ) d
          ),
          updated_at = now()
      WHERE p.ingredients @> ARRAY[p_old_name]::text[] OR p.removable @> ARRAY[p_old_name]::text[]
      RETURNING 1
    )
    SELECT count(*) INTO v_count FROM updated;
  END IF;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_ingredient(p_id text, p_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_current text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_id IS NULL OR btrim(p_id) = '' OR p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  SELECT name INTO v_current FROM public.ingredients WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ingredient_not_found';
  END IF;
  IF v_current <> p_name THEN
    RAISE EXCEPTION 'ingredient_stale';
  END IF;

  WITH updated AS (
    UPDATE public.products p
    SET ingredients = ARRAY(SELECT x FROM unnest(p.ingredients) AS x WHERE x <> p_name),
        removable   = ARRAY(SELECT x FROM unnest(p.removable)   AS x WHERE x <> p_name),
        updated_at  = now()
    WHERE p.ingredients @> ARRAY[p_name]::text[] OR p.removable @> ARRAY[p_name]::text[]
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;

  DELETE FROM public.ingredients WHERE id = p_id;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.rename_ingredient(text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_ingredient(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_ingredient(text, text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_ingredient(text, text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rename_ingredient_refs(text, text);
DROP FUNCTION IF EXISTS public.delete_ingredient_refs(text);