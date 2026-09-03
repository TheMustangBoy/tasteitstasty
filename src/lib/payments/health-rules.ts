/**
 * Reine Bewertungsregeln für den Zahlungsabgleich (Stripe ↔ Shop).
 * Bewusst ohne Netzwerk und ohne Datenbank, damit sie testbar sind und
 * niemals Daten verändern.
 */
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

/** Von Stripe gelesener Zustand eines PaymentIntents (rein lesend). */
export type IntentState = {
  status: string;
  /** Betrag in Cent. */
  amount: number;
  currency: string;
  /** Erfolgreich erstatteter Betrag in Cent. */
  refunded: number;
};

export type OrderFacts = {
  reference: string;
  /** Bestellsumme in Cent. */
  totalCents: number;
  paymentStatus: string | null;
  paymentIntentShort: string | null;
};

export type ReservationFacts = {
  reference: string;
  status: string | null;
  paymentIntentShort: string | null;
  hasFinalOrderId: boolean;
  /** Verknüpfte Bestellung existiert in der Datenbank. */
  finalOrderExists: boolean;
  /** PaymentIntent der verknüpften Bestellung stimmt überein. */
  finalOrderIntentMatches: boolean;
};

/** PaymentIntent-ID kürzen – nie vollständig ausgeben. */
export function shortIntent(id: string | null | undefined): string | null {
  if (!id) return null;
  return `${id.slice(0, 3)}…${id.slice(-4)}`;
}

/** Stripe-Status, die eine noch laufende Zahlung bedeuten. */
const PROCESSING_STATUSES = new Set(["processing"]);

/**
 * Bewertet eine online bezahlte Bestellung gegen den Stripe-Zustand.
 * Es wird nichts geschrieben – das Ergebnis ist reine Information für Admins.
 */
export function classifyOrder(order: OrderFacts, state: IntentState): HealthIssue[] {
  const base = {
    reference: order.reference,
    dbStatus: order.paymentStatus,
    stripeStatus: state.status,
    paymentIntent: order.paymentIntentShort,
  };
  const issues: HealthIssue[] = [];
  const paid = order.paymentStatus === "paid";
  const refundedDb = order.paymentStatus === "refunded";
  const fullyRefunded = state.amount > 0 && state.refunded >= state.amount;

  if (paid && state.status !== "succeeded") {
    if (PROCESSING_STATUSES.has(state.status)) {
      issues.push({
        ...base,
        severity: "warning",
        code: "stripe_processing",
        text: "Zahlung wird noch verarbeitet – Stripe hat sie noch nicht abgeschlossen.",
      });
    } else {
      issues.push({
        ...base,
        severity: "critical",
        code: "db_paid_stripe_unpaid",
        text: "Bestellung gilt als bezahlt, Stripe meldet keinen erfolgreichen Zahlungseingang.",
      });
    }
  }
  if (state.status === "succeeded" && !paid && !refundedDb) {
    issues.push({
      ...base,
      severity: "critical",
      code: "stripe_paid_db_unpaid",
      text: "Stripe-Zahlung erfolgreich, Bestellung ist im Shop nicht als bezahlt markiert.",
    });
  }
  if (state.status === "succeeded" && order.totalCents !== state.amount) {
    issues.push({
      ...base,
      severity: "critical",
      code: "amount_mismatch",
      text: "Betrag der Bestellung weicht vom Stripe-Betrag ab.",
    });
  }
  if (state.currency && state.currency !== "eur") {
    issues.push({
      ...base,
      severity: "critical",
      code: "currency_mismatch",
      text: `Stripe-Währung ist „${state.currency}“ statt EUR.`,
    });
  }
  if (refundedDb && !fullyRefunded) {
    issues.push({
      ...base,
      severity: "critical",
      code: "db_refunded_stripe_not",
      text: "Shop meldet Erstattung, Stripe zeigt keine vollständige Rückzahlung.",
    });
  }
  if (fullyRefunded && !refundedDb) {
    issues.push({
      ...base,
      severity: "critical",
      code: "stripe_refunded_db_not",
      text: "Stripe ist vollständig erstattet, im Shop fehlt der Erstattungsstatus.",
    });
  }
  return issues;
}

/** Bewertet eine Reservierung, deren Stripe-Zahlung erfolgreich war. */
export function classifyReservation(
  reservation: ReservationFacts,
  state: IntentState,
): HealthIssue[] {
  if (state.status !== "succeeded") return [];
  const base = {
    reference: reservation.reference,
    dbStatus: reservation.status,
    stripeStatus: state.status,
    paymentIntent: reservation.paymentIntentShort,
  };
  const fullyRefunded = state.amount > 0 && state.refunded >= state.amount;

  if (!reservation.hasFinalOrderId) {
    return [
      {
        ...base,
        severity: fullyRefunded ? "warning" : "critical",
        code: "orphan_paid_reservation",
        text: fullyRefunded
          ? "Bezahlte Reservierung ohne Bestellung – bereits erstattet."
          : "Bezahlte Reservierung ohne verknüpfte Bestellung.",
      },
    ];
  }
  if (!reservation.finalOrderExists) {
    return [
      {
        ...base,
        severity: "critical",
        code: "reservation_final_order_missing",
        text: "Bezahlte Reservierung verweist auf nicht vorhandene Bestellung.",
      },
    ];
  }
  if (!reservation.finalOrderIntentMatches) {
    return [
      {
        ...base,
        severity: "warning",
        code: "reservation_link_mismatch",
        text: "Reservierung und verknüpfte Bestellung verweisen auf verschiedene Zahlungen.",
      },
    ];
  }
  return [];
}

/** Bestellung, deren Stripe-Zahlung nicht abrufbar ist. */
export function intentUnavailableIssue(order: OrderFacts): HealthIssue {
  return {
    severity: "critical",
    reference: order.reference,
    code: "stripe_intent_unavailable",
    text: "Zugehörige Stripe-Zahlung ist nicht auffindbar.",
    dbStatus: order.paymentStatus,
    stripeStatus: null,
    paymentIntent: order.paymentIntentShort,
  };
}
