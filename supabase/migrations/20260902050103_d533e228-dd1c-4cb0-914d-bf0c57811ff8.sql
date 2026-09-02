REVOKE ALL ON TABLE public.push_subscriptions FROM anon;
REVOKE ALL ON TABLE public.push_subscriptions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;

CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault', 'net', 'extensions'
AS $function$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'push_hook_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'push_hook_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE WARNING 'push hook not configured';
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', v_secret
      ),
      body := jsonb_build_object(
        'reference', NEW.reference,
        'pickup_label', NEW.pickup_label,
        'pickup_at', NEW.pickup_at,
        'total', NEW.total
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push dispatch failed';
  END;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_new_order() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_new_order() FROM anon;
REVOKE ALL ON FUNCTION public.notify_new_order() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.notify_new_order() TO service_role;