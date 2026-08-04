import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/shop/page-shell";
import { BUSINESS } from "@/data/menu";

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
    <PageShell title="Impressum" intro="Platzhalter – rechtlich verbindliche Angaben folgen.">
      <p>
        <strong>Angaben gemäß § 5 TMG</strong>
        <br />
        {BUSINESS.name}
        <br />
        {BUSINESS.place}, {BUSINESS.street}
        <br />
        {BUSINESS.city}
      </p>
      <p>
        <strong>Vertreten durch</strong>
        <br />
        {BUSINESS.owner}
      </p>
      <p>
        <strong>Kontakt</strong>
        <br />
        Telefon: {BUSINESS.phone}
        <br />
        E-Mail: {BUSINESS.email}
      </p>
      <p>
        <strong>Umsatzsteuer-ID</strong>
        <br />
        Platzhalter – wird ergänzt.
      </p>
    </PageShell>
  ),
});