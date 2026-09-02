import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe-Webhook: einzige Stelle, an der aus einer bezahlten Reservierung
 * eine echte Bestellung in `public.orders` entsteht.
 * Ohne gültige Signatur wird jede Anfrage abgelehnt.
 */
export const Route = createFileRoute("/api/public/payments/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { readStripeEnv, createStripeClient, Stripe } = await import(
          "@/lib/payments/stripe.server"
        );
        const env = readStripeEnv();
        if (!env.configured || !env.secretKey || !env.webhookSecret) {
          return new Response("Not configured", { status: 503 });
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });

        const raw = await request.text();
        const stripe = createStripeClient(env.secretKey);

        let event: import("stripe").Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(
            raw,
            signature,
            env.webhookSecret,
            undefined,
            Stripe.createSubtleCryptoProvider(),
          );
        } catch {
          console.error("[payments] webhook signature verification failed");
          return new Response("Invalid signature", { status: 400 });
        }

        const relevant = [
          "payment_intent.succeeded",
          "payment_intent.payment_failed",
          "payment_intent.canceled",
        ];
        if (!relevant.includes(event.type)) return Response.json({ received: true });

        const intent = event.data.object as import("stripe").Stripe.PaymentIntent;
        const reservationId = intent.metadata?.["reservation_id"];
        if (!reservationId) {
          console.error("[payments] webhook without reservation metadata");
          return Response.json({ received: true, ignored: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (event.type === "payment_intent.succeeded") {
          const { error } = await supabaseAdmin
            .rpc("finalize_payment_reservation", {
              p_reservation_id: reservationId,
              p_payment_intent_id: intent.id,
              p_amount_cents: intent.amount_received || intent.amount,
              p_currency: intent.currency,
            })
            .maybeSingle();

          if (error) {
            console.error("[payments] finalize failed");
            // 500 => Stripe wiederholt die Zustellung (Finalisierung ist idempotent).
            return new Response("Finalize failed", { status: 500 });
          }
          return Response.json({ received: true });
        }

        await supabaseAdmin.rpc("mark_payment_reservation", {
          p_reservation_id: reservationId,
          p_status: event.type === "payment_intent.canceled" ? "cancelled" : "failed",
          p_error: event.type,
        });
        return Response.json({ received: true });
      },
    },
  },
});
