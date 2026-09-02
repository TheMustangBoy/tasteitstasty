import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/shop/page-shell";
import { LEGAL } from "@/data/legal";

/**
 * INTERNER HINWEIS: Alle Angaben stammen aus src/data/legal.ts.
 * Optionale Blöcke werden nur gerendert, wenn dort ein Wert hinterlegt ist.
 */
export const Route = createFileRoute("/impressum")({
  head: () => ({
    meta: [
      { title: "Impressum – Taste It's Tasty" },
      { name: "description", content: "Impressum und Anbieterkennzeichnung von Taste It's Tasty." },
      { property: "og:title", content: "Impressum – Taste It's Tasty" },
      { property: "og:description", content: "Anbieterkennzeichnung des Food Trucks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PageShell title="Impressum" intro="Anbieterkennzeichnung und Kontaktangaben.">
      <p>
        <strong>Anbieter gemäß § 5 DDG</strong>
        <br />
        {LEGAL.brand}
        <br />
        Inhaber: {LEGAL.operatorName}
        <br />
        Rechtsform: {LEGAL.legalForm}
        <br />
        Geschäftsanschrift: {LEGAL.address}
      </p>

      {LEGAL.representative && (
        <p>
          <strong>Vertretungsberechtigte Person</strong>
          <br />
          {LEGAL.representative}
        </p>
      )}

      <p>
        <strong>Kontakt</strong>
        <br />
        Telefon: {LEGAL.phone}
        <br />
        E-Mail: {LEGAL.email}
      </p>

      {LEGAL.register && (
        <p>
          <strong>Registereintrag</strong>
          <br />
          {LEGAL.register}
        </p>
      )}

      {LEGAL.vatId && (
        <p>
          <strong>Umsatzsteuer-Identifikationsnummer</strong>
          <br />
          {LEGAL.vatId}
        </p>
      )}

      {LEGAL.supervisoryAuthority && (
        <p>
          <strong>Zuständige Aufsichtsbehörde</strong>
          <br />
          {LEGAL.supervisoryAuthority}
        </p>
      )}

      <p>
        <strong>Abholstandort</strong>
        <br />
        {LEGAL.pickupLocation}
        <br />
        Der Abholstandort ist der Verkaufsstandort des Food Trucks und nicht die Geschäftsanschrift
        des Anbieters.
      </p>

      <p>
        <strong>Verbraucherstreitbeilegung</strong>
        <br />
        {LEGAL.consumerArbitration}
      </p>
    </PageShell>
  ),
});
