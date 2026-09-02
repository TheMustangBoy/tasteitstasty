CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push subs owner select" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.is_admin());
CREATE POLICY "push subs owner insert" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_admin());
CREATE POLICY "push subs owner update" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid() AND public.is_admin())
  WITH CHECK (user_id = auth.uid() AND public.is_admin());
CREATE POLICY "push subs owner delete" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid() AND public.is_admin());

CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_url text := 'https://project--51aad688-c61e-4794-b37f-764fc1d332ba-dev.lovable.app/api/public/order-push';
  v_secret text := 'h-3Hlw-d8O1hh8YMzJN18bqtO_OTARjYvtvNPqgz47U';
BEGIN
  BEGIN
    PERFORM extensions.net.http_post(
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
      timeout_milliseconds := 3000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push dispatch failed';
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_new_order() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER orders_notify_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();