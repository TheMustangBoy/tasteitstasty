import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/shop/page-shell";
import { LEGAL, LEGAL_PLACEHOLDER_NOTE } from "@/data/legal";

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
    <PageShell title="Allgemeine Geschäftsbedingungen" intro={LEGAL_PLACEHOLDER_NOTE}>
      <p>
        <strong>1. Geltungsbereich und Vertragspartner</strong>
        <br />
        Diese Bedingungen gelten für alle über diese Website aufgegebenen Bestellungen von Speisen
        zur Abholung. Vertragspartner ist {LEGAL.operatorName}, {LEGAL.address}. Eine
        Lieferung wird nicht angeboten.
      </p>

      <p>
        <strong>2. Vertragsschluss</strong>
        <br />
        Die Darstellung der Speisekarte ist kein bindendes Angebot. Mit dem Absenden der Bestellung
        über die Schaltfläche „Zahlungspflichtig bestellen“ bzw. mit dem Abschluss der Onlinezahlung
        gibst du ein verbindliches Angebot ab. Der Vertrag kommt mit der Bestätigung der Bestellung
        (Anzeige der Bestellnummer bzw. Bestätigung der Zahlung) zustande.
      </p>

      <p>
        <strong>3. Verfügbarkeit</strong>
        <br />
        Alle Speisen werden frisch zubereitet und sind nur solange verfügbar, wie der Vorrat und die
        Kapazität reichen. Ist ein Produkt oder eine Kategorie zum Bestellzeitpunkt nicht verfügbar
        oder sind Bestellungen pausiert, kann keine Bestellung angenommen werden. Bereits gezahlte
        Beträge werden in diesem Fall vollständig erstattet.
      </p>

      <p>
        <strong>4. Abholzeiten und Kapazität</strong>
        <br />
        Die Abholung erfolgt am Standort {LEGAL.pickupLocation} innerhalb der angegebenen
        Öffnungszeiten. Abholzeiten werden mit einem Mindestvorlauf von 15 Minuten im
        5-Minuten-Takt vergeben; pro Zeitfenster können maximal vier Bestellungen angenommen
        werden. Die verbindliche Prüfung der Kapazität erfolgt serverseitig bei Bestellabschluss.
      </p>

      <p>
        <strong>5. Preise und Umsatzsteuer</strong>
        <br />
        Alle angegebenen Preise sind Endpreise in Euro und enthalten die gesetzliche Umsatzsteuer.
        Maßgeblich ist der zum Zeitpunkt des Bestellabschlusses serverseitig berechnete Preis.
      </p>

      <p>
        <strong>6. Zahlung</strong>
        <br />
        Die Zahlung ist wahlweise online im Voraus (Karte bzw. unterstützte Wallet-Verfahren über
        unseren Zahlungsdienstleister) oder bei Abholung am Truck in bar oder per Karte möglich.
        Bei Onlinezahlung wird die Bestellung erst nach bestätigter Zahlung angelegt.
      </p>

      <p>
        <strong>7. Kundendaten</strong>
        <br />
        Name und Telefonnummer sind erforderlich, um die Bestellung zuzuordnen und dich bei
        Rückfragen oder Verzögerungen erreichen zu können. Bitte gib nur zutreffende Daten an.
      </p>

      <p>
        <strong>8. Verspätete oder nicht erfolgte Abholung</strong>
        <br />
        Frisch zubereitete Speisen sind nur begrenzt haltbar. Bei erheblicher Verspätung kann die
        Qualität beeinträchtigt sein; eine Neuzubereitung ist in diesem Fall nicht geschuldet. Wird
        eine bezahlte Bestellung nicht abgeholt, besteht kein Anspruch auf Erstattung, soweit die
        Speisen bereits zubereitet wurden und uns kein Verschulden trifft.
      </p>

      <p>
        <strong>9. Kein Widerrufsrecht bei terminierter Abholung</strong>
        <br />
        Bei der Lieferung von Speisen und Getränken zu einem bestimmten Termin (gesetzliche Kategorie) oder innerhalb eines
        genau angegebenen Zeitraums besteht nach § 312g Abs. 2 Nr. 9 BGB kein gesetzliches
        Widerrufsrecht. Einzelheiten dazu erklären wir auf der Seite{" "}
        <Link to="/widerruf" className="text-primary hover:underline">
          Widerrufsrecht
        </Link>
        .
      </p>

      <p>
        <strong>10. Freiwillige Stornierung</strong>
        <br />
        Eine Stornierung ist keine gesetzliche Pflicht unsererseits, sondern freiwillig. Sie ist nur
        möglich, solange die Zubereitung noch nicht begonnen hat und wir ausdrücklich zustimmen.
        Bitte melde dich dafür so früh wie möglich telefonisch unter {LEGAL.phone}.
      </p>

      <p>
        <strong>11. Mängelrechte</strong>
        <br />
        Es gelten die gesetzlichen Mängelrechte. Beanstandungen sollten möglichst unmittelbar bei
        der Abholung angezeigt werden, damit wir Abhilfe schaffen können.
      </p>

      <p>
        <strong>12. Allergene und Unverträglichkeiten</strong>
        <br />
        Angaben zu allergenen Zutaten findest du unter{" "}
        <Link to="/allergene" className="text-primary hover:underline">
          Allergene
        </Link>
        . Bei Unverträglichkeiten sprich uns bitte zusätzlich vor der Bestellung an, da im Truck
        Kreuzkontakte nicht vollständig ausgeschlossen werden können.
      </p>

      <p>
        <strong>13. Haftung</strong>
        <br />
        Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von
        Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher
        Vertragspflichten ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden
        begrenzt. Im Übrigen ist die Haftung ausgeschlossen. Zwingende gesetzliche Regelungen,
        insbesondere nach dem Produkthaftungsgesetz, bleiben unberührt.
      </p>

      <p>
        <strong>14. Verbraucherstreitbeilegung</strong>
        <br />
        {LEGAL.consumerArbitration}
      </p>

      <p>
        <strong>15. Schlussbestimmungen</strong>
        <br />
        Es gilt das Recht der Bundesrepublik Deutschland. Zwingende Verbraucherschutzvorschriften
        des Staates deines gewöhnlichen Aufenthalts bleiben unberührt. Sollten einzelne Bestimmungen
        unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
      </p>
    </PageShell>
  ),
});
