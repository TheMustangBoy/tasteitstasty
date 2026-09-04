/**
 * Reine Helfer für die heutigen, noch offenen Bestellungen (Berliner Tag).
 * Bewusst ohne React und ohne Datenbank, damit sie testbar bleiben.
 */
import { berlinDayKey } from "@/lib/berlin-day";

/** Minimale Sicht auf eine Bestellung – passt zu `ShopOrder`. */
export type OpenOrderFacts = {
  status: string;
  pickupISO: string;
  paymentProvider?: string | null;
  paymentStatus?: string | null;
};

/** Offene Bestellungen mit Abholung am angegebenen Berliner Tag. */
export function openOrdersForBerlinDay<T extends OpenOrderFacts>(
  orders: readonly T[],
  closedStatuses: readonly string[],
  dayKey: string = berlinDayKey(),
): T[] {
  return orders.filter((order) => {
    if (closedStatuses.includes(order.status)) return false;
    const pickup = new Date(order.pickupISO);
    if (Number.isNaN(pickup.getTime())) return false;
    return berlinDayKey(pickup) === dayKey;
  });
}

/** Davon online bezahlt (Stripe, Status „paid“) – diese brauchen bei Storno eine Erstattung. */
export function onlinePaidCount(orders: readonly OpenOrderFacts[]): number {
  return orders.filter((o) => o.paymentProvider === "stripe" && o.paymentStatus === "paid").length;
}
