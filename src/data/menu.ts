export type Category = string;

/** Extra/Topping – zubuchbar pro Produkt. */
export type Extra = { id: string; name: string; price: number };

/**
 * Auswahl-Option (z. B. „Menü mit Pommes“) – optional und mehrfach wählbar.
 * `priceDelta` ist der Aufpreis (oder Abschlag) zum Basispreis.
 */
export type SelectionOption = {
  id: string;
  name: string;
  priceDelta: number;
  active?: boolean;
};

/** @deprecated Alter Name – bleibt für gespeicherte Daten kompatibel. */
export type Variant = SelectionOption;

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: Category;
  patties?: number;
  ingredients: string[];
  description?: string;
  ingredientsPlaceholder?: boolean;
  tag?: string;
  vegetarian?: boolean;
  imageUrl?: string;
  /** Auf der Startseite unter „Beliebt am Truck“ hervorgehoben. */
  homeFeatured?: boolean;
  /** Abwählbare Zutaten (Teilmenge von ingredients). */
  removable?: string[];
  extras?: Extra[];
  /** Optionale Auswahl-Optionen (Mehrfachwahl möglich). */
  options?: SelectionOption[];
};

/** Zutaten, die abgewählt werden können – sofern im Produkt enthalten. */
export const REMOVABLE = [
  "Tomate",
  "Zwiebel",
  "Käse",
  "Soße",
  "Salat",
  "Gurke",
  "Jalapeños",
] as const;

export const BACON_EXTRA = { id: "bacon", name: "Bacon", price: 1.0 };

/** Standard-Extras des Katalogs. */
export const DEFAULT_EXTRAS: Extra[] = [
  { id: "bacon", name: "Bacon", price: 1.0 },
  { id: "extra-cheese", name: "Extra Käse", price: 1.0 },
  { id: "extra-jalapenos", name: "Extra Jalapeños", price: 0.5 },
  { id: "extra-patty", name: "Extra Patty", price: 2.5 },
];

export const MENU: MenuItem[] = [
  {
    id: "smash-burger",
    name: "Smash Burger",
    price: 7.5,
    category: "burger",
    patties: 2,
    ingredients: ["Zwiebel", "Tomate", "Gurke"],
    tag: "Klassiker",
  },
  {
    id: "tripple-smash",
    name: "Tripple Smash",
    price: 10.5,
    category: "burger",
    patties: 3,
    ingredients: ["Zwiebel", "Tomate", "Gurke"],
    tag: "3 Patties",
  },
  {
    id: "chili-cheese",
    name: "Chili Cheese",
    price: 8.5,
    category: "burger",
    patties: 2,
    ingredients: ["Gurke", "Tomate", "Zwiebel", "Jalapeños"],
    tag: "Scharf",
  },
  {
    id: "oklahoma-smash",
    name: "Oklahoma Smash",
    price: 8.5,
    category: "burger",
    patties: 2,
    ingredients: ["Gurke", "Ketchup", "Senf", "Geschmorte Zwiebeln"],
  },
  {
    id: "bbq-smash",
    name: "BBQ Smash",
    price: 7.5,
    category: "burger",
    patties: 2,
    ingredients: ["Zwiebel", "Tomate", "Gurke"],
  },
  {
    id: "trueffel-smash",
    name: "Trüffel Smash",
    price: 9.5,
    category: "burger",
    patties: 2,
    ingredients: ["Salat", "Zwiebel", "Gurke", "Tomate"],
    tag: "Premium",
  },
  {
    id: "chicken-burger",
    name: "Chicken Burger",
    price: 8.5,
    category: "burger",
    ingredients: ["Salat", "Zwiebel", "Gurke", "Tomate"],
  },
  {
    id: "tasty-burger",
    name: "Tasty Burger",
    price: 8.5,
    category: "burger",
    patties: 2,
    ingredients: [],
    ingredientsPlaceholder: true,
  },
  {
    id: "veggie-burger",
    name: "Veggie Burger",
    price: 7.5,
    category: "burger",
    ingredients: ["Salat", "Zwiebel", "Gurke", "Tomate"],
    vegetarian: true,
  },
  {
    id: "pommes",
    name: "Pommes",
    price: 3.5,
    category: "beilagen",
    ingredients: [],
  },
  {
    id: "suesskartoffel-pommes",
    name: "Süßkartoffel-Pommes",
    price: 4.5,
    category: "beilagen",
    ingredients: [],
  },
  {
    id: "curly-fries",
    name: "Curly Fries",
    price: 4.5,
    category: "beilagen",
    ingredients: [],
  },
  {
    id: "trueffel-fries",
    name: "Trüffel Fries",
    price: 6.5,
    category: "beilagen",
    ingredients: [],
  },
];

export const CATEGORIES: { id: Category; label: string; note: string }[] = [
  {
    id: "burger",
    label: "Burger",
    note: "Alle Fleischburger standardmäßig mit Double Patty – Tripple Smash mit drei Patties.",
  },
  { id: "beilagen", label: "Beilagen", note: "Frisch frittiert, immer knusprig." },
];

export const BUSINESS = {
  name: "Taste It's Tasty",
  tagline: "Food Truck · Burgers",
  street: "Kopernikusstraße 2",
  city: "85221 Dachau",
  place: "REWE-Parkplatz",
};

/** Wochentage – Index entspricht Date.getDay() (0 = Sonntag). */
export const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
] as const;

export type DayHours = { open: string; close: string; closed: boolean };

/** Standard-Öffnungszeiten: Mo–Sa 11:00–18:00, Sonntag geschlossen. */
export const DEFAULT_HOURS: DayHours[] = [
  { open: "11:00", close: "18:00", closed: true }, // Sonntag
  { open: "11:00", close: "18:00", closed: false },
  { open: "11:00", close: "18:00", closed: false },
  { open: "11:00", close: "18:00", closed: false },
  { open: "11:00", close: "18:00", closed: false },
  { open: "11:00", close: "18:00", closed: false },
  { open: "11:00", close: "18:00", closed: false }, // Samstag
];

export const formatDayHours = (h: DayHours) =>
  h.closed ? "Geschlossen" : `${h.open} – ${h.close}`;

/** Kurznamen der Wochentage – Index wie Date.getDay(). */
export const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

export type HoursGroup = { label: string; value: string };

/**
 * Fasst aufeinanderfolgende Tage (Mo–So) mit identischen Zeiten zusammen,
 * damit die Anzeige kompakt bleibt (z. B. „Mo – Sa: 11:00 – 18:00 Uhr“).
 */
export function groupHours(hours: DayHours[]): HoursGroup[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const sig = (h: DayHours) => (h.closed ? "closed" : `${h.open}-${h.close}`);
  const groups: HoursGroup[] = [];
  let start = 0;

  for (let i = 0; i < order.length; i++) {
    const current = hours[order[i]!] ?? DEFAULT_HOURS[order[i]!]!;
    const next = i + 1 < order.length ? (hours[order[i + 1]!] ?? DEFAULT_HOURS[order[i + 1]!]!) : null;
    if (next && sig(current) === sig(next)) continue;

    const first = order[start]!;
    const last = order[i]!;
    const label =
      start === i
        ? WEEKDAYS[first]!
        : `${WEEKDAYS_SHORT[first]} – ${WEEKDAYS_SHORT[last]}`;
    groups.push({
      label,
      value: current.closed ? "geschlossen" : `${current.open} – ${current.close} Uhr`,
    });
    start = i + 1;
  }
  return groups;
}

/** Einzeiliger Satz, z. B. „Mo – Sa: 11:00 – 18:00 Uhr, Sonntag: geschlossen“. */
export const formatHoursSentence = (hours: DayHours[]) =>
  groupHours(hours)
    .map((g) => `${g.label}: ${g.value}`)
    .join(", ");

/**
 * Einheitliche Patty-Beschriftung für Kundenansichten.
 * Vegetarische Produkte zeigen immer „Blumenkohl-Karotten Patty“, unabhängig von `patties`.
 */
export function pattyLabel(item: {
  vegetarian?: boolean | undefined;
  patties?: number | null | undefined;
}): string | null {
  if (item.vegetarian) return "Blumenkohl-Karotten Patty";
  const count = item.patties ?? 0;
  if (count >= 4) return `${count} Patties`;
  if (count === 3) return "Triple Patty";
  if (count === 2) return "Double Patty";
  if (count === 1) return "Single Patty";
  return null;
}

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);

