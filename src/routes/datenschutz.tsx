import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/shop/page-shell";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({
    meta: [
      { title: "Datenschutz – Taste It's Tasty" },
      {
        name: "description",
        content: "Informationen zum Datenschutz bei Bestellungen über Taste It's Tasty.",
      },
      { property: "og:title", content: "Datenschutz – Taste It's Tasty" },
      { property: "og:description", content: "Datenschutzhinweise des Food Trucks." },
    ],
  }),
  component: () => (
    <PageShell
      title="Datenschutz"
      intro="Platzhalter – die finale Datenschutzerklärung wird noch ergänzt."
    >
      <p>
        <strong>1. Verantwortliche Stelle</strong>
        <br />
        Wird ergänzt.
      </p>
      <p>
        <strong>2. Verarbeitete Daten</strong>
        <br />
        Für Abholbestellungen werden Name, optional Telefonnummer, Bestellinhalt und Abholzeit
        verarbeitet.
      </p>
      <p>
        <strong>3. Zahlungsdaten</strong>
        <br />
        Zahlungsdaten werden künftig ausschließlich durch den Zahlungsdienstleister verarbeitet.
      </p>
      <p>
        <strong>4. Deine Rechte</strong>
        <br />
        Auskunft, Berichtigung, Löschung, Einschränkung und Widerspruch.
      </p>
    </PageShell>
  ),
});
