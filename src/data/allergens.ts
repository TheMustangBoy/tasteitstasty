/**
 * Zentrale Allergen-Daten.
 *
 * Es werden bewusst KEINE Allergene erfunden: je Produkt steht ausschließlich
 * ein Platzhalter, der vor dem Livebetrieb durch die tatsächlich verwendeten
 * Allergene ersetzt werden muss. Änderungen erfolgen nur hier, nicht in der Route.
 */

export const ALLERGEN_PLACEHOLDER = "[ALLERGENE FÜR DIESES PRODUKT EINTRAGEN]";

/** Die 14 gesetzlichen Allergengruppen nach Anhang II LMIV – als Ausfüllhilfe. */
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
  "Schwefeldioxid und Sulphite",
  "Lupinen",
  "Weichtiere",
] as const;

/** Produkt-ID (aus MENU) -> Allergenangabe. Aktuell überall Platzhalter. */
export const PRODUCT_ALLERGENS: Record<string, string> = {
  "smash-burger": ALLERGEN_PLACEHOLDER,
  "tripple-smash": ALLERGEN_PLACEHOLDER,
  "chili-cheese": ALLERGEN_PLACEHOLDER,
  "oklahoma-smash": ALLERGEN_PLACEHOLDER,
  "bbq-smash": ALLERGEN_PLACEHOLDER,
  "trueffel-smash": ALLERGEN_PLACEHOLDER,
  "chicken-burger": ALLERGEN_PLACEHOLDER,
  "tasty-burger": ALLERGEN_PLACEHOLDER,
  "veggie-burger": ALLERGEN_PLACEHOLDER,
  pommes: ALLERGEN_PLACEHOLDER,
  "suesskartoffel-pommes": ALLERGEN_PLACEHOLDER,
  "curly-fries": ALLERGEN_PLACEHOLDER,
  "trueffel-fries": ALLERGEN_PLACEHOLDER,
};

/** Fallback für Produkte, die hier noch nicht gepflegt sind. */
export function allergensForProduct(productId: string): string {
  return PRODUCT_ALLERGENS[productId] ?? ALLERGEN_PLACEHOLDER;
}

/** Hinweis zu Kreuzkontakten in der gemeinsamen Küche des Food Trucks. */
export const ALLERGEN_CROSS_CONTACT_NOTE =
  "Im Food Truck werden verschiedene Zutaten in derselben Küche verarbeitet. Spuren anderer Allergene können daher nicht vollständig ausgeschlossen werden.";
