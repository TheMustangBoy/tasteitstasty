/**
 * Öffentlicher Stripe-Publishable-Key (Sandbox).
 *
 * Publishable Keys sind per Definition öffentlich und dürfen im Client-Bundle
 * landen. Der Wert wird zur Build-Zeit aufgelöst:
 *   1. import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN (Vite inlined, falls gesetzt)
 *   2. process.env.VITE_PAYMENTS_CLIENT_TOKEN (Runtime-Env, falls vorhanden)
 *   3. Fallback-Konstante für die Sandbox-Umgebung
 *
 * Es wird niemals ein Secret (sk_…/whsec_…/Gateway-Key) hierüber ausgeliefert.
 */
const FALLBACK_SANDBOX_PUBLISHABLE_KEY =
  "pk_test_51U6OgyDSoCQucAYhxRJLisf3NP5SvMGtyPBhKcPUj4GB7GYORwcYUbTT66npUVPQAM8VIzI2iqoQCgTwYUR3cbPk000bPqb3s6";

function fromImportMeta(): string {
  try {
    return (import.meta.env?.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined)?.trim() ?? "";
  } catch {
    return "";
  }
}

function fromProcessEnv(): string {
  try {
    return process.env?.VITE_PAYMENTS_CLIENT_TOKEN?.trim() ?? "";
  } catch {
    return "";
  }
}

export function getPaymentsClientToken(): string {
  return fromImportMeta() || fromProcessEnv() || FALLBACK_SANDBOX_PUBLISHABLE_KEY;
}
