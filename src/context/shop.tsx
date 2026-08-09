import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CATEGORIES,
  DEFAULT_EXTRAS,
  DEFAULT_HOURS,
  MENU,
  REMOVABLE,
  type DayHours,
  type Extra,
  type MenuItem,
  type SelectionOption,
} from "@/data/menu";
import { DEFAULT_MAX_ORDERS_PER_SLOT, DEFAULT_MIN_LEAD_MINUTES } from "@/lib/pickup";
import { demoPickupDate } from "@/lib/demo-pickup";
import type { CartLine } from "@/context/cart";

export const ORDER_STATUSES = [
  "neu",
  "angenommen",
  "zubereitung",
  "abholbereit",
  "abgeschlossen",
  "abgelehnt",
  "storniert",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  neu: "Neu",
  angenommen: "Angenommen",
  zubereitung: "In Zubereitung",
  abholbereit: "Abholbereit",
  abgeschlossen: "Abgeschlossen",
  abgelehnt: "Abgelehnt",
  storniert: "Storniert",
};

/** Statusübergänge, die nicht mehr zu den offenen Bestellungen zählen. */
export const CLOSED_STATUSES: OrderStatus[] = ["abgeschlossen", "abgelehnt", "storniert"];

export const CANCEL_REASONS = [
  { value: "kunde", label: "Kunde hat storniert" },
  { value: "nicht-verfuegbar", label: "Produkt nicht verfügbar" },
  { value: "doppelt", label: "Doppelte Bestellung" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number]["value"];

/** Zeitstempel je Statuswechsel – Basis für spätere Auswertungen. */
export type OrderTimestamps = {
  acceptedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  completedAt?: string;
  cancelledAt?: string;
};

const STATUS_TIMESTAMP_KEY: Partial<Record<OrderStatus, keyof OrderTimestamps>> = {
  angenommen: "acceptedAt",
  zubereitung: "preparingAt",
  abholbereit: "readyAt",
  abgeschlossen: "completedAt",
  abgelehnt: "cancelledAt",
  storniert: "cancelledAt",
};

export type ShopOrder = {
  id: string;
  reference: string;
  createdAt: string;
  pickupISO: string;
  pickupLabel: string;
  status: OrderStatus;
  name: string;
  phone: string;
  note: string;
  /** Interne Notiz – nur im Adminbereich sichtbar. */
  internalNote?: string;
  payment: string;
  lines: CartLine[];
  total: number;
  timestamps?: OrderTimestamps;
  cancelReason?: CancelReason;
  cancelNote?: string;
};

/* -------------------------------------------------------------------------
 * Katalog-Datenstruktur (tabellenartig, damit eine spätere Migration nach
 * Postgres/Supabase 1:1 möglich ist: jede Liste = eine Tabelle mit id + sortOrder)
 * ---------------------------------------------------------------------- */

export type CategoryRecord = {
  id: string;
  label: string;
  note: string;
  sortOrder: number;
  /** Pausierte Kategorien sind in der Kundenansicht nicht bestellbar. */
  paused?: boolean;
};
export type IngredientRecord = { id: string; name: string; sortOrder: number };
export type ExtraRecord = { id: string; name: string; price: number; sortOrder: number };

export type ProductRecord = {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  price: number;
  imageUrl: string;
  active: boolean;
  soldOut: boolean;
  patties: number | null;
  /** Standardmäßig enthaltene Zutaten (Namen aus der Zutatenliste). */
  ingredients: string[];
  /** Teilmenge von ingredients, die Kund:innen abwählen dürfen. */
  removable: string[];
  /** IDs aus dem Extra-Katalog. */
  extraIds: string[];
  /** Optionale Auswahl-Optionen (Mehrfachwahl). */
  options: SelectionOption[];
  tag: string;
  vegetarian: boolean;
  ingredientsPlaceholder: boolean;
  sortOrder: number;
};

export type Catalog = {
  categories: CategoryRecord[];
  ingredients: IngredientRecord[];
  extras: ExtraRecord[];
};

export type ProductOverride = {
  name?: string;
  price?: number;
  description?: string;
  available?: boolean;
  soldOut?: boolean;
};

export type ShopSettings = {
  hours: DayHours[];
  maxOrdersPerSlot: number;
  minLeadMinutes: number;
  /** Globaler Not-Aus für Online-Bestellungen. */
  ordersPaused: boolean;
  /** Tick-Ton beim Scrollen im Wheel Picker. */
  wheelSoundOn: boolean;
};

type ShopState = {
  settings: ShopSettings;
  catalog: Catalog;
  productRows: ProductRecord[];
  orders: ShopOrder[];
  adminAuthed: boolean;
  soundOn: boolean;
};

const STORAGE_KEY = "tit-shop-state-v2";

const DEFAULT_SETTINGS: ShopSettings = {
  hours: DEFAULT_HOURS,
  maxOrdersPerSlot: DEFAULT_MAX_ORDERS_PER_SLOT,
  minLeadMinutes: DEFAULT_MIN_LEAD_MINUTES,
  ordersPaused: false,
  wheelSoundOn: true,
};

function seedCatalog(): Catalog {
  const names = new Set<string>();
  for (const item of MENU) for (const i of item.ingredients) names.add(i);
  for (const i of REMOVABLE) names.add(i);
  return {
    categories: CATEGORIES.map((c, i) => ({
      id: c.id,
      label: c.label,
      note: c.note,
      sortOrder: i,
    })),
    ingredients: [...names]
      .sort((a, b) => a.localeCompare(b, "de"))
      .map((name, i) => ({
        id: name.toLowerCase().replace(/[^a-z0-9]+/gi, "-"),
        name,
        sortOrder: i,
      })),
    extras: DEFAULT_EXTRAS.map((e, i) => ({ ...e, sortOrder: i })),
  };
}

function seedProducts(): ProductRecord[] {
  return MENU.map((item, i) => ({
    id: item.id,
    name: item.name,
    categoryId: item.category,
    description: item.description ?? "",
    price: item.price,
    imageUrl: "",
    active: true,
    soldOut: false,
    patties: item.patties ?? null,
    ingredients: [...item.ingredients],
    removable: item.ingredients.filter((x) => (REMOVABLE as readonly string[]).includes(x)),
    extraIds: item.category === "burger" ? ["bacon", "extra-cheese", "extra-patty"] : [],
    options: [],
    tag: item.tag ?? "",
    vegetarian: item.vegetarian === true,
    ingredientsPlaceholder: item.ingredientsPlaceholder === true,
    sortOrder: i,
  }));
}

const DEMO_NAMES = ["Lena Fischer", "Tobias Reiter", "Marie Huber", "Jonas Weber", "Sara Klein"];

const DEMO_PAYMENTS = ["Kreditkarte", "Apple Pay", "Barzahlung bei Abholung", "Google Pay"];

function demoLine(
  item: MenuItem,
  quantity: number,
  bacon = false,
  removed: string[] = [],
): CartLine {
  return {
    lineId: `${item.id}-demo-${Math.random().toString(36).slice(2, 8)}`,
    itemId: item.id,
    name: item.name,
    basePrice: item.price,
    quantity,
    removed,
    bacon,
  };
}

function seedOrders(): ShopOrder[] {
  const now = Date.now();
  const statuses: OrderStatus[] = [
    "neu",
    "zubereitung",
    "abholbereit",
    "abgeschlossen",
    "abgeschlossen",
  ];
  return statuses.map((status, i) => {
    const items = [MENU[i % MENU.length]!, MENU[(i + 3) % MENU.length]!];
    const lines = [demoLine(items[0]!, 1 + (i % 2), i % 2 === 0), demoLine(items[1]!, 1)];
    const total = lines.reduce((s, l) => s + (l.basePrice + (l.bacon ? 1 : 0)) * l.quantity, 0);
    // Demo-Abholzeiten über den Tag verteilen, damit kein Slot künstlich voll wirkt.
    const pickup = demoPickupDate(new Date(now + (i - 2) * 25 * 60_000), i * 20);
    return {
      id: `demo-${i}`,
      reference: `TIT-${1200 + i * 37}`,
      createdAt: new Date(now - (i + 1) * 18 * 60_000).toISOString(),
      pickupISO: pickup.toISOString(),
      pickupLabel: `${String(pickup.getHours()).padStart(2, "0")}:${String(pickup.getMinutes()).padStart(2, "0")} Uhr`,
      status,
      name: DEMO_NAMES[i % DEMO_NAMES.length]!,
      phone: "0151 2345678",
      note: i === 1 ? "Bitte gut durch" : "",
      internalNote: "",
      payment: DEMO_PAYMENTS[i % DEMO_PAYMENTS.length]!,
      lines,
      total,
    };
  });
}

type ShopContextValue = ShopState & {
  /** Für die Kundenansicht aufbereitete Produkte (aktiv + inaktiv). */
  products: MenuItem[];
  orderableProducts: MenuItem[];
  /** Kompatibilitäts-Sicht auf Produktflags. */
  overrides: Record<string, ProductOverride>;
  bookings: Record<string, number>;
  setSettings: (patch: Partial<ShopSettings>) => void;
  setDayHours: (index: number, patch: Partial<DayHours>) => void;
  setOverride: (id: string, patch: ProductOverride) => void;
  upsertProduct: (row: ProductRecord) => void;
  duplicateProduct: (id: string) => ProductRecord | null;
  deleteProduct: (id: string) => void;
  upsertCategory: (row: CategoryRecord) => void;
  deleteCategory: (id: string) => void;
  upsertIngredient: (row: IngredientRecord) => void;
  deleteIngredient: (id: string) => void;
  upsertExtra: (row: ExtraRecord) => void;
  deleteExtra: (id: string) => void;
  moveEntry: (list: "categories" | "ingredients" | "extras", id: string, dir: -1 | 1) => void;
  moveProduct: (id: string, dir: -1 | 1) => void;
  /** Neue Reihenfolge innerhalb einer Kategorie (Drag & Drop). */
  reorderProducts: (categoryId: string, orderedIds: string[]) => void;
  setProductSoldOut: (id: string, soldOut: boolean) => void;
  setCategoryPaused: (id: string, paused: boolean) => void;
  addOrder: (order: Omit<ShopOrder, "id" | "status">) => ShopOrder;
  setOrderStatus: (id: string, status: OrderStatus) => void;
  cancelOrder: (id: string, reason: CancelReason, cancelNote?: string) => void;
  restoreOrder: (id: string, status: OrderStatus) => void;
  setOrderNote: (id: string, internalNote: string) => void;
  simulateOrder: () => ShopOrder;
  login: (user: string, password: string) => boolean;
  logout: () => void;
  setSoundOn: (on: boolean) => void;
};

/** Setzt den Status und schreibt den passenden Zeitstempel fort. */
function withStatus(order: ShopOrder, status: OrderStatus): ShopOrder {
  const key = STATUS_TIMESTAMP_KEY[status];
  const timestamps: OrderTimestamps = { ...(order.timestamps ?? {}) };
  if (key) timestamps[key] = new Date().toISOString();
  return { ...order, status, timestamps };
}

const ShopContext = createContext<ShopContextValue | null>(null);

const initialState: ShopState = {
  settings: DEFAULT_SETTINGS,
  catalog: seedCatalog(),
  productRows: seedProducts(),
  orders: [],
  adminAuthed: false,
  soundOn: true,
};

export function ShopProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShopState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<ShopState>) : null;
      setState({
        ...initialState,
        ...(parsed ?? {}),
        settings: { ...DEFAULT_SETTINGS, ...(parsed?.settings ?? {}) },
        catalog: { ...seedCatalog(), ...(parsed?.catalog ?? {}) },
        productRows: parsed?.productRows?.length
          ? parsed.productRows.map((row) => ({
              ...row,
              options:
                row.options ??
                ((row as unknown as { variants?: SelectionOption[] }).variants || []),
            }))
          : seedProducts(),
        orders: parsed?.orders?.length ? parsed.orders : seedOrders(),
      });
    } catch {
      setState({ ...initialState, orders: seedOrders() });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const patch = useCallback((fn: (prev: ShopState) => ShopState) => setState(fn), []);

  const value = useMemo<ShopContextValue>(() => {
    const extraById = new Map(state.catalog.extras.map((e) => [e.id, e]));
    const categoryOrder = new Map(state.catalog.categories.map((c) => [c.id, c.sortOrder]));

    const rows = [...state.productRows].sort(
      (a, b) =>
        (categoryOrder.get(a.categoryId) ?? 99) - (categoryOrder.get(b.categoryId) ?? 99) ||
        a.sortOrder - b.sortOrder,
    );

    const toMenuItem = (row: ProductRecord): MenuItem => {
      const extras: Extra[] = row.extraIds
        .map((id) => extraById.get(id))
        .filter((e): e is ExtraRecord => Boolean(e))
        .map((e) => ({ id: e.id, name: e.name, price: e.price }));
      const item: MenuItem = {
        id: row.id,
        name: row.name,
        price: row.price,
        category: row.categoryId,
        ingredients: row.ingredients,
        removable: row.removable,
        extras,
        options: row.options ?? [],
      };
      if (row.patties) item.patties = row.patties;
      if (row.description) item.description = row.description;
      if (row.imageUrl) item.imageUrl = row.imageUrl;
      if (row.tag) item.tag = row.tag;
      if (row.vegetarian) item.vegetarian = true;
      if (row.ingredientsPlaceholder) item.ingredientsPlaceholder = true;
      return item;
    };

    const products = rows.map(toMenuItem);
    const overrides: Record<string, ProductOverride> = {};
    for (const row of rows) {
      overrides[row.id] = {
        name: row.name,
        price: row.price,
        description: row.description,
        available: row.active,
        soldOut: row.soldOut,
      };
    }
    const pausedCategories = new Set(
      state.catalog.categories.filter((c) => c.paused).map((c) => c.id),
    );
    const orderable = rows
      .filter((r) => r.active && !r.soldOut && !pausedCategories.has(r.categoryId))
      .map(toMenuItem);

    const bookings: Record<string, number> = {};
    for (const order of state.orders) {
      if (CLOSED_STATUSES.includes(order.status) && order.status !== "abgeschlossen") continue;
      bookings[order.pickupISO] = (bookings[order.pickupISO] ?? 0) + 1;
    }

    const reindex = <T extends { sortOrder: number }>(list: T[]) =>
      list.map((entry, i) => ({ ...entry, sortOrder: i }));

    return {
      ...state,
      products,
      orderableProducts: orderable,
      overrides,
      bookings,
      setSettings: (p) => patch((prev) => ({ ...prev, settings: { ...prev.settings, ...p } })),
      setDayHours: (index, p) =>
        patch((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            hours: prev.settings.hours.map((h, i) => (i === index ? { ...h, ...p } : h)),
          },
        })),
      setOverride: (id, p) =>
        patch((prev) => ({
          ...prev,
          productRows: prev.productRows.map((row) =>
            row.id !== id
              ? row
              : {
                  ...row,
                  name: p.name ?? row.name,
                  price: p.price ?? row.price,
                  description: p.description ?? row.description,
                  active: p.available ?? row.active,
                  soldOut: p.soldOut ?? row.soldOut,
                },
          ),
        })),
      upsertProduct: (row) =>
        patch((prev) => ({
          ...prev,
          productRows: prev.productRows.some((r) => r.id === row.id)
            ? prev.productRows.map((r) => (r.id === row.id ? row : r))
            : [...prev.productRows, row],
        })),
      duplicateProduct: (id) => {
        const source = state.productRows.find((r) => r.id === id);
        if (!source) return null;
        const copy: ProductRecord = {
          ...source,
          id: `${source.id}-kopie-${Math.random().toString(36).slice(2, 6)}`,
          name: `${source.name} (Kopie)`,
          active: false,
          sortOrder: source.sortOrder + 0.5,
        };
        patch((prev) => ({ ...prev, productRows: [...prev.productRows, copy] }));
        return copy;
      },
      deleteProduct: (id) =>
        patch((prev) => ({ ...prev, productRows: prev.productRows.filter((r) => r.id !== id) })),
      upsertCategory: (row) =>
        patch((prev) => ({
          ...prev,
          catalog: {
            ...prev.catalog,
            categories: prev.catalog.categories.some((c) => c.id === row.id)
              ? prev.catalog.categories.map((c) => (c.id === row.id ? row : c))
              : [...prev.catalog.categories, row],
          },
        })),
      deleteCategory: (id) =>
        patch((prev) => ({
          ...prev,
          catalog: {
            ...prev.catalog,
            categories: reindex(prev.catalog.categories.filter((c) => c.id !== id)),
          },
        })),
      upsertIngredient: (row) =>
        patch((prev) => ({
          ...prev,
          catalog: {
            ...prev.catalog,
            ingredients: prev.catalog.ingredients.some((c) => c.id === row.id)
              ? prev.catalog.ingredients.map((c) => (c.id === row.id ? row : c))
              : [...prev.catalog.ingredients, row],
          },
        })),
      deleteIngredient: (id) =>
        patch((prev) => ({
          ...prev,
          catalog: {
            ...prev.catalog,
            ingredients: reindex(prev.catalog.ingredients.filter((c) => c.id !== id)),
          },
        })),
      upsertExtra: (row) =>
        patch((prev) => ({
          ...prev,
          catalog: {
            ...prev.catalog,
            extras: prev.catalog.extras.some((c) => c.id === row.id)
              ? prev.catalog.extras.map((c) => (c.id === row.id ? row : c))
              : [...prev.catalog.extras, row],
          },
        })),
      deleteExtra: (id) =>
        patch((prev) => ({
          ...prev,
          catalog: {
            ...prev.catalog,
            extras: reindex(prev.catalog.extras.filter((c) => c.id !== id)),
          },
          productRows: prev.productRows.map((r) => ({
            ...r,
            extraIds: r.extraIds.filter((x) => x !== id),
          })),
        })),
      moveEntry: (list, id, dir) =>
        patch((prev) => {
          const entries = [...prev.catalog[list]].sort((a, b) => a.sortOrder - b.sortOrder);
          const index = entries.findIndex((e) => e.id === id);
          const target = index + dir;
          if (index < 0 || target < 0 || target >= entries.length) return prev;
          const swapped = [...entries];
          const a = swapped[index]!;
          swapped[index] = swapped[target]!;
          swapped[target] = a;
          return {
            ...prev,
            catalog: { ...prev.catalog, [list]: reindex(swapped) } as Catalog,
          };
        }),
      moveProduct: (id, dir) =>
        patch((prev) => {
          const row = prev.productRows.find((r) => r.id === id);
          if (!row) return prev;
          // Nur innerhalb derselben Kategorie sortieren.
          const group = prev.productRows
            .filter((r) => r.categoryId === row.categoryId)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          const index = group.findIndex((r) => r.id === id);
          const target = index + dir;
          if (target < 0 || target >= group.length) return prev;
          const swapped = [...group];
          const a = swapped[index]!;
          swapped[index] = swapped[target]!;
          swapped[target] = a;
          const orderById = new Map(swapped.map((r, i) => [r.id, i]));
          return {
            ...prev,
            productRows: prev.productRows.map((r) =>
              orderById.has(r.id) ? { ...r, sortOrder: orderById.get(r.id)! } : r,
            ),
          };
        }),
      setProductSoldOut: (id, soldOut) =>
        patch((prev) => ({
          ...prev,
          productRows: prev.productRows.map((r) => (r.id === id ? { ...r, soldOut } : r)),
        })),
      reorderProducts: (categoryId, orderedIds) =>
        patch((prev) => {
          const rank = new Map(orderedIds.map((id, i) => [id, i]));
          return {
            ...prev,
            productRows: prev.productRows.map((r) =>
              r.categoryId === categoryId && rank.has(r.id)
                ? { ...r, sortOrder: rank.get(r.id)! }
                : r,
            ),
          };
        }),
      setCategoryPaused: (id, paused) =>
        patch((prev) => ({
          ...prev,
          catalog: {
            ...prev.catalog,
            categories: prev.catalog.categories.map((c) => (c.id === id ? { ...c, paused } : c)),
          },
        })),
      addOrder: (order) => {
        const full: ShopOrder = { internalNote: "", ...order, id: `${Date.now()}`, status: "neu" };
        patch((prev) => ({ ...prev, orders: [full, ...prev.orders] }));
        return full;
      },
      setOrderStatus: (id, status) =>
        patch((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => (o.id === id ? withStatus(o, status) : o)),
        })),
      cancelOrder: (id, reason, cancelNote) =>
        patch((prev) => ({
          ...prev,
          orders: prev.orders.map((o) =>
            o.id === id
              ? {
                  ...withStatus(o, "storniert"),
                  cancelReason: reason,
                  cancelNote: cancelNote ?? "",
                }
              : o,
          ),
        })),
      restoreOrder: (id, status) =>
        patch((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => {
            if (o.id !== id) return o;
            const next = withStatus(o, status);
            const timestamps = { ...(next.timestamps ?? {}) };
            delete timestamps.completedAt;
            delete timestamps.cancelledAt;
            const restored: ShopOrder = { ...next, timestamps };
            delete restored.cancelReason;
            delete restored.cancelNote;
            return restored;
          }),
        })),
      setOrderNote: (id, internalNote) =>
        patch((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => (o.id === id ? { ...o, internalNote } : o)),
        })),
      simulateOrder: () => {
        const pool = orderable.length ? orderable : products;
        const lines = [
          demoLine(
            pool[Math.floor(Math.random() * pool.length)]!,
            1 + Math.floor(Math.random() * 2),
            Math.random() > 0.6,
          ),
          demoLine(pool[Math.floor(Math.random() * pool.length)]!, 1),
        ];
        const total = lines.reduce((s, l) => s + (l.basePrice + (l.bacon ? 1 : 0)) * l.quantity, 0);
        const pickup = demoPickupDate(new Date(Date.now() + 25 * 60_000));
        const order: ShopOrder = {
          id: `${Date.now()}`,
          reference: `TIT-${Math.floor(1000 + Math.random() * 9000)}`,
          createdAt: new Date().toISOString(),
          pickupISO: pickup.toISOString(),
          pickupLabel: `${String(pickup.getHours()).padStart(2, "0")}:${String(pickup.getMinutes()).padStart(2, "0")} Uhr`,
          status: "neu",
          name: DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)]!,
          phone: "0151 2345678",
          note: "",
          internalNote: "",
          payment: DEMO_PAYMENTS[Math.floor(Math.random() * DEMO_PAYMENTS.length)]!,
          lines,
          total,
        };
        patch((prev) => ({ ...prev, orders: [order, ...prev.orders] }));
        return order;
      },
      login: (user, password) => {
        const ok = user.trim().toLowerCase() === "admin" && password === "tasty2024";
        if (ok) patch((prev) => ({ ...prev, adminAuthed: true }));
        return ok;
      },
      logout: () => patch((prev) => ({ ...prev, adminAuthed: false })),
      setSoundOn: (on) => patch((prev) => ({ ...prev, soundOn: on })),
    };
  }, [state, patch]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
}

/** Leeres Produkt für „Neues Produkt anlegen“. */
export function emptyProduct(categoryId: string, sortOrder: number): ProductRecord {
  return {
    id: `produkt-${Date.now().toString(36)}`,
    name: "",
    categoryId,
    description: "",
    price: 0,
    imageUrl: "",
    active: true,
    soldOut: false,
    patties: null,
    ingredients: [],
    removable: [],
    extraIds: [],
    options: [],
    tag: "",
    vegetarian: false,
    ingredientsPlaceholder: false,
    sortOrder,
  };
}
