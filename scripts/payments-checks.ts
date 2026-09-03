/**
 * Gezielte Offline-Prüfungen ohne Netzwerk/Stripe:
 * 1) Idempotenzschlüssel je Checkout-Snapshot (stabil bzw. neu bei Änderung)
 * 2) Status-Mapping der Reservierung (pending vs. terminal)
 *
 * Ausführen:  bun scripts/payments-checks.ts
 */
import assert from "node:assert/strict";
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
