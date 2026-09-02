import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/shop/page-shell";
import { LEGAL } from "@/data/legal";
import {
  ALLERGEN_CROSS_CONTACT_NOTE,
  ALLERGEN_LEGEND,
  ALLERGEN_UNCONFIRMED_TEXT,
  INGREDIENT_ALLERGENS,
} from "@/data/allergens";

export const Route = createFileRoute("/allergene")({
  head: () => ({
    meta: [
      { title: "Allergene – Taste It's Tasty" },
      {
        name: "description",
        content:
          "Allergeninformationen zu den Bestandteilen von Taste It's Tasty – Übersicht nach bestätigtem Aushang.",
      },
      { property: "og:title", content: "Allergene – Taste It's Tasty" },
      { property: "og:description", content: "Allergenangaben zu den Bestandteilen des Food Trucks." },
    ],
  }),
  component: AllergenePage,
});

function AllergenePage() {
  return (
    <PageShell
      title="Allergene"
      intro="Hier findest du die Allergenangaben zu den Bestandteilen unserer Speisen – entsprechend dem aktuellen Aushang am Food Truck."
    >
      <section className="space-y-3">
        <div className="hidden text-sm font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4 sm:px-4 sm:pb-2">
          <span>Bestandteil</span>
          <span className="text-right">Allergene</span>
        </div>

        <ul className="space-y-3 sm:space-y-2">
          {INGREDIENT_ALLERGENS.map((item) => (
            <li
              key={item.ingredient}
              className="rounded-xl border border-border bg-card p-4 sm:px-4 sm:py-3"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                    Bestandteil
                  </span>
                  <p className="truncate font-medium sm:text-base">{item.ingredient}</p>
                </div>
                <div className="min-w-0 sm:text-right">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                    Allergene
                  </span>
                  <p className="font-mono text-sm text-muted-foreground">
                    {item.codes.join(", ")}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold">Legende</h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {ALLERGEN_LEGEND.map((entry) => (
            <div key={entry.code} className="flex min-w-0 gap-3">
              <dt className="w-8 shrink-0 font-mono font-medium">{entry.code}</dt>
              <dd className="text-muted-foreground">{entry.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-3 text-sm text-muted-foreground">
        <p>{ALLERGEN_CROSS_CONTACT_NOTE}</p>
        <p>
          {ALLERGEN_UNCONFIRMED_TEXT} Bei Unverträglichkeiten wende dich bitte vor der Bestellung an
          uns:{" "}
          <a href={`tel:${LEGAL.phone}`} className="underline underline-offset-2">
            {LEGAL.phone}
          </a>{" "}
          ·{" "}
          <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-2">
            {LEGAL.email}
          </a>
        </p>
      </section>
    </PageShell>
  );
}
