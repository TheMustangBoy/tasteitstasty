/**
 * Serverseitige Admin-Rückerstattung.
 *
 * Sicherheit:
 * - `requireSupabaseAuth` erzwingt ein gültiges Supabase-Bearer-Token.
 * - Zusätzlich wird `is_admin()` mit der Nutzer-Session (RLS) geprüft.
 * - Der PaymentIntent wird ausschließlich serverseitig aus `public.orders`
 *   gelesen – niemals aus Clientwerten.
 * - Stripe-Secrets bleiben serverseitig (Lovable-Gateway).
 *
 * Idempotenz:
 * - Vor dem Refund werden vorhandene Stripe-Refunds summiert; ist bereits
 *   vollständig erstattet, gilt der Vorgang als Erfolg.
 * - `stripe.refunds.create` nutzt den stabilen Idempotency-Key
 *   `admin-refund-<orderId>-<paymentIntentId>`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const refundOrderSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["storniert", "abgelehnt"]),
  cancelReason: z.string().max(40).nullable().optional(),
  cancelNote: z.string().max(500).nullable().optional(),
});

export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

export type RefundOrderResult =
  | { ok: true; refunded: boolean; status: "storniert" | "abgelehnt" }
  | { ok: false; error: string };

function stripeErrorMessage(error: unknown): string {
  const e = error as { code?: string; raw?: { code?: string; message?: string }; message?: string };
  const code = e?.raw?.code ?? e?.code;
  if (code === "charge_already_refunded") return "";
  return (
    e?.raw?.message ??
    e?.message ??
    "Die Rückerstattung konnte bei Stripe nicht ausgeführt werden."
  );
}

export const refundAndCloseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => refundOrderSchema.parse(input))
  .handler(async ({ data, context }): Promise<RefundOrderResult> => {
    const { data: isAdmin, error: adminError } = await context.supabase.rpc("is_admin");
    if (adminError || isAdmin !== true) {
      return { ok: false, error: "Kein Admin-Zugriff für diese Aktion." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, reference, status, total, payment_provider, payment_status, stripe_payment_intent_id, status_timestamps",
      )
      .eq("id", data.orderId)
      .maybeSingle();

    if (orderError || !order) return { ok: false, error: "Bestellung wurde nicht gefunden." };

    const needsRefund =
      order.payment_provider === "stripe" && order.payment_status === "paid";

    if (needsRefund) {
      const paymentIntentId = order.stripe_payment_intent_id;
      if (!paymentIntentId) {
        return {
          ok: false,
          error:
            "Zu dieser Onlinezahlung ist keine Stripe-Zahlung hinterlegt. Bitte manuell in Stripe prüfen.",
        };
      }

      const { readStripeEnv, createStripeClient } = await import("@/lib/payments/stripe.server");
      const env = readStripeEnv();
      if (!env.configured || !env.secretKey) {
        return { ok: false, error: env.reason ?? "Zahlungsverbindung ist nicht aktiv." };
      }
      const stripe = createStripeClient(env.secretKey);

      try {
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        const amount = intent.amount_received || intent.amount;
        const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 20 });
        const alreadyRefunded = refunds.data
          .filter((r) => r.status !== "failed" && r.status !== "canceled")
          .reduce((sum, r) => sum + (r.amount ?? 0), 0);

        if (alreadyRefunded < amount) {
          await stripe.refunds.create(
            {
              payment_intent: paymentIntentId,
              reason: "requested_by_customer",
              metadata: { order_id: order.id, order_reference: order.reference },
            },
            { idempotencyKey: `admin-refund-${order.id}-${paymentIntentId}` },
          );
        }
      } catch (error) {
        const message = stripeErrorMessage(error);
        // Leerer String = Stripe meldet "bereits vollständig erstattet" -> Erfolg.
        if (message) {
          console.error("[payments] admin refund failed");
          return { ok: false, error: message };
        }
      }

      // Reservierung best-effort nachziehen (blockiert den Vorgang nicht).
      const { data: reservation } = await supabaseAdmin
        .from("payment_reservations")
        .select("id")
        .eq("final_order_id", order.id)
        .maybeSingle();
      if (reservation?.id) {
        await supabaseAdmin.rpc("mark_payment_reservation", {
          p_reservation_id: reservation.id,
          p_status: "refunded",
          p_error: "admin_refund",
        });
      }
    }

    const timestamps = {
      ...((order.status_timestamps as Record<string, string> | null) ?? {}),
      cancelledAt: new Date().toISOString(),
    };

    const update: Record<string, unknown> = {
      status: data.status,
      status_timestamps: timestamps,
      cancel_reason: data.cancelReason ?? null,
      cancel_note: data.cancelNote ?? null,
    };
    if (needsRefund || order.payment_status === "refunded") {
      update["payment_status"] = "refunded";
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update(update as never)
      .eq("id", order.id);

    if (updateError) {
      return {
        ok: false,
        error: needsRefund
          ? "Die Rückerstattung wurde ausgelöst, der Status konnte aber nicht gespeichert werden. Bitte Seite neu laden."
          : "Der Status konnte nicht gespeichert werden.",
      };
    }

    return { ok: true, refunded: needsRefund, status: data.status };
  });
