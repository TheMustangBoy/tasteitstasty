/**
 * Zentrale rechtliche Stammdaten für Impressum, Datenschutz, AGB, Widerruf
 * und Allergene.
 *
 * INTERNER HINWEIS (nicht sichtbar im UI):
 * Die hier hinterlegten Angaben sind bewusst neutrale Musterdaten und enthalten
 * keine echten personenbezogenen Daten. Vor dem Livebetrieb müssen sämtliche
 * Werte durch die tatsächlichen Betreiberangaben ersetzt werden.
 *
 * Optionale Felder (representative, register, vatId, supervisoryAuthority)
 * können leer bleiben – die Rechtstexte blenden leere Angaben automatisch aus.
 *
 * Die Rechtstexte im Projekt sind Muster und keine Rechtsberatung.
 */

export const LEGAL = {
  /** Betreiber / verantwortliche Stelle */
  operatorName: "Muster Betreiber",
  address: "Musterstraße 1, 00000 Musterstadt",

  /** Kontakt */
  email: "kontakt@beispiel.de",
  phone: "01234 567890",

  /** Optional – nur ausfüllen, wenn zutreffend. Leer = wird nicht angezeigt. */
  representative: "",
  register: "",
  vatId: "",
  supervisoryAuthority: "",

  /** Datenschutz */
  dataProtectionContact: "kontakt@beispiel.de",
  supervisoryDataAuthority: "Zuständige Datenschutzaufsichtsbehörde des Betreibersitzes",

  /** Streitbeilegung (Stand 2026: kein EU-OS-Link mehr, Plattform eingestellt) */
  consumerArbitration:
    "Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",

  /** Abholstandort – bewusst getrennt von der Geschäftsanschrift */
  pickupLocation: "REWE-Parkplatz, Kopernikusstraße 2, 85221 Dachau",

  /** Marke / Copyright */
  brand: "Taste It's Tasty",
} as const;
