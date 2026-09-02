/**
 * Browser-Zugriff auf die Zahlungs-Endpunkte. Enthält keine Secrets.
 */
import type {
  CreateIntentInput,
  CreateIntentResponse,
  PaymentConfig,
  ReservationStatus,
} from "@/lib/payments/config";

const CHECKOUT_KEY_PREFIX = "tit-checkout-key:";

/** Stabiler Fingerprint des vollständigen Checkout-Snapshots. */
export function checkoutSnapshotSignature(snapshot: unknown): string {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, stable((value as Record<string, unknown>)[k])]);
    }
    return value;
  };
  return JSON.stringify(stable(snapshot));
}

function randomKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Liefert je Checkout-Snapshot denselben kryptografisch zufälligen Schlüssel.
 * Reload/Retry mit identischem Snapshot ⇒ gleicher Key ⇒ gleiche Reservierung.
 * Geänderter Snapshot ⇒ neuer Key ⇒ neue Reservierung.
 */
export function checkoutKeyFor(snapshot: unknown): string {
  const signature = checkoutSnapshotSignature(snapshot);
  if (typeof sessionStorage === "undefined") return randomKey();
  let hash = 0;
  for (let i = 0; i < signature.length; i += 1) hash = (hash * 31 + signature.charCodeAt(i)) | 0;
  const storageKey = `${CHECKOUT_KEY_PREFIX}${hash >>> 0}`;
  try {
    const cached = sessionStorage.getItem(storageKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { signature: string; key: string };
      if (parsed.signature === signature && /^[0-9a-f]{32}$/.test(parsed.key)) return parsed.key;
    }
    const key = randomKey();
    sessionStorage.setItem(storageKey, JSON.stringify({ signature, key }));
    return key;
  } catch {
    return randomKey();
  }
}


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
