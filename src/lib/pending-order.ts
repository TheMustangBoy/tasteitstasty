/**
 * Browserpersistente Ablage für eine laufende Onlinezahlung (Stripe-Redirect).
 *
 * Gespeichert werden ausschließlich technische Rückkehrwerte (Reservierung,
 * Token, Referenz) plus ein minimaler Anzeige-Snapshot der Bestellung, damit
 * nach einem 3-D-Secure-Redirect oder Reload weiter geprüft und die bezahlte
 * Bestellung lokal angezeigt werden kann. Der Eintrag wird bei terminalem
 * Status oder spätestens nach PENDING_TTL_MS entfernt.
 */
export const PENDING_STORAGE_KEY = "tit-payment-redirect-v1";

/** Nach dieser Frist ist eine offene Zahlungssitzung nicht mehr verwertbar. */
export const PENDING_TTL_MS = 20 * 60 * 1000;

export type PendingOrderSnapshot = {
  reference: string;
  lines: unknown[];
  total: number;
  pickupLabel: string;
  pickupISO: string;
  payment: string;
  name: string;
};

export type PendingPayment = {
  reservation: string;
  token: string;
  reference: string;
  createdAt: number;
  snapshot?: PendingOrderSnapshot;
};

const storage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function isPendingFresh(entry: PendingPayment, now = Date.now()): boolean {
  return Number.isFinite(entry.createdAt) && now - entry.createdAt < PENDING_TTL_MS;
}

export function readPendingPayment(now = Date.now()): PendingPayment | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(PENDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPayment>;
    if (!parsed?.reservation || !parsed?.token) return null;
    const entry: PendingPayment = {
      reservation: parsed.reservation,
      token: parsed.token,
      reference: parsed.reference ?? "",
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : 0,
      snapshot: parsed.snapshot,
    };
    if (!isPendingFresh(entry, now)) {
      store.removeItem(PENDING_STORAGE_KEY);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function writePendingPayment(entry: PendingPayment) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(PENDING_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* Ohne Storage bleibt der Check nur für diese Ansicht möglich. */
  }
}

export function clearPendingPayment() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(PENDING_STORAGE_KEY);
  } catch {
    /* nichts zu tun */
  }
}
