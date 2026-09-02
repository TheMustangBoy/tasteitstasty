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

  -- Online bezahlte Bestellungen duerfen nur zusammen mit der Erstattung
  -- storniert oder abgelehnt werden (kein Bypass des Refundpfads).
  IF OLD.payment_provider = 'stripe'
     AND OLD.payment_status = 'paid'
     AND NEW.status IN ('storniert', 'abgelehnt')
     AND COALESCE(NEW.payment_status, '') <> 'refunded' THEN
    RAISE EXCEPTION 'REFUND_REQUIRED';
  END IF;

  RETURN NEW;
END;
$$;