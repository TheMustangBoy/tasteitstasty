/**
 * Zentrale rechtliche Stammdaten für Impressum, Datenschutz, AGB, Widerruf
 * und Allergene.
 *
 * INTERNER HINWEIS (nicht sichtbar im UI):
 * Die hier hinterlegten Angaben sind die echten Betreiberdaten. Änderungen
 * an Adresse, Kontakt oder Rechtsform müssen zentral in dieser Datei erfolgen.
 *
 * Optionale Felder (representative, register, vatId, supervisoryAuthority)
 * können leer bleiben – die Rechtstexte blenden leere Angaben automatisch aus.
 *
 * Die Rechtstexte im Projekt sind Muster und keine Rechtsberatung.
 */

export const LEGAL = {
  /** Betreiber / verantwortliche Stelle */
  operatorName: "Matthias Stanikowski",
  legalForm: "Einzelunternehmen",
  address: "Dr.-Lagai-Str. 24, 86159 Augsburg",

  /** Kontakt */
  email: "Tasteitstasty@web.de",
  phone: "017623523416",

  /** Optional – nur ausfüllen, wenn zutreffend. Leer = wird nicht angezeigt. */
  representative: "",
  register: "",
  vatId: "",
  supervisoryAuthority: "",

  /** Datenschutz */
  dataProtectionContact: "Tasteitstasty@web.de",
  supervisoryDataAuthority: "Zuständige Datenschutzaufsichtsbehörde des Betreibersitzes",

  /** Streitbeilegung (Stand 2026: kein EU-OS-Link mehr, Plattform eingestellt) */
  consumerArbitration:
    "Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",

  /**
   * Steuerhinweis für die Preisangaben (AGB).
   * Der tatsächliche Steuerstatus ist noch offen; daher wird keine definitive
   * Umsatzsteuer- oder Kleinunternehmer-Aussage getroffen.
   */
  taxNote:
    "Ein etwaig anfallender gesetzlicher Umsatzsteueranteil ist im angegebenen Preis enthalten.",

  /** Abholstandort – bewusst getrennt von der Geschäftsanschrift */
  pickupLocation: "REWE-Parkplatz, Kopernikusstraße 2, 85221 Dachau",

  /** Marke / Copyright */
  brand: "Taste It's Tasty",
} as const;

