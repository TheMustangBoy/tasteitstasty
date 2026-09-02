import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BUSINESS, formatPrice } from "@/data/menu";
import { linePrice, useCart } from "@/context/cart";
import { waitForPaidReservation } from "@/lib/payments/client";

export const Route = createFileRoute("/bestellung")({
  head: () => ({
    meta: [
      { title: "Bestellbestätigung – Taste It's Tasty" },
      {
        name: "description",
        content: "Deine Abholbestellung beim Food Truck Taste It's Tasty in Dachau.",
      },
      { property: "og:title", content: "Bestellbestätigung – Taste It's Tasty" },
      { property: "og:description", content: "Abholbestellung bestätigt." },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { lastOrder, clear } = useCart();
  // Rückkehr aus einem Stripe-Redirect (z. B. 3-D-Secure) ohne lokalen Bestellstand.
  const [redirectState, setRedirectState] = useState<
    { phase: "idle" } | { phase: "checking" } | { phase: "done"; reference: string; paid: boolean }
  >({ phase: "idle" });

  useEffect(() => {
    if (lastOrder) return;
    const params = new URLSearchParams(window.location.search);
    const reservation = params.get("reservation");
    const token = params.get("token");
    if (!reservation || !token) return;
    let active = true;
    setRedirectState({ phase: "checking" });
    void waitForPaidReservation(reservation, token).then((status) => {
      if (!active) return;
      // Nur bei serverseitig bestätigter Zahlung den Warenkorb leeren.
      if (status === "paid") clear();
      setRedirectState({
        phase: "done",
        reference: params.get("ref") ?? "",
        paid: status === "paid",
      });
      // Reservierungs-Parameter aus der URL entfernen.
      window.history.replaceState({}, "", window.location.pathname);
    });
    return () => {
      active = false;
    };
  }, [lastOrder, clear]);


  if (!lastOrder && redirectState.phase === "checking") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
        <h1 className="mt-4 text-3xl">Zahlung wird bestätigt</h1>
        <p className="mt-3 text-muted-foreground">
          Bitte dieses Fenster kurz geöffnet lassen – das dauert nur wenige Sekunden.
        </p>
      </div>
    );
  }

  if (!lastOrder && redirectState.phase === "done") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl">
          {redirectState.paid ? "Zahlung erfolgreich" : "Zahlung nicht abgeschlossen"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {redirectState.paid
            ? "Deine Bestellung ist beim Truck eingegangen."
            : "Es wurde keine Zahlung gebucht. Du kannst die Bestellung erneut starten."}
        </p>
        {redirectState.paid && redirectState.reference && (
          <p className="mt-5 font-display text-4xl">{redirectState.reference}</p>
        )}

        <Button
          asChild
          className="mt-6 h-14 rounded-xl bg-flame px-8 font-bold uppercase text-primary-foreground"
        >
          <Link to="/speisekarte">Zur Speisekarte</Link>
        </Button>
      </div>
    );
  }

  if (!lastOrder) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl">Keine Bestellung gefunden</h1>
        <p className="mt-3 text-muted-foreground">Starte eine neue Bestellung.</p>
        <Button
          asChild
          className="mt-6 h-14 rounded-xl bg-flame px-8 font-bold uppercase text-primary-foreground"
        >
          <Link to="/speisekarte">Zur Speisekarte</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <div className="rounded-3xl border border-primary/40 bg-card p-6 shadow-flame sm:p-10">
        <CheckCircle2 className="h-12 w-12 text-primary" />
        <h1 className="mt-4 text-3xl sm:text-4xl">Bestellung bestätigt</h1>
        <p className="mt-2 text-muted-foreground">
          Danke, {lastOrder.name || "Gast"}! Zeig diese Nummer bei der Abholung am Truck.
        </p>

        <div className="mt-5 rounded-2xl border border-primary/50 bg-primary/10 p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
            Bestellnummer
          </p>
          <p className="mt-1 font-display text-4xl leading-none sm:text-5xl">
            {lastOrder.reference}
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <Clock className="h-4 w-4" /> Abholzeit
            </p>
            <p className="mt-2 font-display text-xl">{lastOrder.pickupLabel}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <MapPin className="h-4 w-4" /> Abholort
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {BUSINESS.place}, {BUSINESS.street}, {BUSINESS.city}
            </p>
          </div>
        </div>

        <Separator className="my-6" />
        <ul className="space-y-3 text-sm">
          {(Array.isArray(lastOrder.lines) ? lastOrder.lines : []).map((line, index) => {
            const removed = Array.isArray(line?.removed) ? line.removed : [];
            const safeLine = { ...line, removed, quantity: line?.quantity ?? 1, basePrice: line?.basePrice ?? 0 };
            return (
              <li
                key={line?.lineId ?? index}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {safeLine.quantity}× {line?.name ?? "Artikel"}
                  </span>
                  {line?.bacon && <span className="block text-xs text-primary">+ Bacon</span>}
                  {removed.length > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      ohne {removed.join(", ")}
                    </span>
                  )}
                </span>
                <span className="shrink-0">{formatPrice(linePrice(safeLine))}</span>
              </li>
            );
          })}
        </ul>
        <Separator className="my-6" />
        <div className="flex items-center justify-between">
          <span className="text-sm uppercase tracking-wide text-muted-foreground">
            {lastOrder.payment}
          </span>
          <span className="font-display text-2xl">{formatPrice(lastOrder.total ?? 0)}</span>
        </div>

        <Button asChild variant="outline" className="mt-6 h-12 w-full rounded-xl">
          <Link to="/speisekarte">Neue Bestellung</Link>
        </Button>
      </div>
    </div>
  );
}
