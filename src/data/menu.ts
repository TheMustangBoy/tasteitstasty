export type Category = string;

/** Extra/Topping – zubuchbar pro Produkt. */
export type Extra = { id: string; name: string; price: number };

/** Variante (z. B. Größe) – Preisdifferenz zum Basispreis. */
export type Variant = { id: string; name: string; priceDelta: number };

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
  /** Abwählbare Zutaten (Teilmenge von ingredients). */
  removable?: string[];
  extras?: Extra[];
  variants?: Variant[];
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
  owner: "Max Mustermann",
  phone: "01234 567890",
  email: "info@tasteitstasty.de",
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

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
