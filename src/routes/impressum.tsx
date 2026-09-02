import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/shop/page-shell";
import { LEGAL, LEGAL_PLACEHOLDER_NOTE } from "@/data/legal";

export const Route = createFileRoute("/impressum")({
  head: () => ({
    meta: [
      { title: "Impressum – Taste It's Tasty" },
      { name: "description", content: "Impressum und Anbieterkennzeichnung von Taste It's Tasty." },
      { property: "og:title", content: "Impressum – Taste It's Tasty" },
      { property: "og:description", content: "Anbieterkennzeichnung des Food Trucks." },
    ],
  }),
  component: () => (
    <PageShell title="Impressum" intro={LEGAL_PLACEHOLDER_NOTE}>
      <p>
        <strong>Anbieterkennzeichnung gemäß § 5 DDG</strong>
        <br />
        {LEGAL.operatorName}
        <br />
        {LEGAL.legalForm}
        <br />
        {LEGAL.address}
      </p>
      <p>
        <strong>Vertretungsberechtigt</strong>
        <br />
        {LEGAL.representative}
      </p>
      <p>
        <strong>Kontakt</strong>
        <br />
        Telefon: {LEGAL.phone}
        <br />
        E-Mail: {LEGAL.email}
      </p>
      <p>
        <strong>Registereintrag</strong>
        <br />
        {LEGAL.register}
      </p>
      <p>
        <strong>Umsatzsteuer-Identifikationsnummer</strong>
        <br />
        {LEGAL.vatId}
      </p>
      <p>
        <strong>Zuständige Aufsichtsbehörde</strong>
        <br />
        {LEGAL.supervisoryAuthority}
      </p>
      <p>
        <strong>Verbraucherstreitbeilegung</strong>
        <br />
        {LEGAL.consumerArbitration}
      </p>
      <p>
        <strong>Abholstandort</strong>
        <br />
        {LEGAL.pickupLocation}
        <br />
        Der Abholstandort ist nicht zwingend die Geschäftsanschrift des Betreibers.
      </p>
      <p>
        <strong>Verantwortlich für redaktionelle Inhalte</strong>
        <br />
        {LEGAL.operatorName}, {LEGAL.address}
      </p>
    </PageShell>
  ),
});
