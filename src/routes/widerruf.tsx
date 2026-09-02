import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/shop/page-shell";
import { LEGAL, LEGAL_PLACEHOLDER_NOTE } from "@/data/legal";

export const Route = createFileRoute("/widerruf")({
  head: () => ({
    meta: [
      { title: "Widerrufsrecht – Taste It's Tasty" },
      {
        name: "description",
        content:
          "Informationen zum Widerrufsrecht bei Abholbestellungen von Speisen mit fester Abholzeit.",
      },
      { property: "og:title", content: "Widerrufsrecht – Taste It's Tasty" },
      {
        property: "og:description",
        content: "Warum bei terminierten Speisenbestellungen kein Widerrufsrecht besteht.",
      },
    ],
  }),
  component: () => (
    <PageShell
      title="Widerrufsrecht"
      intro="Informationen zum gesetzlichen Widerrufsrecht bei Bestellungen mit fester Abholzeit."
    >
      <p>
        <strong>1. Kein gesetzliches Widerrufsrecht</strong>
        <br />
        Bei den über diese Website bestellbaren Speisen wird ein konkreter
        Abholzeitpunkt vereinbart. Für die Lieferung von Speisen und Getränken zu einem bestimmten
        Termin oder innerhalb eines genau angegebenen Zeitraums besteht nach § 312g Abs. 2 Nr. 9 BGB
        kein gesetzliches Widerrufsrecht. Das gilt unabhängig davon, ob online im Voraus oder erst
        bei der Abholung bezahlt wird.
      </p>

      <p>
        <strong>2. Was das praktisch bedeutet</strong>
        <br />
        Du kannst eine bestätigte Bestellung nicht einseitig innerhalb einer Widerrufsfrist
        rückgängig machen. Sobald die Bestellung bestätigt ist, planen wir Ware, Zubereitung und das
        Zeitfenster fest ein.
      </p>

      <p>
        <strong>3. Widerruf ist nicht dasselbe wie eine Stornierung</strong>
        <br />
        Ein Widerruf ist ein gesetzliches Recht, das hier nicht besteht. Eine Stornierung ist
        dagegen eine freiwillige Kulanzlösung: Wir können eine Bestellung aufheben, solange die
        Zubereitung noch nicht begonnen hat und wir ausdrücklich zustimmen. Ein Anspruch darauf
        besteht nicht.
      </p>

      <p>
        <strong>4. Stornowunsch mitteilen</strong>
        <br />
        Bitte melde dich so früh wie möglich telefonisch unter {LEGAL.phone} oder per E-Mail an{" "}
        {LEGAL.email} und nenne dabei deine Bestellnummer. Wurde online bezahlt und stimmen wir der
        Stornierung zu, erstatten wir den Betrag über das genutzte Zahlungsmittel zurück.
      </p>

      <p>
        <strong>5. Gesetzliche Rechte bleiben bestehen</strong>
        <br />
        Unabhängig vom Widerrufsrecht bleiben deine gesetzlichen Mängelrechte sowie Ansprüche bei
        nicht erbrachter Leistung selbstverständlich bestehen.
      </p>

      <p className="text-xs text-muted-foreground">{LEGAL_PLACEHOLDER_NOTE}</p>
    </PageShell>
  ),
});
