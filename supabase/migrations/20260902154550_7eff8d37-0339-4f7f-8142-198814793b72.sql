CREATE OR REPLACE FUNCTION public.guard_order_refund_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.payment_status = 'refunded' THEN
    IF NEW.payment_status = 'paid' THEN
      RAISE EXCEPTION 'REFUND_IMMUTABLE';
    END IF;
    IF NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id THEN
      RAISE EXCEPTION 'REFUND_IMMUTABLE';
    END IF;
    IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
      RAISE EXCEPTION 'REFUND_IMMUTABLE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_guard_refund ON public.orders;
CREATE TRIGGER orders_guard_refund
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_refund_immutability();

REVOKE ALL ON FUNCTION public.guard_order_refund_immutability() FROM PUBLIC, anon, authenticated;