import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/shop/page-shell";
import { CATEGORIES, MENU } from "@/data/menu";
import { LEGAL } from "@/data/legal";

/**
 * Vorbereitete Allergen-Struktur. Es werden bewusst KEINE Allergene erfunden –
 * je Produkt steht ein Platzhalter, der vor dem Livebetrieb gefüllt werden muss.
 */
const ALLERGEN_PLACEHOLDER = "[ALLERGENE FÜR DIESES PRODUKT EINTRAGEN]";

/** Gesetzliche Hauptallergengruppen nach Anhang II LMIV – als Ausfüllhilfe. */
const ALLERGEN_GROUPS = [
  "Glutenhaltiges Getreide",
  "Krebstiere",
  "Eier",
  "Fische",
  "Erdnüsse",
  "Sojabohnen",
  "Milch (inkl. Laktose)",
  "Schalenfrüchte",
  "Sellerie",
  "Senf",
  "Sesamsamen",
  "Schwefeldioxid und Sulphite",
  "Lupinen",
  "Weichtiere",
];

export const Route = createFileRoute("/allergene")({
  head: () => ({
    meta: [
      { title: "Allergene – Taste It's Tasty" },
      {
        name: "description",
        content:
          "Allergeninformationen zu den Speisen von Taste It's Tasty – Übersicht je Produkt vor der Bestellung.",
      },
      { property: "og:title", content: "Allergene – Taste It's Tasty" },
      { property: "og:description", content: "Allergenangaben je Produkt des Food Trucks." },
    ],
  }),
  component: AllergenePage,
});

function AllergenePage() {
  return (
    <PageShell
      title="Allergene"
      intro="Übersicht der allergenen Zutaten je Produkt. Die Angaben werden vor Vertragsschluss bereitgestellt."
    >
      <p className="rounded-lg border border-dashed border-primary/60 bg-primary/5 p-4 text-sm">
        <strong>Wichtig:</strong> Die konkreten Allergenangaben sind noch nicht eingetragen. Vor dem
        Livebetrieb müssen alle mit „{ALLERGEN_PLACEHOLDER}“ markierten Felder durch die tatsächlich
        verwendeten Allergene ersetzt werden. Es dürfen keine Angaben geschätzt werden.
      </p>

      {CATEGORIES.map((category) => {
        const items = MENU.filter((item) => item.category === category.id);
        if (items.length === 0) return null;
        return (
          <section key={category.id}>
            <h2 className="text-xl font-semibold">{category.label}</h2>
            <ul className="mt-3 space-y-3">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ALLERGEN_PLACEHOLDER}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section>
        <h2 className="text-xl font-semibold">Gesetzliche Allergengruppen (Ausfüllhilfe)</h2>
        <ul className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          {ALLERGEN_GROUPS.map((group) => (
            <li key={group}>{group}</li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">
        Hinweis zu Kreuzkontakten: Im Food Truck werden verschiedene Zutaten in derselben Küche
        verarbeitet. Spuren anderer Allergene können daher nicht vollständig ausgeschlossen werden.
        Bei Unverträglichkeiten wende dich bitte vor der Bestellung an uns: {LEGAL.phone} ·{" "}
        {LEGAL.email}
      </p>
    </PageShell>
  );
}
