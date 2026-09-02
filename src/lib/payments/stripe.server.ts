/**
 * Serverseitige Stripe-Konfiguration – ausschließlich Testmodus.
 * Live-Keys (sk_live_/pk_live_) werden bewusst abgelehnt, damit in diesem
 * Projektschritt keine echten Zahlungen möglich sind.
 * Secrets werden niemals zurückgegeben oder geloggt.
 */
import Stripe from "stripe";

export type StripeEnv = {
  configured: boolean;
  reason: string | null;
  publishableKey: string | null;
  secretKey: string | null;
  webhookSecret: string | null;
};

export function readStripeEnv(): StripeEnv {
  const secret = process.env["STRIPE_SECRET_KEY"]?.trim() ?? "";
  const publishable = process.env["STRIPE_PUBLISHABLE_KEY"]?.trim() ?? "";
  const webhook = process.env["STRIPE_WEBHOOK_SECRET"]?.trim() ?? "";

  if (!secret || !publishable) {
    return {
      configured: false,
      reason: "Stripe-Testmodus noch nicht verbunden.",
      publishableKey: null,
      secretKey: null,
      webhookSecret: webhook || null,
    };
  }
  if (!secret.startsWith("sk_test_") || !publishable.startsWith("pk_test_")) {
    return {
      configured: false,
      reason: "Es sind nur Stripe-Test-Keys (sk_test_/pk_test_) zugelassen.",
      publishableKey: null,
      secretKey: null,
      webhookSecret: webhook || null,
    };
  }
  return {
    configured: true,
    reason: null,
    publishableKey: publishable,
    secretKey: secret,
    webhookSecret: webhook || null,
  };
}

/** Stripe-Client für die Worker-Runtime (fetch-basierter HTTP-Client). */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    appInfo: { name: "Taste It's Tasty" },
  });
}

export { Stripe };
