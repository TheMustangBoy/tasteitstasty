import { createFileRoute } from "@tanstack/react-router";
import type { PaymentConfig } from "@/lib/payments/config";

/**
 * Liefert dem Checkout, ob Online-Zahlung verfügbar ist.
 * Es wird ausschließlich der öffentliche Test-Key übertragen.
 */
export const Route = createFileRoute("/api/public/payments/config")({
  server: {
    handlers: {
      GET: async () => {
        const { readStripeEnv } = await import("@/lib/payments/stripe.server");
        const env = readStripeEnv();
        const body: PaymentConfig = {
          configured: env.configured,
          publishableKey: env.publishableKey,
          reason: env.reason,
        };
        return Response.json(body, {
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
