/**
 * Zentrale Allergen-Daten.
 *
 * Die Angaben beruhen ausschließlich auf den vom Betreiber bestätigten
 * Zutaten-Allergenen. Es werden bewusst KEINE Allergene erfunden: nicht
 * abschließend geklärte Bestandteile werden ausdrücklich als offen markiert.
 * Änderungen erfolgen nur hier, nicht in der Route.
 */

/** Interner Platzhalter – wird öffentlich nie angezeigt. */
export const ALLERGEN_PLACEHOLDER = "[ALLERGENE FÜR DIESES PRODUKT EINTRAGEN]";

/** Kundenverständlicher Text für noch ungeklärte Produkte. */
export const ALLERGEN_UNCONFIRMED_TEXT =
  "Allergenangaben noch nicht abschließend bestätigt – bitte vor der Bestellung beim Personal nachfragen.";

/** Die 14 gesetzlichen Allergengruppen nach Anhang II LMIV – als Legende. */
export const ALLERGEN_GROUPS = [
  "Glutenhaltiges Getreide",
  "Krebstiere",
  "Eier",
  "Fische",
  "Erdnüsse",
  "Sojabohnen",
  "Milch (inkl. Laktose)",
  "Schalenfrüchte (Nüsse)",
  "Sellerie",
  "Senf",
  "Sesamsamen",
  "Schwefeldioxid und Sulfite",
  "Lupinen",
  "Weichtiere",
] as const;

const COCKTAIL_NOTE =
  "Zusätzliche Allergene der Cocktail-Sauce noch nicht abschließend bestätigt.";

/** Produkt-ID (aus MENU) -> Allergenangabe. */
export const PRODUCT_ALLERGENS: Record<string, string> = {
  "smash-burger": `Enthält: Eier, Glutenhaltiges Getreide. ${COCKTAIL_NOTE}`,
  "tripple-smash": "Enthält: Eier, Glutenhaltiges Getreide.",
  "chili-cheese":
    "Enthält: Eier, Glutenhaltiges Getreide, Milch. Zusätzliche Allergene der Chili-Sauce noch nicht abschließend bestätigt.",
  "oklahoma-smash": "Enthält: Eier, Glutenhaltiges Getreide, Sellerie, Senf.",
  "bbq-smash": "Enthält: Eier, Glutenhaltiges Getreide, Sojabohnen.",
  "trueffel-smash":
    "Enthält: Eier, Glutenhaltiges Getreide. Zusätzliche Allergene der Trüffel-Remoulade noch nicht abschließend bestätigt.",
  "chicken-burger": `Enthält: Eier, Glutenhaltiges Getreide, Milch, Senf. ${COCKTAIL_NOTE}`,
  "tasty-burger": `Enthält: Eier, Glutenhaltiges Getreide, Sojabohnen. ${COCKTAIL_NOTE}`,
  "veggie-burger": `Enthält: Eier, Glutenhaltiges Getreide, Milch, Senf. ${COCKTAIL_NOTE}`,
  pommes: "Keine deklarationspflichtigen Allergene bekannt.",
  "suesskartoffel-pommes": ALLERGEN_UNCONFIRMED_TEXT,
  "curly-fries": "Enthält: Glutenhaltiges Getreide.",
  "trueffel-fries":
    "Allergenangaben noch nicht abschließend bestätigt – insbesondere Trüffel-Sauce bzw. Trüffel-Remoulade. Bitte vor der Bestellung beim Personal nachfragen.",
};

/** Fallback für Produkte, die hier noch nicht gepflegt sind. */
export function allergensForProduct(productId: string): string {
  return PRODUCT_ALLERGENS[productId] ?? ALLERGEN_UNCONFIRMED_TEXT;
}

/** Hinweis zu Kreuzkontakten in der gemeinsamen Küche des Food Trucks. */
export const ALLERGEN_CROSS_CONTACT_NOTE =
  "Im Food Truck werden verschiedene Zutaten in derselben Küche verarbeitet. Spuren anderer Allergene können daher nicht vollständig ausgeschlossen werden.";
