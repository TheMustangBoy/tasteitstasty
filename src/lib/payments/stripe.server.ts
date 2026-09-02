/**
 * Serverseitige Stripe-Anbindung über das integrierte Lovable-Payments-Gateway.
 * Es werden keine eigenen Stripe-Secrets benötigt: Die Env-Variablen sind
 * Gateway-Verbindungsschlüssel, die niemals an den Browser gelangen.
 */
import Stripe from "stripe";

export type StripeEnvName = "sandbox" | "live";

export type StripeEnv = {
  configured: boolean;
  reason: string | null;
  /** Öffentlicher Client-Token (pk_test_… / pk_live_…) für Stripe.js. */
  publishableKey: string | null;
  /** Gateway-Verbindungsschlüssel – nur serverseitig verwenden. */
  secretKey: string | null;
  webhookSecret: string | null;
  env: StripeEnvName;
};

const GATEWAY_STRIPE_BASE = "https://connector-gateway.lovable.dev/stripe";

function readEnv(key: string): string {
  return process.env[key]?.trim() ?? "";
}

/** Umgebung anhand des Client-Token-Präfixes bestimmen. */
export function resolveStripeEnvName(): StripeEnvName | null {
  const token = getPaymentsClientToken();
  if (token.startsWith("pk_test_")) return "sandbox";
  if (token.startsWith("pk_live_")) return "live";
  return null;
}

export function readStripeEnv(envName?: StripeEnvName): StripeEnv {
  const resolved = envName ?? resolveStripeEnvName();
  const publishable = getPaymentsClientToken();


  if (!resolved) {
    return {
      configured: false,
      reason: "Zahlungen sind für diesen Build noch nicht konfiguriert.",
      publishableKey: null,
      secretKey: null,
      webhookSecret: null,
      env: "sandbox",
    };
  }

  const secret =
    resolved === "sandbox" ? readEnv("STRIPE_SANDBOX_API_KEY") : readEnv("STRIPE_LIVE_API_KEY");
  const webhook =
    resolved === "sandbox"
      ? readEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
      : readEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!secret || !readEnv("LOVABLE_API_KEY")) {
    return {
      configured: false,
      reason:
        resolved === "live"
          ? "Live-Zahlungen sind noch nicht freigeschaltet. Bitte Go-Live abschließen."
          : "Zahlungsverbindung ist noch nicht aktiv.",
      publishableKey: null,
      secretKey: null,
      webhookSecret: webhook || null,
      env: resolved,
    };
  }

  return {
    configured: true,
    reason: null,
    publishableKey: publishable,
    secretKey: secret,
    webhookSecret: webhook || null,
    env: resolved,
  };
}

/**
 * Stripe-Client, dessen Requests über das Lovable-Gateway laufen.
 * Das Gateway hängt den echten Stripe-Secret-Key an.
 */
export function createStripeClient(connectionApiKey: string): Stripe {
  const lovableApiKey = readEnv("LOVABLE_API_KEY");

  return new Stripe(connectionApiKey, {
    apiVersion: "2026-08-26.dahlia",
    maxNetworkRetries: 2,
    appInfo: { name: "Taste It's Tasty" },
    httpClient: Stripe.createFetchHttpClient((input, init) => {
      const stripeUrl = input instanceof Request ? input.url : input.toString();
      const gatewayUrl = stripeUrl.replace("https://api.stripe.com", GATEWAY_STRIPE_BASE);
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(
            new Headers(
              init?.headers ?? (input instanceof Request ? input.headers : undefined),
            ).entries(),
          ),
          "X-Connection-Api-Key": connectionApiKey,
          "Lovable-API-Key": lovableApiKey,
        },
      });
    }),
  });
}

export { Stripe };
