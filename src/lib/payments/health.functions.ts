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
 * - Ergebnis enthält keine Kundendaten und nur gekürzte Zahlungs-IDs.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  classifyOrder,
  classifyReservation,
  intentUnavailableIssue,
  shortIntent,
  type HealthIssue,
  type IntentState,
} from "@/lib/payments/health-rules";

export type { HealthIssue, HealthSeverity } from "@/lib/payments/health-rules";

/** Prüfzeitraum und Mengenlimits, damit der Check kalkulierbar bleibt. */
export const HEALTH_PERIOD_DAYS = 30;
export const HEALTH_MAX_RECORDS = 150;
const STRIPE_CONCURRENCY = 5;
const REFUND_PAGE_SIZE = 100;

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

/** Fehlt das Stripe-Objekt (gelöscht/falsche Umgebung)? Kein Gesamtabbruch. */
function isMissingResource(error: unknown): boolean {
  const err = error as { code?: string; statusCode?: number; type?: string } | null;
  return err?.code === "resource_missing" || err?.statusCode === 404;
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

    const periodStartIso = new Date(Date.now() - HEALTH_PERIOD_DAYS * 86_400_000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [ordersRes, reservationsRes] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, reference, total, payment_status, stripe_payment_intent_id")
        .eq("payment_provider", "stripe")
        .gte("created_at", periodStartIso)
        .order("created_at", { ascending: false })
        .limit(HEALTH_MAX_RECORDS),
      supabaseAdmin
        .from("payment_reservations")
        .select("id, reference, status, stripe_payment_intent_id, final_order_id")
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

    // Verknüpfte Bestellungen gezielt nachladen – unabhängig vom Zeitfenster
    // und vom Limit der Bestellabfrage oben.
    const linkedIds = [
      ...new Set(
        reservations
          .map((r) => r.final_order_id)
          .filter((id): id is string => Boolean(id) && !orders.some((o) => o.id === id)),
      ),
    ];
    const linkedRes = linkedIds.length
      ? await supabaseAdmin
          .from("orders")
          .select("id, stripe_payment_intent_id")
          .in("id", linkedIds)
      : { data: [], error: null };
    if (linkedRes.error) {
      return { ok: false, error: "Die Bestelldaten konnten nicht gelesen werden." };
    }

    const intentByOrderId = new Map<string, string | null>([
      ...orders.map((o) => [o.id, o.stripe_payment_intent_id] as [string, string | null]),
      ...(linkedRes.data ?? []).map(
        (o) => [o.id, o.stripe_payment_intent_id] as [string, string | null],
      ),
    ]);

    const issues: HealthIssue[] = [];
    const flagged = new Set<string>();
    const add = (list: HealthIssue[]) => {
      for (const issue of list) {
        issues.push(issue);
        flagged.add(issue.reference);
      }
    };

    /** Stripe-Zustand eines PaymentIntents (rein lesend, mit Refund-Paging). */
    const loadIntent = async (paymentIntentId: string): Promise<IntentState | null> => {
      let intent;
      try {
        intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      } catch (error) {
        if (isMissingResource(error)) return null;
        throw error;
      }
      let refunded = 0;
      let startingAfter: string | undefined;
      for (;;) {
        const page = await stripe.refunds.list({
          payment_intent: paymentIntentId,
          limit: REFUND_PAGE_SIZE,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        for (const refund of page.data) {
          if (refund.status === "succeeded") refunded += refund.amount ?? 0;
        }
        if (!page.has_more || page.data.length === 0) break;
        startingAfter = page.data[page.data.length - 1]?.id;
        if (!startingAfter) break;
      }
      return {
        status: intent.status,
        amount: intent.amount_received || intent.amount,
        currency: (intent.currency ?? "").toLowerCase(),
        refunded,
      };
    };

    try {
      /* ------------------------------------------------------- Bestellungen */
      for (const order of orders) {
        if (!order.stripe_payment_intent_id) {
          add([
            {
              severity: "critical",
              reference: order.reference,
              code: "missing_stripe_intent",
              text: "Onlinezahlung ohne hinterlegte Stripe-Zahlung.",
              dbStatus: order.payment_status,
              stripeStatus: null,
              paymentIntent: null,
            },
          ]);
        }
      }

      const withIntent = orders.filter((o) => o.stripe_payment_intent_id);
      const orderStates = await mapLimited(withIntent, STRIPE_CONCURRENCY, async (order) => ({
        order,
        state: await loadIntent(order.stripe_payment_intent_id as string),
      }));

      for (const { order, state } of orderStates) {
        const facts = {
          reference: order.reference,
          totalCents: toCents(order.total),
          paymentStatus: order.payment_status,
          paymentIntentShort: shortIntent(order.stripe_payment_intent_id),
        };
        add(state ? classifyOrder(facts, state) : [intentUnavailableIssue(facts)]);
      }

      /* ---------------------------------------------------- Reservierungen */
      const reservationStates = await mapLimited(
        reservations,
        STRIPE_CONCURRENCY,
        async (reservation) => ({
          reservation,
          state: await loadIntent(reservation.stripe_payment_intent_id as string),
        }),
      );

      for (const { reservation, state } of reservationStates) {
        if (!state) continue; // fehlende Reservierungszahlung ist kein Bestellproblem
        const finalId = reservation.final_order_id;
        const linkedIntent = finalId ? intentByOrderId.get(finalId) : undefined;
        add(
          classifyReservation(
            {
              reference: reservation.reference || `Reservierung ${reservation.id.slice(0, 8)}`,
              status: reservation.status,
              paymentIntentShort: shortIntent(reservation.stripe_payment_intent_id),
              hasFinalOrderId: Boolean(finalId),
              finalOrderExists: Boolean(finalId) && intentByOrderId.has(finalId as string),
              finalOrderIntentMatches: linkedIntent === reservation.stripe_payment_intent_id,
            },
            state,
          ),
        );
      }
    } catch {
      console.error("[payments] health check: stripe request failed");
      return {
        ok: false,
        error:
          "Stripe ist derzeit nicht erreichbar. Der Abgleich konnte nicht abgeschlossen werden.",
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
