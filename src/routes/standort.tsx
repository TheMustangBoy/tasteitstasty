import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/data/menu";

export const Route = createFileRoute("/standort")({
  head: () => ({
    meta: [
      { title: "Standort – Food Truck am REWE-Parkplatz Dachau" },
      {
        name: "description",
        content:
          "Taste It's Tasty steht am REWE-Parkplatz, Kopernikusstraße 2, 85221 Dachau. Bestellungen zur Abholung.",
      },
      { property: "og:title", content: "Standort – Taste It's Tasty Dachau" },
      { property: "og:description", content: "REWE-Parkplatz, Kopernikusstraße 2, 85221 Dachau." },
    ],
  }),
  component: LocationPage,
});

function LocationPage() {
  const query = encodeURIComponent(`${BUSINESS.street}, ${BUSINESS.city}`);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl sm:text-5xl">Standort</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <MapPin className="h-4 w-4" /> Du findest uns hier
          </p>
          <p className="mt-4 font-display text-2xl">{BUSINESS.name}</p>
          <p className="mt-2 text-muted-foreground">
            {BUSINESS.place}
            <br />
            {BUSINESS.street}
            <br />
            {BUSINESS.city}
          </p>
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" /> {BUSINESS.phone}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> {BUSINESS.email}
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="h-13 rounded-xl bg-flame font-bold uppercase tracking-wide text-primary-foreground"
            >
              <Link to="/speisekarte">Jetzt bestellen</Link>
            </Button>
            <Button asChild variant="outline" className="h-13 rounded-xl">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${query}`}
                target="_blank"
                rel="noreferrer"
              >
                Route planen
              </a>
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border">
          <iframe
            title="Karte Standort Taste It's Tasty"
            src={`https://maps.google.com/maps?q=${query}&z=15&output=embed`}
            className="h-80 w-full lg:h-full"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}