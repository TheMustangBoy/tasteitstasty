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
        // Das Gateway liefert die Umgebung als Query-Parameter (?env=sandbox|live).
        const envParam = new URL(request.url).searchParams.get("env");
        const env = readStripeEnv(envParam === "live" ? "live" : envParam === "sandbox" ? "sandbox" : undefined);
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

        // Erstattungen (auch direkt im Stripe-Dashboard ausgeloest) nachziehen.
        const refundEvents = ["charge.refunded", "refund.updated", "refund.created"];
        if (refundEvents.includes(event.type)) {
          const object = event.data.object as { payment_intent?: string | { id: string } | null };
          const pi = object.payment_intent;
          const intentId = typeof pi === "string" ? pi : (pi?.id ?? null);
          if (!intentId) return Response.json({ received: true, ignored: true });

          const stripeClient = createStripeClient(env.secretKey);
          try {
            const paymentIntent = await stripeClient.paymentIntents.retrieve(intentId);
            const refunds = await stripeClient.refunds.list({
              payment_intent: intentId,
              limit: 100,
            });
            // Nur tatsaechlich erfolgreiche Erstattungen zaehlen (kein pending).
            const refunded = refunds.data
              .filter((r) => r.status === "succeeded")
              .reduce((sum, r) => sum + (r.amount ?? 0), 0);
            const charged = paymentIntent.amount_received || paymentIntent.amount || 0;

            // Teilerstattungen bleiben bewusst unberuecksichtigt.
            if (charged > 0 && refunded >= charged) {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              await supabaseAdmin.rpc("mark_refunded_by_payment_intent", {
                p_payment_intent_id: intentId,
              });
              return Response.json({ received: true, refunded: true });
            }
            return Response.json({ received: true, refunded: false });
          } catch {
            console.error("[payments] refund sync failed");
            // 500 => Stripe wiederholt; die Verarbeitung ist idempotent.
            return new Response("Refund sync failed", { status: 500 });
          }
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
          const { error } = await supabaseAdmin.rpc("finalize_payment_reservation", {
            p_reservation_id: reservationId,
            p_payment_intent_id: intent.id,
            p_amount_cents: intent.amount_received || intent.amount,
            p_currency: intent.currency,
          });

          if (!error) return Response.json({ received: true });

          // Slot war nach Ablauf der Reservierung belegt -> Geld zurueckerstatten.
          if ((error.message ?? "").includes("SLOT_FULL_AFTER_EXPIRY")) {
            try {
              const stripe = createStripeClient(env.secretKey);
              await stripe.refunds.create(
                { payment_intent: intent.id, reason: "requested_by_customer" },
                { idempotencyKey: `late-slot-refund-${intent.id}` },
              );
            } catch {
              console.error("[payments] late-slot refund failed");
              // 500 => Stripe wiederholt die Zustellung, Refund ist idempotent.
              return new Response("Refund failed", { status: 500 });
            }
            await supabaseAdmin.rpc("mark_payment_reservation", {
              p_reservation_id: reservationId,
              p_status: "refunded",
              p_error: "slot_full_after_expiry",
            });
            return Response.json({ received: true, refunded: true });
          }

          console.error("[payments] finalize failed");
          // 500 => Stripe wiederholt die Zustellung (Finalisierung ist idempotent).
          return new Response("Finalize failed", { status: 500 });
        }


        if (event.type === "payment_intent.canceled") {
          // Abbruch => Slot wieder freigeben.
          await supabaseAdmin.rpc("mark_payment_reservation", {
            p_reservation_id: reservationId,
            p_status: "cancelled",
            p_error: event.type,
          });
          return Response.json({ received: true });
        }

        // Fehlgeschlagene Zahlung: Reservierung bleibt pending, Slot bleibt belegt,
        // damit ein spaeterer erfolgreicher Versuch nicht ins Leere laeuft.
        await supabaseAdmin.rpc("note_payment_failure", {
          p_reservation_id: reservationId,
          p_error: event.type,
        });
        return Response.json({ received: true });
      },
    },
  },
});
