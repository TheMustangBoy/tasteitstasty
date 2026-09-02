import { createFileRoute } from "@tanstack/react-router";
import { Route as StripeWebhookRoute } from "./stripe-webhook";

/**
 * Alias-Route für die Lovable Payments Sandbox-Webhook-Registrierung.
 * Leitet alle Anfragen an den bestehenden Stripe-Webhook-Handler weiter.
 */
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: StripeWebhookRoute.options.server as any,
});
