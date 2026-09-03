/**
 * Notfall-Schließung für den heutigen Tag (Europe/Berlin).
 * Wirkt nur auf neue Bestellungen – bestehende Bestellungen bleiben unberührt
 * und müssen bei Bedarf einzeln storniert (und erstattet) werden.
 */
import { useState } from "react";
import { CalendarX2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatBerlinDate } from "@/lib/berlin-day";

export function EmergencyClosure({
  closedToday,
  closedDate,
  openOrdersToday,
  onToggle,
}: {
  closedToday: boolean;
  closedDate: string | null;
  openOrdersToday: number;
  onToggle: (closed: boolean) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const result = await onToggle(!closedToday);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Der Status konnte nicht gespeichert werden.");
      return;
    }
    setOpen(false);
    toast.success(closedToday ? "Heute wieder geöffnet" : "Heute geschlossen");
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-xl">
        <CalendarX2 className="h-5 w-5 text-primary" /> Notfall-Schließung
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {closedToday
          ? `Für heute (${closedDate ? formatBerlinDate(closedDate) : "heute"}) sind keine Abholzeiten buchbar. Bestellungen für die nächsten Tage bleiben möglich.`
          : "Schließt den Truck nur für den heutigen Tag. Bestellungen für die nächsten Tage bleiben möglich."}
      </p>

      <Button
        className="mt-4 h-11 rounded-full"
        variant={closedToday ? "outline" : "destructive"}
        onClick={() => setOpen(true)}
      >
        {closedToday ? "Heute wieder öffnen" : "Heute schließen"}
      </Button>

      <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {closedToday ? "Heute wieder öffnen?" : "Heute wirklich schließen?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {closedToday ? (
                <p>
                  Abholzeiten für heute werden wieder angeboten – im Rahmen der Öffnungszeiten und
                  der Vorlaufzeit.
                </p>
              ) : (
                <span className="block space-y-2">
                  <span className="block">Das passiert:</span>
                  <span className="block">
                    • Für heute können keine neuen Bestellungen mehr aufgegeben werden.
                  </span>
                  <span className="block">
                    • Bestellungen für die nächsten Tage bleiben weiterhin möglich.
                  </span>
                  <span className="block">
                    • Bereits eingegangene Bestellungen bleiben bestehen und müssen bei Bedarf
                    einzeln storniert werden – online bezahlte inklusive Erstattung.
                  </span>
                  <span className="block pt-1 font-medium text-foreground">
                    Offene Bestellungen für heute: {openOrdersToday}
                  </span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void confirm();
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {closedToday ? "Wieder öffnen" : "Heute schließen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
