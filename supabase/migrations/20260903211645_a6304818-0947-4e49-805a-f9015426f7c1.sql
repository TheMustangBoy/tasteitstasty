-- 1) Datenbereinigung: 'Gurke' und 'Salatgurke' aus Burger-Arrays entfernen
UPDATE public.products
SET ingredients = ARRAY(SELECT x FROM unnest(ingredients) AS x WHERE x NOT IN ('Gurke','Salatgurke')),
    removable   = ARRAY(SELECT x FROM unnest(removable)   AS x WHERE x NOT IN ('Gurke','Salatgurke')),
    updated_at  = now()
WHERE category_id = 'burger'
  AND (ingredients && ARRAY['Gurke','Salatgurke']::text[] OR removable && ARRAY['Gurke','Salatgurke']::text[]);

-- 2) Rename-Synchronisation (exakte Treffer, dedupliziert, Reihenfolge bleibt erhalten)
CREATE OR REPLACE FUNCTION public.rename_ingredient_refs(p_old_name text, p_new_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_old_name IS NULL OR p_new_name IS NULL OR btrim(p_old_name) = '' OR btrim(p_new_name) = '' THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;
  IF p_old_name = p_new_name THEN
    RETURN 0;
  END IF;

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

  RETURN v_count;
END;
$$;

-- 3) Delete-Synchronisation
CREATE OR REPLACE FUNCTION public.delete_ingredient_refs(p_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'invalid_name';
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

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_ingredient_refs(text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.delete_ingredient_refs(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rename_ingredient_refs(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_ingredient_refs(text) TO authenticated, service_role;