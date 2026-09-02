import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/shop/page-shell";
import { LEGAL } from "@/data/legal";

/**
 * INTERNER HINWEIS: Begründung bewusst ausschließlich über § 312g Abs. 2 Nr. 2 BGB
 * (schnell verderbliche Waren). Nr. 1 wird nicht herangezogen. Nr. 9 wird nicht
 * verwendet, da der Shop keine Lieferung anbietet.
 */

export const Route = createFileRoute("/widerruf")({
  head: () => ({
    meta: [
      { title: "Widerrufsrecht – Taste It's Tasty" },
      {
        name: "description",
        content:
          "Informationen zum Widerrufsrecht bei Abholbestellungen frisch zubereiteter Speisen.",
      },
      { property: "og:title", content: "Widerrufsrecht – Taste It's Tasty" },
      {
        property: "og:description",
        content: "Warum bei frisch zubereiteten Speisen kein Widerrufsrecht besteht.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PageShell
      title="Widerrufsrecht"
      intro="Informationen zum gesetzlichen Widerrufsrecht bei Abholbestellungen."
    >
      <p>
        <strong>1. Kein gesetzliches Widerrufsrecht</strong>
        <br />
        Über diese Website werden ausschließlich frisch zubereitete Speisen zur Abholung bestellt.
        Bei Verträgen über die Lieferung von Waren, die schnell verderben können oder deren
        Verfallsdatum schnell überschritten würde, besteht nach § 312g Abs. 2 Nr. 2 BGB kein
        gesetzliches Widerrufsrecht.
      </p>

      <p>
        <strong>2. Was das praktisch bedeutet</strong>
        <br />
        Eine bestätigte Bestellung kann nicht einseitig innerhalb einer Widerrufsfrist rückgängig
        gemacht werden. Das gilt unabhängig davon, ob online im Voraus oder erst bei der Abholung
        bezahlt wird. Nach der Bestätigung planen wir Ware, Zubereitung und Abholzeitfenster fest
        ein.
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
        nicht erbrachter Leistung vollständig bestehen.
      </p>
    </PageShell>
  ),
});
