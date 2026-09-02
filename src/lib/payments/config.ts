/**
 * Client-sichere Typen und Schemas rund um Online-Zahlungen.
 * Enthält bewusst keine Secrets – nur Formate, die auch im Browser gelten.
 */
import { z } from "zod";

export const PAYMENT_ON_SITE = {
  cash: "Barzahlung bei Abholung",
  terminal: "Kartenzahlung bei Abholung",
} as const;

export type OnSitePaymentId = keyof typeof PAYMENT_ON_SITE;

/** Antwort von `/api/public/payments/config`. */
export type PaymentConfig = {
  /** true = Stripe-Testmodus ist mit gültigen Test-Keys verbunden. */
  configured: boolean;
  /** Nur der öffentliche Test-Key (pk_test_…) oder null. */
  publishableKey: string | null;
  /** Grund, falls nicht konfiguriert (für Admin-/Entwicklerhinweis). */
  reason: string | null;
};

export const cartLineSchema = z.object({
  lineId: z.string().max(120).optional(),
  itemId: z.string().min(1).max(120),
  name: z.string().max(120).optional(),
  basePrice: z.number().nonnegative().max(1000).optional(),
  quantity: z.number().int().min(1).max(20),
  removed: z.array(z.string().max(80)).max(30).optional(),
  bacon: z.boolean().optional(),
  extras: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        name: z.string().max(120).optional(),
        price: z.number().nonnegative().max(1000),
      }),
    )
    .max(30)
    .optional(),
  options: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        name: z.string().max(120).optional(),
        priceDelta: z.number().min(-1000).max(1000),
      }),
    )
    .max(30)
    .optional(),
});

export const createIntentSchema = z.object({
  /** Idempotenzschlüssel des Browsers für genau diesen Checkout-Snapshot. */
  checkoutKey: z.string().regex(/^[0-9a-f]{32,64}$/, "Ungültiger Checkout-Schlüssel"),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(5).max(40),
  note: z.string().trim().max(500).default(""),
  pickupISO: z.string().datetime({ offset: true }),
  pickupLabel: z.string().trim().max(80),
  lines: z.array(cartLineSchema).min(1).max(50),
  total: z.number().positive().max(2000),
});

export type CreateIntentInput = z.infer<typeof createIntentSchema>;

export type CreateIntentResponse = {
  clientSecret: string;
  reservationId: string;
  token: string;
  /** Serverseitig vergebene, kollisionsfreie Bestellnummer. */
  reference: string;
};

export const reservationStatusSchema = z.object({
  reservationId: z.string().uuid(),
  token: z.string().min(32).max(200),
});

export type ReservationStatusValue =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded"
  | "slot_full_after_expiry";

export type ReservationStatus = {
  status: ReservationStatusValue;
  reference: string;
};

