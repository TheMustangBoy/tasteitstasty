/**
 * Browser-Zugriff auf die Zahlungs-Endpunkte. Enthält keine Secrets.
 */
import type {
  CreateIntentInput,
  CreateIntentResponse,
  PaymentConfig,
  ReservationStatus,
} from "@/lib/payments/config";

export async function fetchPaymentConfig(): Promise<PaymentConfig> {
  try {
    const res = await fetch("/api/public/payments/config");
    if (!res.ok) throw new Error("config");
    return (await res.json()) as PaymentConfig;
  } catch {
    return {
      configured: false,
      publishableKey: null,
      reason: "Zahlungsdienst nicht erreichbar.",
    };
  }
}

export async function createPaymentIntent(input: CreateIntentInput): Promise<CreateIntentResponse> {
  const res = await fetch("/api/public/payments/create-intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => null)) as
    | (CreateIntentResponse & { error?: string })
    | null;
  if (!res.ok || !body || !("clientSecret" in body)) {
    throw new Error(body?.error ?? "Die Zahlung konnte nicht gestartet werden.");
  }
  return body;
}

export async function fetchReservationStatus(
  reservationId: string,
  token: string,
): Promise<ReservationStatus | null> {
  const res = await fetch("/api/public/payments/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reservationId, token }),
  });
  if (!res.ok) return null;
  return (await res.json()) as ReservationStatus;
}

/** Wartet, bis der Webhook die Reservierung finalisiert hat. */
export async function waitForPaidReservation(
  reservationId: string,
  token: string,
  timeoutMs = 30_000,
): Promise<ReservationStatus["status"]> {
  const started = Date.now();
  let last: ReservationStatus["status"] = "pending";
  while (Date.now() - started < timeoutMs) {
    const status = await fetchReservationStatus(reservationId, token);
    if (status) {
      last = status.status;
      if (status.status !== "pending") return status.status;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return last;
}
