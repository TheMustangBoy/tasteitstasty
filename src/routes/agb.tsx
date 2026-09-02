import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/shop/page-shell";
import { LEGAL } from "@/data/legal";

/**
 * INTERNER HINWEIS: Betreiberangaben stammen aus src/data/legal.ts (Musterdaten).
 * Kein EU-OS-Link, da die Plattform eingestellt ist.
 */
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PageShell
      title="Allgemeine Geschäftsbedingungen"
      intro="Bedingungen für Bestellungen zur Abholung am Food Truck."
    >
      <p>
        <strong>1. Geltungsbereich und Vertragspartner</strong>
        <br />
        Diese Bedingungen gelten für alle über diese Website aufgegebenen Bestellungen von Speisen
        zur Abholung. Vertragspartner sind du als Kundin oder Kunde und {LEGAL.operatorName},{" "}
        {LEGAL.address}. Eine Lieferung sowie Catering werden nicht angeboten.
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
        <strong>3. Leistungsgegenstand</strong>
        <br />
        Geschuldet ist die Zubereitung der bestellten Speisen und deren Bereitstellung zur Abholung
        am Food Truck. Alle Speisen werden frisch zubereitet und sind nur solange verfügbar, wie
        Vorrat und Kapazität reichen. Ist ein Produkt oder eine Kategorie nicht verfügbar oder sind
        Bestellungen pausiert, kann keine Bestellung angenommen werden. Bereits gezahlte Beträge
        werden in diesem Fall vollständig erstattet.
      </p>

      <p>
        <strong>4. Abholung, Abholzeiten und Kapazität</strong>
        <br />
        Die Abholung erfolgt am Standort {LEGAL.pickupLocation} innerhalb der angegebenen
        Öffnungszeiten. Abholzeiten werden mit einem Mindestvorlauf von 15 Minuten im
        5-Minuten-Takt vergeben; pro Zeitfenster kann nur eine begrenzte Anzahl an Bestellungen
        angenommen werden. Die verbindliche Prüfung der Kapazität erfolgt serverseitig bei
        Bestellabschluss.
      </p>

      <p>
        <strong>5. Preise</strong>
        <br />
        Alle angegebenen Preise sind Endpreise in Euro. {LEGAL.taxNote} Maßgeblich ist der zum
        Zeitpunkt des Bestellabschlusses serverseitig berechnete Preis.
      </p>


      <p>
        <strong>6. Zahlung</strong>
        <br />
        Die Zahlung ist wahlweise online im Voraus über unseren Zahlungsdienstleister Stripe (Karte
        sowie unterstützte Wallet-Verfahren wie Apple Pay und Google Pay) oder bei der Abholung am
        Truck in bar oder per Karte möglich. Bei Onlinezahlung wird die Bestellung erst nach
        bestätigter Zahlung angelegt.
      </p>

      <p>
        <strong>7. Kundendaten</strong>
        <br />
        Für die Abwicklung verarbeiten wir Name, Telefonnummer, eine optionale Anmerkung, den Inhalt
        des Warenkorbs, die gewählte Abholzeit sowie Zahlungsart und Zahlungsstatus. Name und
        Telefonnummer sind erforderlich, um die Bestellung zuzuordnen und dich bei Rückfragen oder
        Verzögerungen erreichen zu können. Einzelheiten stehen in unseren{" "}
        <Link to="/datenschutz" className="text-primary hover:underline">
          Datenschutzhinweisen
        </Link>
        .
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
        <strong>9. Kein Widerrufsrecht</strong>
        <br />
        Bei schnell verderblichen Waren besteht nach § 312g Abs. 2 Nr. 2 BGB kein gesetzliches
        Widerrufsrecht. Einzelheiten erklären wir auf der Seite{" "}

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
        <strong>11. Mängelrechte, Allergene und Kreuzkontakte</strong>
        <br />
        Es gelten die gesetzlichen Mängelrechte. Beanstandungen sollten möglichst unmittelbar bei
        der Abholung angezeigt werden, damit wir Abhilfe schaffen können. Angaben zu allergenen
        Zutaten findest du unter{" "}
        <Link to="/allergene" className="text-primary hover:underline">
          Allergene
        </Link>
        . Bei Unverträglichkeiten sprich uns bitte zusätzlich vor der Bestellung an, da im Truck
        Kreuzkontakte nicht vollständig ausgeschlossen werden können.
      </p>

      <p>
        <strong>12. Haftung</strong>
        <br />
        Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von
        Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher
        Vertragspflichten ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden
        begrenzt. Im Übrigen ist die Haftung ausgeschlossen. Zwingende gesetzliche Regelungen,
        insbesondere nach dem Produkthaftungsgesetz, bleiben unberührt.
      </p>

      <p>
        <strong>13. Streitbeilegung</strong>
        <br />
        {LEGAL.consumerArbitration}
      </p>

      <p>
        <strong>14. Schlussbestimmungen</strong>
        <br />
        Es gilt das Recht der Bundesrepublik Deutschland. Zwingende Verbraucherschutzvorschriften
        des Staates deines gewöhnlichen Aufenthalts bleiben unberührt. Sollten einzelne Bestimmungen
        unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
      </p>
    </PageShell>
  ),
});
