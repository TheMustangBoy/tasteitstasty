CREATE OR REPLACE FUNCTION public.verify_push_hook_secret(p_secret text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $function$
DECLARE
  v_secret text;
BEGIN
  IF p_secret IS NULL OR length(p_secret) = 0 THEN
    RETURN false;
  END IF;
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'push_hook_secret';
  IF v_secret IS NULL THEN
    RETURN false;
  END IF;
  RETURN v_secret = p_secret;
END;
$function$;

REVOKE ALL ON FUNCTION public.verify_push_hook_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_push_hook_secret(text) FROM anon;
REVOKE ALL ON FUNCTION public.verify_push_hook_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_push_hook_secret(text) TO service_role;