ALTER TABLE public.products ADD COLUMN IF NOT EXISTS home_featured boolean NOT NULL DEFAULT false;

UPDATE public.products
   SET home_featured = true
 WHERE id IN ('smash-burger','tripple-smash','trueffel-smash')
   AND home_featured = false
   AND NOT EXISTS (SELECT 1 FROM public.products p2 WHERE p2.home_featured);

CREATE OR REPLACE FUNCTION public.assert_home_featured_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF COALESCE(NEW.home_featured, false) THEN
    SELECT count(*) INTO v_count
      FROM public.products
     WHERE home_featured AND id <> NEW.id;
    IF v_count >= 3 THEN
      RAISE EXCEPTION 'HOME_FEATURED_LIMIT';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_home_featured_limit ON public.products;
CREATE TRIGGER products_home_featured_limit
BEFORE INSERT OR UPDATE OF home_featured ON public.products
FOR EACH ROW EXECUTE FUNCTION public.assert_home_featured_limit();