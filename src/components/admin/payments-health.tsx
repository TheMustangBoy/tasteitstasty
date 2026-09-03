/**
 * Admin-Abschnitt „Zahlungsabgleich“: vergleicht Stripe mit den Shopdaten.
 * Der Check ist rein lesend – er ändert weder Bestellungen noch Zahlungen.
 */
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runPaymentsHealthCheckRemote } from "@/lib/payments/health-client";
import type { HealthReport } from "@/lib/payments/health.functions";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function PaymentsHealth() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<HealthReport | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await runPaymentsHealthCheckRemote();
      if (result.ok) {
        setReport(result.report);
      } else {
        setReport(null);
        setError(result.error);
      }
    } catch {
      setReport(null);
      setError("Der Abgleich konnte nicht ausgeführt werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-xl">
        <ShieldCheck className="h-5 w-5 text-primary" /> Zahlungsabgleich
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Prüft die letzten 30 Tage: Stimmen Zahlungsstatus, Beträge und Erstattungen zwischen Shop
        und Zahlungsdienst überein? Es werden keine Daten geändert.
      </p>

      <Button className="mt-4 h-11 rounded-full" onClick={() => void run()} disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {busy ? "Wird geprüft …" : "Abgleich starten"}
      </Button>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {report && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Geprüft am {formatTime(report.checkedAt)} · Zeitraum ab {report.periodStart} ·{" "}
            {report.ordersChecked} Bestellungen, {report.reservationsChecked} Zahlungsvorgänge
            {report.environment === "sandbox" ? " · Testmodus" : ""}
          </p>

          {report.ok ? (
            <p className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Alles im Einklang – keine Abweichungen gefunden.
            </p>
          ) : (
            <>
              <p className="flex items-start gap-2 rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {report.criticalCount} kritische und {report.warningCount} weitere Hinweise.{" "}
                {report.healthyCount} Vorgänge sind unauffällig.
              </p>
              <ul className="space-y-2">
                {report.issues.map((issue, index) => (
                  <li
                    key={`${issue.reference}-${issue.code}-${index}`}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <strong>{issue.reference}</strong>
                      <span
                        className={
                          issue.severity === "critical"
                            ? "rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive"
                            : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        }
                      >
                        {issue.severity === "critical" ? "kritisch" : "Hinweis"}
                      </span>
                    </span>
                    <span className="mt-1 block">{issue.text}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Shop: {issue.dbStatus ?? "–"} · Zahlungsdienst: {issue.stripeStatus ?? "–"}
                      {issue.paymentIntent ? ` · ${issue.paymentIntent}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
