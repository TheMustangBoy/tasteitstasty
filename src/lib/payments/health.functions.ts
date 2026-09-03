/**
 * Admin-Health-Check „Stripe ↔ Shop“.
 *
 * Sicherheit:
 * - `requireSupabaseAuth` erzwingt ein gültiges Supabase-Bearer-Token.
 * - Zusätzlich wird `is_admin()` mit der Nutzer-Session (RLS) geprüft.
 * - Stripe-Secrets bleiben serverseitig (Lovable-Gateway).
 *
 * Verhalten:
 * - Der Check ist **rein lesend**: keine Schreibzugriffe auf Stripe oder die
 *   Datenbank, keine Erstattungen, keine Statusänderungen.
 * - Ergebnis enthält keine Kundendaten (keine Namen, Telefonnummern, Adressen).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Prüfzeitraum und Mengenlimits, damit der Check kalkulierbar bleibt. */
export const HEALTH_PERIOD_DAYS = 30;
export const HEALTH_MAX_RECORDS = 150;
const STRIPE_CONCURRENCY = 5;

export type HealthSeverity = "critical" | "warning";

export type HealthIssue = {
  severity: HealthSeverity;
  /** Bestellnummer bzw. `Reservierung <kurz-id>` – keine Kundendaten. */
  reference: string;
  code: string;
  text: string;
  dbStatus: string | null;
  stripeStatus: string | null;
  /** Gekürzte PaymentIntent-ID, z. B. `pi_…A1b2`. */
  paymentIntent: string | null;
};

export type HealthReport = {
  ok: boolean;
  environment: "sandbox" | "live";
  checkedAt: string;
  periodStart: string;
  ordersChecked: number;
  reservationsChecked: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  issues: HealthIssue[];
};

export type HealthResult = { ok: true; report: HealthReport } | { ok: false; error: string };

/** PaymentIntent-ID kürzen – nie vollständig an den Client geben. */
function shortIntent(id: string | null | undefined): string | null {
  if (!id) return null;
  return `${id.slice(0, 3)}…${id.slice(-4)}`;
}

function toCents(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100);
}

/** Stripe-Aufrufe mit begrenzter Parallelität. */
async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

export const runPaymentsHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HealthResult> => {
    const { data: isAdmin, error: adminError } = await context.supabase.rpc("is_admin");
    if (adminError || isAdmin !== true) {
      return { ok: false, error: "Kein Admin-Zugriff für diese Aktion." };
    }

    const { readStripeEnv, createStripeClient } = await import("@/lib/payments/stripe.server");
    const env = readStripeEnv();
    if (!env.configured || !env.secretKey) {
      return { ok: false, error: env.reason ?? "Zahlungsverbindung ist nicht aktiv." };
    }
    const stripe = createStripeClient(env.secretKey);

    const periodStartDate = new Date(Date.now() - HEALTH_PERIOD_DAYS * 86_400_000);
    const periodStartIso = periodStartDate.toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [ordersRes, reservationsRes] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, reference, status, total, payment_status, stripe_payment_intent_id")
        .eq("payment_provider", "stripe")
        .gte("created_at", periodStartIso)
        .order("created_at", { ascending: false })
        .limit(HEALTH_MAX_RECORDS),
      supabaseAdmin
        .from("payment_reservations")
        .select("id, reference, status, total, currency, stripe_payment_intent_id, final_order_id")
        .not("stripe_payment_intent_id", "is", null)
        .gte("created_at", periodStartIso)
        .order("created_at", { ascending: false })
        .limit(HEALTH_MAX_RECORDS),
    ]);

    if (ordersRes.error || reservationsRes.error) {
      return { ok: false, error: "Die Bestelldaten konnten nicht gelesen werden." };
    }

    const orders = ordersRes.data ?? [];
    const reservations = reservationsRes.data ?? [];
    const issues: HealthIssue[] = [];
    const flagged = new Set<string>();

    const add = (issue: HealthIssue) => {
      issues.push(issue);
      flagged.add(issue.reference);
    };

    /** Stripe-Zustand eines PaymentIntents (rein lesend). */
    const loadIntent = async (paymentIntentId: string) => {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 20 });
      const refunded = refunds.data
        .filter((r) => r.status === "succeeded")
        .reduce((sum, r) => sum + (r.amount ?? 0), 0);
      return {
        status: intent.status,
        amount: intent.amount_received || intent.amount,
        currency: (intent.currency ?? "").toLowerCase(),
        refunded,
      };
    };

    try {
      /* ------------------------------------------------------- Bestellungen */
      const withIntent = orders.filter((o) => o.stripe_payment_intent_id);
      for (const order of orders) {
        if (!order.stripe_payment_intent_id) {
          add({
            severity: "critical",
            reference: order.reference,
            code: "missing_stripe_intent",
            text: "Onlinezahlung ohne hinterlegte Stripe-Zahlung.",
            dbStatus: order.payment_status,
            stripeStatus: null,
            paymentIntent: null,
          });
        }
      }

      const intentStates = await mapLimited(withIntent, STRIPE_CONCURRENCY, async (order) => ({
        order,
        state: await loadIntent(order.stripe_payment_intent_id as string),
      }));

      for (const { order, state } of intentStates) {
        const short = shortIntent(order.stripe_payment_intent_id);
        const base = {
          reference: order.reference,
          dbStatus: order.payment_status,
          stripeStatus: state.status,
          paymentIntent: short,
        };
        const paid = order.payment_status === "paid";
        const refundedDb = order.payment_status === "refunded";
        const fullyRefunded = state.amount > 0 && state.refunded >= state.amount;

        if (paid && state.status !== "succeeded") {
          add({
            ...base,
            severity: "critical",
            code: "db_paid_stripe_unpaid",
            text: "Bestellung gilt als bezahlt, Stripe meldet keinen erfolgreichen Zahlungseingang.",
          });
        }
        if (state.status === "succeeded" && !paid && !refundedDb) {
          add({
            ...base,
            severity: "critical",
            code: "stripe_paid_db_unpaid",
            text: "Stripe-Zahlung erfolgreich, Bestellung ist im Shop nicht als bezahlt markiert.",
          });
        }
        if (state.status === "succeeded" && toCents(order.total) !== state.amount) {
          add({
            ...base,
            severity: "critical",
            code: "amount_mismatch",
            text: "Betrag der Bestellung weicht vom Stripe-Betrag ab.",
          });
        }
        if (state.currency && state.currency !== "eur") {
          add({
            ...base,
            severity: "critical",
            code: "currency_mismatch",
            text: `Stripe-Währung ist „${state.currency}“ statt EUR.`,
          });
        }
        if (refundedDb && !fullyRefunded) {
          add({
            ...base,
            severity: "critical",
            code: "db_refunded_stripe_not",
            text: "Shop meldet Erstattung, Stripe zeigt keine vollständige Rückzahlung.",
          });
        }
        if (fullyRefunded && !refundedDb) {
          add({
            ...base,
            severity: "critical",
            code: "stripe_refunded_db_not",
            text: "Stripe ist vollständig erstattet, im Shop fehlt der Erstattungsstatus.",
          });
        }
      }

      /* ---------------------------------------------------- Reservierungen */
      const orderById = new Map(orders.map((o) => [o.id, o]));
      const reservationStates = await mapLimited(
        reservations,
        STRIPE_CONCURRENCY,
        async (reservation) => ({
          reservation,
          state: await loadIntent(reservation.stripe_payment_intent_id as string),
        }),
      );

      for (const { reservation, state } of reservationStates) {
        if (state.status !== "succeeded") continue;
        const short = shortIntent(reservation.stripe_payment_intent_id);
        const reference = reservation.reference || `Reservierung ${reservation.id.slice(0, 8)}`;
        const base = {
          reference,
          dbStatus: reservation.status,
          stripeStatus: state.status,
          paymentIntent: short,
        };
        const fullyRefunded = state.amount > 0 && state.refunded >= state.amount;

        if (!reservation.final_order_id) {
          add({
            ...base,
            severity: fullyRefunded ? "warning" : "critical",
            code: "orphan_paid_reservation",
            text: fullyRefunded
              ? "Bezahlte Reservierung ohne Bestellung – bereits erstattet."
              : "Bezahlte Reservierung ohne verknüpfte Bestellung.",
          });
          continue;
        }
        const linked = orderById.get(reservation.final_order_id);
        if (linked && linked.stripe_payment_intent_id !== reservation.stripe_payment_intent_id) {
          add({
            ...base,
            severity: "warning",
            code: "reservation_link_mismatch",
            text: "Reservierung und verknüpfte Bestellung verweisen auf verschiedene Zahlungen.",
          });
        }
      }
    } catch {
      console.error("[payments] health check: stripe request failed");
      return {
        ok: false,
        error: "Stripe ist derzeit nicht erreichbar. Der Abgleich konnte nicht abgeschlossen werden.",
      };
    }

    const criticalCount = issues.filter((i) => i.severity === "critical").length;
    const warningCount = issues.length - criticalCount;
    const checkedTotal = orders.length + reservations.length;

    return {
      ok: true,
      report: {
        ok: issues.length === 0,
        environment: env.env,
        checkedAt: new Date().toISOString(),
        periodStart: periodStartIso.slice(0, 10),
        ordersChecked: orders.length,
        reservationsChecked: reservations.length,
        healthyCount: Math.max(checkedTotal - flagged.size, 0),
        warningCount,
        criticalCount,
        issues: issues.slice(0, 50),
      },
    };
  });
