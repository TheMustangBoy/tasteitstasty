/**
 * Zentrale Platzhalter für alle rechtlich relevanten Angaben.
 *
 * Diese Werte werden von Impressum, Datenschutz, AGB, Widerruf und Allergene
 * genutzt. Vor dem Livebetrieb müssen alle Platzhalter in eckigen Klammern
 * durch die echten Angaben ersetzt werden.
 *
 * Hinweis: Die Rechtstexte im Projekt sind vorbereitete Muster und keine
 * anwaltliche Rechtsberatung.
 */

export const LEGAL = {
  /** Betreiber / verantwortliche Stelle */
  operatorName: "[BETREIBERNAME EINTRAGEN]",
  legalForm: "[RECHTSFORM EINTRAGEN]",
  representative: "[VERTRETUNGSBERECHTIGTE PERSON EINTRAGEN]",
  address: "[GESCHÄFTSANSCHRIFT EINTRAGEN]",

  /** Kontakt */
  email: "[E-MAIL EINTRAGEN]",
  phone: "[TELEFON EINTRAGEN]",

  /** Register & Steuern */
  register: "[REGISTER + NUMMER FALLS VORHANDEN]",
  vatId: "[UST-ID FALLS VORHANDEN]",

  /** Aufsicht & Streitbeilegung */
  supervisoryAuthority: "[AUFSICHTSBEHÖRDE FALLS ERFORDERLICH]",
  consumerArbitration: "[ANGABE VERBRAUCHERSCHLICHTUNG FESTLEGEN]",

  /** Datenschutz */
  dataProtectionContact: "[DATENSCHUTZ-KONTAKT EINTRAGEN]",
  supervisoryDataAuthority: "[ZUSTÄNDIGE DATENSCHUTZAUFSICHT EINTRAGEN]",

  /** Abholstandort (nicht automatisch die Geschäftsanschrift) */
  pickupLocation: "REWE-Parkplatz, Kopernikusstraße 2, 85221 Dachau",

  /** Marke / Copyright */
  brand: "Taste It's Tasty",
} as const;

/** Kurzer Standardhinweis, dass ein Platzhalter noch gefüllt werden muss. */
export const LEGAL_PLACEHOLDER_NOTE =
  "Alle Angaben in eckigen Klammern sind Platzhalter und müssen vor dem Livebetrieb ergänzt werden.";
