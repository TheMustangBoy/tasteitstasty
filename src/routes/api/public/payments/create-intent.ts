import { createFileRoute } from "@tanstack/react-router";
import { createIntentSchema, type CreateIntentResponse } from "@/lib/payments/config";

/** Kryptografisch sicheres Reservierungstoken (64 Hex-Zeichen). */
function createToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Legt eine Reservierung an (Validierung + Slot-Kapazität in der Datenbank)
 * und erzeugt dazu einen Stripe-PaymentIntent im Testmodus.
 * Es entsteht KEINE Bestellung – die entsteht erst über den Webhook.
 */
export const Route = createFileRoute("/api/public/payments/create-intent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { readStripeEnv, createStripeClient } = await import("@/lib/payments/stripe.server");
        const { rateLimit, clientKey } = await import("@/lib/payments/rate-limit.server");

        if (!rateLimit(`intent:${clientKey(request)}`)) {
          return Response.json({ error: "Zu viele Versuche. Bitte kurz warten." }, { status: 429 });
        }

        const env = readStripeEnv();
        if (!env.configured || !env.secretKey) {
          return Response.json(
            { error: env.reason ?? "Online-Zahlung ist nicht verfügbar.", configured: false },
            { status: 503 },
          );
        }

        const parsed = createIntentSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Ungültige Bestelldaten." }, { status: 400 });
        }
        const input = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const token = createToken();

        const { data: reservation, error } = await supabaseAdmin
          .rpc("create_payment_reservation", {
            p_token: token,
            p_reference: input.reference,
            p_customer_name: input.name,
            p_phone: input.phone,
            p_pickup_at: input.pickupISO,
            p_pickup_label: input.pickupLabel,
            p_lines: input.lines as unknown as never,
            p_total: input.total,
            p_note: input.note,
            p_ttl_minutes: 20,
          })
          .maybeSingle();

        if (error || !reservation) {
          const { orderErrorMessage } = await import("@/lib/payments/errors");
          return Response.json(
            { error: orderErrorMessage(error?.message ?? "") },
            { status: 409 },
          );
        }

        try {
          const stripe = createStripeClient(env.secretKey);
          const intent = await stripe.paymentIntents.create(
            {
              amount: Math.round(Number(reservation.total) * 100),
              currency: reservation.currency,
              automatic_payment_methods: { enabled: true },
              // Bewusst keine personenbezogenen Daten in den Metadaten.
              metadata: {
                reservation_id: reservation.id,
                reference: reservation.reference,
              },
            },
            { idempotencyKey: `reservation-${reservation.id}` },
          );

          if (!intent.client_secret) throw new Error("missing client secret");

          await supabaseAdmin.rpc("attach_payment_intent", {
            p_reservation_id: reservation.id,
            p_payment_intent_id: intent.id,
          });

          const body: CreateIntentResponse = {
            clientSecret: intent.client_secret,
            reservationId: reservation.id,
            token,
            reference: reservation.reference,
          };
          return Response.json(body, { headers: { "cache-control": "no-store" } });
        } catch {
          console.error("[payments] payment intent creation failed");
          await supabaseAdmin.rpc("mark_payment_reservation", {
            p_reservation_id: reservation.id,
            p_status: "failed",
            p_error: "intent_creation_failed",
          });
          return Response.json(
            { error: "Die Zahlung konnte nicht gestartet werden. Bitte erneut versuchen." },
            { status: 502 },
          );
        }
      },
    },
  },
});
