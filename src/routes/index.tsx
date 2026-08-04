import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, MapPin, Flame, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBurger from "@/assets/hero-burger.jpg";
import { BUSINESS, formatPrice } from "@/data/menu";
import { useShop } from "@/context/shop";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Taste It's Tasty – Smash Burger Food Truck in Dachau" },
      {
        name: "description",
        content:
          "Handgesmashte Burger vom Food Truck am REWE-Parkplatz, Kopernikusstraße 2, Dachau. Online bestellen, frisch abholen.",
      },
      { property: "og:title", content: "Taste It's Tasty – Smash Burger Food Truck in Dachau" },
      {
        property: "og:description",
        content: "Online bestellen und am REWE-Parkplatz in Dachau abholen.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { products } = useShop();
  const highlights = products.filter((i) =>
    ["smash-burger", "tripple-smash", "trueffel-smash"].includes(i.id),
  );

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroBurger}
            alt="Double Smash Burger mit geschmolzenem Käse"
            width={1280}
            height={1280}
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <Flame className="h-3.5 w-3.5" /> Nur Abholung
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl leading-[0.95] sm:text-6xl lg:text-7xl">
            Smash Burger,
            <br />
            <span className="text-flame-gradient">wie er sein muss.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Frisch gesmasht auf der heißen Platte. Double Patty als Standard. Bestell online und hol
            deinen Burger heiß am Truck ab.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-14 rounded-xl bg-flame px-8 text-base font-bold uppercase tracking-wide text-primary-foreground shadow-flame hover:opacity-90"
            >
              <Link to="/speisekarte">
                <ShoppingBag className="mr-2 h-5 w-5" /> Jetzt bestellen
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 rounded-xl border-border px-8 text-base font-bold uppercase tracking-wide"
            >
              <Link to="/standort">Standort ansehen</Link>
            </Button>
          </div>

          <dl className="mt-12 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card/80 p-5">
              <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                <MapPin className="h-4 w-4" /> Standort
              </dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                {BUSINESS.place}
                <br />
                {BUSINESS.street}, {BUSINESS.city}
              </dd>
            </div>
            <div className="rounded-2xl border border-border bg-card/80 p-5">
              <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                <Clock className="h-4 w-4" /> Öffnungszeiten
              </dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                Mo – Sa: 11:00 – 18:00 Uhr
                <br />
                Sonntag: geschlossen
              </dd>
            </div>
            <div className="rounded-2xl border border-border bg-card/80 p-5">
              <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                <Flame className="h-4 w-4" /> Fleischregel
              </dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                Alle Fleischburger mit Double Patty, Tripple Smash mit drei Patties.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <h2 className="min-w-0 text-2xl sm:text-3xl">Beliebt am Truck</h2>
          <Link
            to="/speisekarte"
            className="shrink-0 text-sm font-bold uppercase tracking-wide text-primary"
          >
            Alle ansehen
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item) => (
            <Link
              key={item.id}
              to="/speisekarte"
              className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/60"
            >
              <h3 className="text-lg font-normal">{item.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.ingredients.join(" · ")}</p>
              <p className="mt-4 font-display text-xl">{formatPrice(item.price)}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
