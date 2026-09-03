import { createFileRoute } from "@tanstack/react-router";
import { WEEKDAYS, formatDayHours, formatHoursSentence } from "@/data/menu";
import { useShop } from "@/context/shop";

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
  const { settings } = useShop();
  // Anzeige beginnt bei Montag (Index 1) und endet mit Sonntag.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl sm:text-5xl">Öffnungszeiten</h1>
      <p className="mt-3 text-muted-foreground">{formatHoursSentence(settings.hours)}.</p>
      <ul className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {order.map((index) => {
          const entry = settings.hours[index]!;
          return (
            <li key={index} className="flex items-center justify-between gap-4 px-5 py-4">
              <span className="font-semibold">{WEEKDAYS[index]}</span>
              <span
                className={entry.closed ? "text-muted-foreground" : "font-display text-primary"}
              >
                {formatDayHours(entry)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        Bestellungen sind ausschließlich zur Abholung möglich.
      </p>
    </div>
  );
}
