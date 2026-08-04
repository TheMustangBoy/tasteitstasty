import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/shop/page-shell";

export const Route = createFileRoute("/agb")({
  head: () => ({
    meta: [
      { title: "AGB – Taste It's Tasty" },
      {
        name: "description",
        content: "Allgemeine Geschäftsbedingungen für Abholbestellungen bei Taste It's Tasty.",
      },
      { property: "og:title", content: "AGB – Taste It's Tasty" },
      { property: "og:description", content: "Bedingungen für Abholbestellungen." },
    ],
  }),
  component: () => (
    <PageShell title="AGB" intro="Platzhalter – die finalen Geschäftsbedingungen folgen.">
      <p>
        <strong>1. Geltungsbereich</strong>
        <br />
        Diese Bedingungen gelten für Bestellungen zur Abholung am Food Truck.
      </p>
      <p>
        <strong>2. Bestellung und Abholung</strong>
        <br />
        Bestellungen sind mit mindestens 15 Minuten Vorlauf möglich. Abholzeiten werden im
        5-Minuten-Takt vergeben; pro Zeitfenster sind maximal vier Bestellungen möglich.
      </p>
      <p>
        <strong>3. Preise und Zahlung</strong>
        <br />
        Alle Preise verstehen sich inklusive gesetzlicher Mehrwertsteuer. Bezahlt werden kann online
        oder bei Abholung.
      </p>
      <p>
        <strong>4. Stornierung</strong>
        <br />
        Wird ergänzt.
      </p>
    </PageShell>
  ),
});