CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net', 'extensions'
AS $$
DECLARE
  v_url text := 'https://project--51aad688-c61e-4794-b37f-764fc1d332ba-dev.lovable.app/api/public/order-push';
  v_secret text := 'h-3Hlw-d8O1hh8YMzJN18bqtO_OTARjYvtvNPqgz47U';
BEGIN
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
$$;

REVOKE ALL ON FUNCTION public.notify_new_order() FROM PUBLIC, anon, authenticated;