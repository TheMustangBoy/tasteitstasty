/**
 * Gezielte Offline-Prüfungen ohne Netzwerk/Stripe:
 * 1) Idempotenzschlüssel je Checkout-Snapshot (stabil bzw. neu bei Änderung)
 * 2) Status-Mapping der Reservierung (pending vs. terminal)
 *
 * Ausführen:  bun scripts/payments-checks.ts
 */
import assert from "node:assert/strict";

// Minimaler sessionStorage-Ersatz: im Browser kommt der Key aus der Session.
const store = new Map<string, string>();
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

import {
  checkoutKeyFor,
  checkoutSnapshotSignature,
  rotateCheckoutKey,
} from "../src/lib/payments/client";
import { isTerminalReservationStatus } from "../src/lib/payments/config";

const snapshot = {
  lines: [{ itemId: "smash", quantity: 1, basePrice: 8.5 }],
  total: 8.5,
  pickupISO: "2026-09-03T15:00:00.000Z",
  name: "Test",
  phone: "+4915112345678",
  note: "",
  payment: "Barzahlung bei Abholung",
};

// Snapshot-Signatur ist reihenfolgeunabhängig stabil.
assert.equal(
  checkoutSnapshotSignature(snapshot),
  checkoutSnapshotSignature({ ...snapshot, total: 8.5 }),
);

// Gleicher Snapshot => gleicher Key (Retry erzeugt keine zweite Bestellung).
const key = checkoutKeyFor(snapshot);
assert.equal(checkoutKeyFor({ ...snapshot }), key);
assert.match(key, /^[0-9a-f]{32}$/);

// Geänderter Snapshot => anderer Key.
assert.notEqual(checkoutKeyFor({ ...snapshot, total: 9.5 }), key);
assert.notEqual(checkoutKeyFor({ ...snapshot, payment: "Kartenzahlung bei Abholung" }), key);

// Rotation liefert einen neuen gültigen Key.
const rotated = rotateCheckoutKey(snapshot);
assert.match(rotated, /^[0-9a-f]{32}$/);

// Status-Mapping: nur pending ist nicht terminal.
assert.equal(isTerminalReservationStatus("pending"), false);
for (const status of ["paid", "failed", "cancelled", "expired", "refunded", "slot_full_after_expiry"] as const) {
  assert.equal(isTerminalReservationStatus(status), true, status);
}

console.log("payments-checks: OK");

// --- „Meine Bestellung“: Aktivfenster, Ersetzung, Legacy-Bereinigung ---------
const localStore = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => localStore.get(k) ?? null,
  setItem: (k: string, v: string) => void localStore.set(k, v),
  removeItem: (k: string) => void localStore.delete(k),
};
(globalThis as { window?: unknown }).window = { localStorage: globalThis.localStorage };

const { isOrderActive, orderExpiresAt, ORDER_ACTIVE_WINDOW_MS } = await import("../src/context/cart");
const pending = await import("../src/lib/pending-order");

const pickup = new Date("2026-09-03T15:00:00.000Z");
const before = pickup.getTime() + ORDER_ACTIVE_WINDOW_MS - 60_000;
const after = pickup.getTime() + ORDER_ACTIVE_WINDOW_MS + 60_000;

// Vor Ablauf aktiv, nach 2 Stunden abgelaufen.
assert.equal(isOrderActive({ pickupISO: pickup.toISOString() }, before), true);
assert.equal(isOrderActive({ pickupISO: pickup.toISOString() }, after), false);
assert.equal(
  orderExpiresAt({ pickupISO: pickup.toISOString() })?.getTime(),
  pickup.getTime() + ORDER_ACTIVE_WINDOW_MS,
);

// Legacy-Bestellung ohne pickupISO gilt als abgelaufen und wird bereinigt.
assert.equal(isOrderActive({ pickupISO: "" }), false);
assert.equal(isOrderActive(null), false);
assert.equal(isOrderActive({ pickupISO: "kein-datum" }), false);

// Pending-Daten: frisch lesbar, nach TTL bzw. terminalem Status entfernt.
pending.writePendingPayment({
  reservation: "res_1",
  token: "tok_1",
  reference: "TIT-1234",
  createdAt: Date.now(),
});
assert.equal(pending.readPendingPayment()?.reservation, "res_1");
pending.clearPendingPayment();
assert.equal(pending.readPendingPayment(), null);

pending.writePendingPayment({
  reservation: "res_2",
  token: "tok_2",
  reference: "TIT-2345",
  createdAt: Date.now() - pending.PENDING_TTL_MS - 1000,
});
assert.equal(pending.readPendingPayment(), null);

// Frisches Pending hat Vorrang vor einer noch aktiven Altbestellung.
const freshTicket = {
  reservation: "res_new",
  token: "tok_new",
  reference: "TIT-9999",
  createdAt: Date.now(),
};
assert.equal(pending.pendingTakesPrecedence(freshTicket, true), true);
assert.equal(pending.pendingTakesPrecedence(null, true), false);
assert.equal(
  pending.pendingTakesPrecedence(
    { ...freshTicket, createdAt: Date.now() - pending.PENDING_TTL_MS - 1000 },
    true,
  ),
  false,
);

// URL-Rückkehrwerte gewinnen gegenüber einem alten gespeicherten Eintrag.
const resolved = pending.resolvePendingTicket(
  { reservation: "res_new", token: "tok_new", reference: "TIT-9999" },
  { reservation: "res_old", token: "tok_old", reference: "TIT-1111", createdAt: Date.now() },
);
assert.equal(resolved?.reservation, "res_new");
assert.equal(resolved?.reference, "TIT-9999");
assert.equal(resolved?.snapshot, undefined);

// Ohne URL-Werte bleibt der gespeicherte frische Eintrag maßgeblich.
assert.equal(
  pending.resolvePendingTicket(null, { ...freshTicket })?.reservation,
  "res_new",
);
assert.equal(pending.resolvePendingTicket(null, null), null);

// Neuer Auftrag ersetzt den alten lokalen Bestellstand.
const CART_KEY = "tit-cart-v1";
localStorage.setItem(
  CART_KEY,
  JSON.stringify({
    lines: [],
    lastOrder: { reference: "TIT-1111", pickupISO: pickup.toISOString(), lines: [], total: 5 },
  }),
);
const replaced = JSON.parse(localStorage.getItem(CART_KEY)!);
replaced.lastOrder = {
  reference: "TIT-9999",
  pickupISO: pickup.toISOString(),
  lines: [],
  total: 9,
};
localStorage.setItem(CART_KEY, JSON.stringify(replaced));
assert.equal(JSON.parse(localStorage.getItem(CART_KEY)!).lastOrder.reference, "TIT-9999");

console.log("order-checks: OK");
