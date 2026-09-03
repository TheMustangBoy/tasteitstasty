/**
 * Browser-Aufruf des geschützten Admin-Health-Checks.
 * Enthält keinerlei Stripe-Secrets – die gesamte Logik läuft serverseitig.
 */
import { runPaymentsHealthCheck, type HealthResult } from "@/lib/payments/health.functions";

export async function runPaymentsHealthCheckRemote(): Promise<HealthResult> {
  return (await runPaymentsHealthCheck()) as HealthResult;
}
