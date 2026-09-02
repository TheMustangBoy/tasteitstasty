/**
 * Zentrale Allergen-Daten.
 *
 * Die Angaben beruhen ausschließlich auf dem vom Betreiber bestätigten
 * Aushang des Food Trucks. Nicht aufgeführte Bestandteile müssen vor der
 * Bestellung beim Personal geklärt werden.
 */

/** Bestandteil mit den auf dem Aushang verwendeten Allergen-Kürzeln. */
export const INGREDIENT_ALLERGENS: { ingredient: string; codes: string[] }[] = [
  { ingredient: "Brioche Bun", codes: ["EI", "GL"] },
  { ingredient: "Käse", codes: ["MI"] },
  { ingredient: "Röstzwiebel", codes: ["GL"] },
  { ingredient: "Burgersosse", codes: ["EI", "SF", "GL"] },
  { ingredient: "Ketchup", codes: ["SL"] },
  { ingredient: "Mayonnaise", codes: ["EI", "SF", "GL"] },
  { ingredient: "Senf", codes: ["SF"] },
  { ingredient: "BBQ Sosse", codes: ["GL", "SJ"] },
  { ingredient: "Chicken Patty", codes: ["MI", "SF", "EI"] },
  { ingredient: "Veggie Patty", codes: ["MI", "SF", "EI"] },
];

/** Legende der auf dem Aushang verwendeten Allergen-Kürzel. */
export const ALLERGEN_LEGEND: { code: string; label: string }[] = [
  { code: "GL", label: "Gluten / glutenhaltiges Getreide" },
  { code: "EI", label: "Eier" },
  { code: "MI", label: "Milch" },
  { code: "SF", label: "Senf" },
  { code: "SL", label: "Sellerie" },
  { code: "SJ", label: "Soja" },
];

/** Hinweis zu Kreuzkontakten in der gemeinsamen Küche des Food Trucks. */
export const ALLERGEN_CROSS_CONTACT_NOTE =
  "Im Food Truck werden verschiedene Zutaten in derselben Küche verarbeitet. Spuren anderer Allergene können daher nicht vollständig ausgeschlossen werden.";

/** Hinweis für nicht aufgeführte Bestandteile. */
export const ALLERGEN_UNCONFIRMED_TEXT =
  "Für nicht aufgeführte Bestandteile bitte vor der Bestellung beim Personal nachfragen.";
