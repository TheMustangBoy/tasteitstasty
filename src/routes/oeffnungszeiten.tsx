import { createFileRoute } from "@tanstack/react-router";
import { OPENING_HOURS } from "@/data/menu";

export const Route = createFileRoute("/oeffnungszeiten")({
  head: () => ({
    meta: [
      { title: "Öffnungszeiten – Taste It's Tasty Food Truck Dachau" },
      {
        name: "description",
        content: "Öffnungszeiten des Smash-Burger-Food-Trucks am REWE-Parkplatz in Dachau.",
      },
      { property: "og:title", content: "Öffnungszeiten – Taste It's Tasty" },
      { property: "og:description", content: "Wann der Truck in Dachau geöffnet hat." },
    ],
  }),
  component: HoursPage,
});

function HoursPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl sm:text-5xl">Öffnungszeiten</h1>
      <p className="mt-3 text-muted-foreground">
        Platzhalter-Zeiten – können später im Adminbereich gepflegt werden.
      </p>
      <ul className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {OPENING_HOURS.map((entry) => (
          <li key={entry.day} className="flex items-center justify-between gap-4 px-5 py-4">
            <span className="font-semibold">{entry.day}</span>
            <span
              className={
                entry.hours === "Ruhetag" ? "text-muted-foreground" : "font-display text-primary"
              }
            >
              {entry.hours}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        Bestellungen sind ausschließlich zur Abholung möglich – mit mindestens 15 Minuten Vorlauf.
      </p>
    </div>
  );
}