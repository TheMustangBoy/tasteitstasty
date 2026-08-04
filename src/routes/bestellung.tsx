import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BUSINESS, formatPrice } from "@/data/menu";
import { linePrice, useCart } from "@/context/cart";

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
  const { lastOrder } = useCart();

  if (!lastOrder) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl">Keine Bestellung gefunden</h1>
        <p className="mt-3 text-muted-foreground">Starte eine neue Bestellung.</p>
        <Button asChild className="mt-6 h-14 rounded-xl bg-flame px-8 font-bold uppercase text-primary-foreground">
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
          Danke, {lastOrder.name || "Gast"}! Deine Bestellnummer ist{" "}
          <strong className="text-foreground">{lastOrder.reference}</strong>.
        </p>

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
          {lastOrder.lines.map((line) => (
            <li key={line.lineId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {line.quantity}× {line.name}
                </span>
                {line.bacon && <span className="block text-xs text-primary">+ Bacon</span>}
                {line.removed.length > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    ohne {line.removed.join(", ")}
                  </span>
                )}
              </span>
              <span className="shrink-0">{formatPrice(linePrice(line))}</span>
            </li>
          ))}
        </ul>
        <Separator className="my-6" />
        <div className="flex items-center justify-between">
          <span className="text-sm uppercase tracking-wide text-muted-foreground">
            {lastOrder.payment}
          </span>
          <span className="font-display text-2xl">{formatPrice(lastOrder.total)}</span>
        </div>

        <p className="mt-6 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          Demo-Zustand: Die Bestellung wurde nicht übermittelt und es erfolgte keine Zahlung.
        </p>

        <Button asChild variant="outline" className="mt-6 h-12 w-full rounded-xl">
          <Link to="/speisekarte">Neue Bestellung</Link>
        </Button>
      </div>
    </div>
  );
}