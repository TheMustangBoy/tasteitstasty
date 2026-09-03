import { createFileRoute } from "@tanstack/react-router";
import { reservationStatusSchema, type CancelReservationResponse } from "@/lib/payments/config";

/**
 * Bricht eine noch offene Reservierung ab und gibt den Abholslot sofort frei.
 * Zugriff nur mit Reservierungs-ID **und** Token. Die PaymentIntent-ID wird
 * ausschliesslich serverseitig aus der Reservierung gelesen.
 * Bereits bezahlte/finalisierte Zahlungen werden niemals abgebrochen.
 */
export const Route = createFileRoute("/api/public/payments/cancel")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { rateLimit, clientKey } = await import("@/lib/payments/rate-limit.server");
        if (!rateLimit(`cancel:${clientKey(request)}`, 60)) {
          return Response.json({ error: "Zu viele Anfragen." }, { status: 429 });
        }

        const parsed = reservationStatusSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: reservation, error } = await supabaseAdmin
          .from("payment_reservations")
          .select("id, status, stripe_payment_intent_id")
          .eq("id", parsed.data.reservationId)
          .eq("token", parsed.data.token)
          .maybeSingle();

        if (error) return Response.json({ error: "Abbruch nicht möglich." }, { status: 500 });
        if (!reservation) return Response.json({ error: "Nicht gefunden." }, { status: 404 });

        const respond = (status: CancelReservationResponse["status"], cancelled: boolean) =>
          Response.json({ status, cancelled } satisfies CancelReservationResponse, {
            headers: { "cache-control": "no-store" },
          });

        // Terminale Zustaende bleiben unangetastet (kein Race Payment-vs-Cancel).
        if (reservation.status !== "pending") {
          return respond(reservation.status as CancelReservationResponse["status"], false);
        }

        const intentId = reservation.stripe_payment_intent_id;
        if (!intentId) {
          await supabaseAdmin.rpc("mark_payment_reservation", {
            p_reservation_id: reservation.id,
            p_status: "cancelled",
            p_error: "cancelled_by_customer",
          });
          return respond("cancelled", true);
        }

        const { readStripeEnv, createStripeClient } = await import("@/lib/payments/stripe.server");
        const env = readStripeEnv();
        if (!env.configured || !env.secretKey) {
          return Response.json({ error: "Zahlungsdienst nicht verfügbar." }, { status: 503 });
        }

        const CANCELLABLE = [
          "requires_payment_method",
          "requires_confirmation",
          "requires_action",
          "requires_capture",
        ];

        try {
          const stripe = createStripeClient(env.secretKey);
          const intent = await stripe.paymentIntents.retrieve(intentId);

          if (intent.status === "succeeded" || intent.status === "processing") {
            // Zahlung laeuft bereits – der Webhook finalisiert sie.
            return respond("pending", false);
          }
          if (intent.status !== "canceled" && !CANCELLABLE.includes(intent.status)) {
            return respond("pending", false);
          }
          if (intent.status !== "canceled") {
            await stripe.paymentIntents.cancel(intentId, undefined, {
              idempotencyKey: `cancel-${reservation.id}-${intentId}`,
            });
          }
        } catch {
          console.error("[payments] cancel failed");
          return Response.json(
            { error: "Die Zahlung konnte nicht abgebrochen werden." },
            { status: 502 },
          );
        }

        await supabaseAdmin.rpc("mark_payment_reservation", {
          p_reservation_id: reservation.id,
          p_status: "cancelled",
          p_error: "cancelled_by_customer",
        });
        return respond("cancelled", true);
      },
    },
  },
});
