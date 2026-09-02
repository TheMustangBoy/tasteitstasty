import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/shop/page-shell";
import { LEGAL, LEGAL_PLACEHOLDER_NOTE } from "@/data/legal";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({
    meta: [
      { title: "Datenschutz – Taste It's Tasty" },
      {
        name: "description",
        content: "Informationen zum Datenschutz bei Abholbestellungen über Taste It's Tasty.",
      },
      { property: "og:title", content: "Datenschutz – Taste It's Tasty" },
      { property: "og:description", content: "Datenschutzhinweise des Food Trucks." },
    ],
  }),
  component: () => (
    <PageShell title="Datenschutzerklärung" intro={LEGAL_PLACEHOLDER_NOTE}>
      <p>
        <strong>1. Verantwortliche Stelle (Art. 4 Nr. 7 DSGVO)</strong>
        <br />
        {LEGAL.operatorName}
        <br />
        {LEGAL.address}
        <br />
        Telefon: {LEGAL.phone}
        <br />
        E-Mail: {LEGAL.email}
        <br />
        Datenschutzkontakt: {LEGAL.dataProtectionContact}
      </p>

      <p>
        <strong>2. Aufruf der Website (Hosting und Zugriffsdaten)</strong>
        <br />
        Beim Aufruf der Website verarbeitet unser Hosting-Dienstleister technisch notwendige
        Zugriffsdaten (z. B. IP-Adresse, Zeitpunkt, aufgerufene Adresse, übertragene Datenmenge,
        Browser- und Geräteinformationen). Zweck ist die Auslieferung der Seite, die Stabilität und
        die IT-Sicherheit. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an
        einem sicheren und störungsfreien Betrieb).
      </p>

      <p>
        <strong>3. Abholbestellungen</strong>
        <br />
        Für eine Bestellung zur Abholung verarbeiten wir: Name, Telefonnummer, optionale Anmerkung,
        Bestellinhalt (inkl. abgewählter Zutaten und Extras), gewünschte Abholzeit, Bestellnummer,
        Gesamtbetrag sowie Zahlungsart und Zahlungsstatus. Die Verarbeitung erfolgt zur Erfüllung
        des Vertrags bzw. zur Durchführung vorvertraglicher Maßnahmen nach Art. 6 Abs. 1 lit. b
        DSGVO. Ohne Name und Telefonnummer kann eine Bestellung nicht zugeordnet und nicht
        abgewickelt werden.
      </p>

      <p>
        <strong>4. Backend und Datenbank (Auftragsverarbeitung)</strong>
        <br />
        Bestell- und Katalogdaten werden in einer gehosteten Datenbank (Supabase) gespeichert und
        dort für den Betrieb des Bestellsystems verarbeitet. Der Anbieter ist als Auftragsverarbeiter
        nach Art. 28 DSGVO tätig. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b und lit. f DSGVO.
      </p>

      <p>
        <strong>5. Zahlungsabwicklung bei Onlinezahlung</strong>
        <br />
        Bei Zahlung im Voraus wird die Zahlung über den Zahlungsdienstleister Stripe abgewickelt.
        Dabei werden die für die Zahlung erforderlichen Daten (u. a. Betrag, Bestellreferenz,
        Zahlungs- und Gerätedaten) direkt an Stripe übermittelt und dort eigenverantwortlich
        verarbeitet. Vollständige Karten- oder Wallet-Daten werden von dieser Website nicht erhoben
        und nicht gespeichert; wir erhalten lediglich Zahlungsstatus und Referenzkennungen.
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Bei Zahlung vor Ort entfällt diese
        Verarbeitung.
      </p>

      <p>
        <strong>6. Speicherung auf deinem Endgerät (§ 25 TDDDG)</strong>
        <br />
        Wir speichern lokal in deinem Browser ausschließlich technisch notwendige Informationen, die
        du für die Nutzung der Bestellfunktion ausdrücklich angefordert hast: den Inhalt deines
        Warenkorbs und deine zuletzt aufgegebene Bestellung, einen technischen Checkout-Schlüssel
        zur Vermeidung doppelter Zahlungen sowie – nur im internen Adminbereich – die Einstellung für
        Benachrichtigungstöne und einen Zwischenspeicher für Katalog- und Einstellungsdaten. Diese
        Speicherung ist nach § 25 Abs. 2 Nr. 2 TDDDG einwilligungsfrei. Ein Einwilligungsbanner ist
        daher nicht erforderlich. Du kannst diese Daten jederzeit über die Einstellungen deines
        Browsers löschen.
      </p>

      <p>
        <strong>7. Keine Analyse-, Tracking- oder Marketing-Dienste</strong>
        <br />
        Diese Website setzt keine Analyse-, Tracking-, Profiling- oder Werbedienste ein. Es findet
        keine Reichweitenmessung und keine Weitergabe zu Werbezwecken statt.
      </p>

      <p>
        <strong>8. Push-Benachrichtigungen (nur interner Adminbereich)</strong>
        <br />
        Angemeldete Mitarbeitende können im internen Adminbereich Push-Benachrichtigungen über neue
        Bestellungen aktivieren. Dabei wird die vom Browser erzeugte Push-Adresse (Endpoint) samt
        zugehöriger Schlüssel gespeichert, um Benachrichtigungen zustellen zu können.
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (Interesse an zeitnaher
        Bestellbearbeitung), die Aktivierung erfolgt freiwillig und kann jederzeit widerrufen
        werden. Für Gäste des Shops werden keine Push-Daten verarbeitet.
      </p>

      <p>
        <strong>9. Empfänger</strong>
        <br />
        Empfänger sind ausschließlich: der Hosting-Dienstleister, der Datenbank-/Backend-Anbieter,
        bei Onlinezahlung der Zahlungsdienstleister sowie – im gesetzlich erforderlichen Umfang –
        Steuerberatung und Behörden. Eine darüber hinausgehende Weitergabe erfolgt nicht.
      </p>

      <p>
        <strong>10. Drittlandübermittlung</strong>
        <br />
        Soweit eingesetzte Dienstleister Daten außerhalb der EU/des EWR verarbeiten, erfolgt dies auf
        Grundlage der Standardvertragsklauseln der EU-Kommission oder eines Angemessenheitsbeschlusses
        (Art. 44 ff. DSGVO).
      </p>

      <p>
        <strong>11. Speicherdauer</strong>
        <br />
        Bestelldaten werden für die Abwicklung und Rückfragen gespeichert und anschließend gelöscht,
        soweit keine gesetzlichen Aufbewahrungspflichten bestehen. Aufgrund handels- und
        steuerrechtlicher Pflichten (§ 147 AO, § 257 HGB) werden abrechnungsrelevante Unterlagen
        regelmäßig 6 bzw. 10 Jahre aufbewahrt. Technische Zugriffsdaten werden nur kurzzeitig
        vorgehalten.
      </p>

      <p>
        <strong>12. Deine Rechte</strong>
        <br />
        Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
        Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) sowie ein
        Widerspruchsrecht gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21
        DSGVO). Erteilte Einwilligungen kannst du jederzeit mit Wirkung für die Zukunft widerrufen.
      </p>

      <p>
        <strong>13. Beschwerderecht</strong>
        <br />
        Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, insbesondere bei der für
        uns zuständigen Behörde: {LEGAL.supervisoryDataAuthority}
      </p>
    </PageShell>
  ),
});
