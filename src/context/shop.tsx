import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { toast } from "sonner";
import {
  checkIsAdmin,
  fetchAdminOrders,
  fetchPublicSnapshot,
  fetchSlotBookings,
  placeOrderRemote,
  removeCategory,
  removeExtra,
  removeIngredient,
  removeProduct,
  saveCategory,
  saveCategoryOrder,
  saveExtra,
  saveExtraOrder,
  saveHours,
  saveIngredient,
  saveIngredientOrder,
  saveOrderPatch,
  saveProduct,
  saveProductOrder,
  saveSettings,
  toOrder,
  type OrderPatch,
  type ShopSnapshot,
} from "@/lib/repository";
import { supabase } from "@/integrations/supabase/client";
import { playNotificationSound } from "@/lib/admin-sound";
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
  /** Zahlungsanbieter: "manual" (vor Ort), "stripe" (online) oder null = Altbestand. */
  paymentProvider?: "manual" | "stripe" | null;
  paymentStatus?: "pay_on_pickup" | "paid" | "refunded" | null;
  paidAt?: string | null;
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
  /** Vollständige Bestellungen – nur im Admin-Kontext befüllt, nie persistiert. */
  orders: ShopOrder[];
  /** Slot-Auslastung ohne Kundendaten (Abholzeit → Anzahl). */
  slotBookings: Record<string, number>;
  adminAuthed: boolean;
  soundOn: boolean;
};

const STORAGE_KEY = "tit-shop-cache-v3";

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
  addOrder: (order: Omit<ShopOrder, "id" | "status">) => Promise<ShopOrder>;
  setOrderStatus: (id: string, status: OrderStatus) => void;
  cancelOrder: (id: string, reason: CancelReason, cancelNote?: string) => void;
  restoreOrder: (id: string, status: OrderStatus) => void;
  setOrderNote: (id: string, internalNote: string) => void;
  simulateOrder: () => Promise<ShopOrder>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  setSoundOn: (on: boolean) => void;
  /** Ladezustand des zentralen Datenstands. */
  loading: boolean;
  /** Session-Prüfung läuft noch. */
  authLoading: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;
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
  slotBookings: {},
  adminAuthed: false,
  soundOn: true,
};

const SOUND_KEY = "tit-admin-sound-on";

export function ShopProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShopState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * Bereits bekannte Bestell-IDs (Dedup für Benachrichtigungen).
   * Bewusst ein Ref und kein State: kein Re-Render, keine Race-Conditions
   * zwischen initialem Fetch und Realtime-INSERT.
   */
  const knownOrderIds = useRef<Set<string>>(new Set());
  /** Aktueller Ton-Wunsch ohne Neuaufbau des Realtime-Channels. */
  const soundOnRef = useRef(state.soundOn);
  soundOnRef.current = state.soundOn;

  /** Titel-Flash: ein einziger Timer + gemerkter Basistitel (kein Race). */
  const titleBase = useRef<string | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restoreTitle = useCallback(() => {
    if (titleTimer.current) {
      clearTimeout(titleTimer.current);
      titleTimer.current = null;
    }
    if (typeof document !== "undefined" && titleBase.current !== null) {
      document.title = titleBase.current;
    }
    titleBase.current = null;
  }, []);

  useEffect(() => restoreTitle, [restoreTitle]);

  /** Bestellungen aus einem Vollabruf als „bekannt“ markieren – ohne Meldung. */
  const markKnown = useCallback((orders: ShopOrder[]) => {
    for (const o of orders) knownOrderIds.current.add(o.id);
  }, []);

  /** Zentrale Benachrichtigung: Toast, optional Ton, kurzer Titel-Hinweis. */
  const notifyNewOrder = useCallback(
    (order: ShopOrder) => {
      toast.success("Neue Bestellung eingegangen", {
        description: `${order.reference} · Abholung ${order.pickupLabel} · ${order.total.toFixed(2).replace(".", ",")} €`,
        duration: 8000,
      });
      if (soundOnRef.current) void playNotificationSound();
      if (typeof document !== "undefined") {
        // Basistitel nur beim ersten Flash merken, Timer bei Folgemeldungen verlängern.
        titleBase.current ??= document.title;
        document.title = "🔔 Neue Bestellung!";
        if (titleTimer.current) clearTimeout(titleTimer.current);
        titleTimer.current = setTimeout(restoreTitle, 5000);
      }
    },
    [restoreTitle],
  );

  const applySnapshot = useCallback((snap: ShopSnapshot) => {
    setState((prev) => ({
      ...prev,
      settings: snap.settings,
      catalog: {
        categories: snap.categories,
        ingredients: snap.ingredients,
        extras: snap.extras,
      },
      productRows: snap.products,
    }));
  }, []);

  /** Öffentliche Daten + Slot-Auslastung; Bestellungen nur mit Adminrechten. */
  const refresh = useCallback(async () => {
    try {
      const [snap, slots] = await Promise.all([fetchPublicSnapshot(), fetchSlotBookings()]);
      applySnapshot(snap);
      setState((prev) => ({ ...prev, slotBookings: slots }));
      setLoadError(null);
      // Adminstatus nur prüfen, wenn überhaupt eine Session existiert.
      const { data: sessionData } = await supabase.auth.getSession();
      const admin = sessionData.session ? await checkIsAdmin() : false;
      setState((prev) => ({ ...prev, adminAuthed: admin }));
      if (admin) {
        // Bestand aus dem Vollabruf gilt als bekannt – keine Meldung für Altbestellungen.
        const orders = await fetchAdminOrders();
        markKnown(orders);
        setState((prev) => ({ ...prev, orders }));
      } else {
        knownOrderIds.current.clear();
        setState((prev) => ({ ...prev, orders: [] }));
      }
    } catch {
      setLoadError("Daten konnten nicht geladen werden. Bitte Seite neu laden.");
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  }, [applySnapshot, markKnown]);

  useEffect(() => {
    // Altlast entfernen: v2 enthielt Bestellungen, Kundendaten und adminAuthed.
    try {
      localStorage.removeItem("tit-shop-state-v2");
    } catch {
      /* ignore */
    }
    // LocalStorage nur als kurzlebiger Cache für öffentliche Stammdaten.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<ShopState>) : null;
      if (parsed)
        setState((prev) => ({
          ...prev,
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
          catalog: { ...prev.catalog, ...(parsed.catalog ?? {}) },
          productRows: parsed.productRows?.length ? parsed.productRows : prev.productRows,
        }));
    } catch {
      /* ignore */
    }
    // Ton-Präferenz ist gerätespezifisch und wird nicht in der DB gespeichert.
    try {
      const stored = localStorage.getItem(SOUND_KEY);
      if (stored !== null) setState((prev) => ({ ...prev, soundOn: stored === "1" }));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    let active = true;
    // Erst die gespeicherte Session auflösen, dann laden – vermeidet Race-Conditions,
    // bei denen ein Admin nach Reload kurzzeitig als Gast behandelt wird.
    void (async () => {
      await supabase.auth.getSession();
      if (active) await refresh();
    })();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      // INITIAL_SESSION wird vom obigen getSession()-Pfad abgedeckt.
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") {
        knownOrderIds.current.clear();
        setState((prev) => ({ ...prev, adminAuthed: false, orders: [] }));
        setAuthLoading(false);
        return;
      }
      void refresh();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  // Realtime nur für angemeldete Admins – anon/non-admin erhalten durch RLS
  // ohnehin keine Payloads, wir öffnen den Channel gar nicht erst.
  useEffect(() => {
    if (!state.adminAuthed) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const upsert = (row: unknown) => {
      const order = toOrder(row as Parameters<typeof toOrder>[0]);
      knownOrderIds.current.add(order.id);
      setState((prev) => {
        const idx = prev.orders.findIndex((o) => o.id === order.id);
        if (idx === -1) return { ...prev, orders: [order, ...prev.orders] };
        const orders = [...prev.orders];
        orders[idx] = { ...orders[idx], ...order };
        return { ...prev, orders };
      });
    };

    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (p) => {
        const id = (p.new as { id?: string } | null)?.id;
        // Dedup zuerst prüfen (upsert markiert die ID anschließend als bekannt):
        // mehrfach zugestellte INSERTs oder bereits geladene Bestellungen melden nicht erneut.
        const isNew = Boolean(id) && !knownOrderIds.current.has(id!);
        upsert(p.new);
        if (isNew) notifyNewOrder(toOrder(p.new as Parameters<typeof toOrder>[0]));
      })

      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (p) =>
        upsert(p.new),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, (p) => {
        const id = (p.old as { id?: string } | null)?.id;
        if (!id) return;
        setState((prev) => ({ ...prev, orders: prev.orders.filter((o) => o.id !== id) }));
      })
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          // Lücke zwischen initialem Fetch und Subscription schließen.
          void fetchAdminOrders()
            .then((orders) => {
              if (cancelled) return;
              markKnown(orders);
              setState((prev) => ({ ...prev, orders }));
            })
            .catch(() => {
              /* stiller Fehler – Bestand bleibt erhalten */
            });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Einmaliger, verzögerter Nachfetch statt aggressiver Reconnect-Schleife.
          if (retry) return;
          retry = setTimeout(() => {
            retry = null;
            void fetchAdminOrders()
              .then((orders) => {
                if (cancelled) return;
                markKnown(orders);
                setState((prev) => ({ ...prev, orders }));
              })
              .catch(() => {
                /* ignore */
              });
          }, 5000);
        }
      });

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      void supabase.removeChannel(channel);
    };
  }, [state.adminAuthed, markKnown, notifyNewOrder]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      // Nur öffentliche, unkritische Daten cachen – keine Bestellungen, kein Adminstatus.
      const { settings, catalog, productRows } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, catalog, productRows }));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const patch = useCallback((fn: (prev: ShopState) => ShopState) => setState(fn), []);

  /**
   * Optimistisches Update wurde bereits angewendet – hier folgt der Write-Through.
   * Bei Fehler: verständliche Meldung + Rollback über den zentralen Datenstand.
   */
  const persist = useCallback(
    (op: () => Promise<unknown>, message = "Änderung konnte nicht gespeichert werden.") => {
      void (async () => {
        try {
          await op();
        } catch {
          toast.error(message, { description: "Der letzte Stand wurde wiederhergestellt." });
          await refresh();
        }
      })();
    },
    [refresh],
  );

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

    // Auslastung stammt aus der datenschutzkonformen RPC (nur Zeit + Anzahl).
    const bookings: Record<string, number> = { ...state.slotBookings };

    const reindex = <T extends { sortOrder: number }>(list: T[]) =>
      list.map((entry, i) => ({ ...entry, sortOrder: i }));

    return {
      ...state,
      products,
      orderableProducts: orderable,
      overrides,
      bookings,
      loading,
      authLoading,
      loadError,

      refresh,
      setSettings: (p) => {
        const next = { ...state.settings, ...p };
        patch((prev) => ({ ...prev, settings: next }));
        persist(async () => {
          await saveSettings(next);
          if (p.hours) await saveHours(next.hours);
        }, "Einstellungen konnten nicht gespeichert werden.");
      },
      setDayHours: (index, p) => {
        const hours = state.settings.hours.map((h, i) => (i === index ? { ...h, ...p } : h));
        patch((prev) => ({ ...prev, settings: { ...prev.settings, hours } }));
        persist(() => saveHours(hours), "Öffnungszeiten konnten nicht gespeichert werden.");
      },
      setOverride: (id, p) => {
        const row = state.productRows.find((r) => r.id === id);
        if (!row) return;
        const next: ProductRecord = {
          ...row,
          name: p.name ?? row.name,
          price: p.price ?? row.price,
          description: p.description ?? row.description,
          active: p.available ?? row.active,
          soldOut: p.soldOut ?? row.soldOut,
        };
        patch((prev) => ({
          ...prev,
          productRows: prev.productRows.map((r) => (r.id === id ? next : r)),
        }));
        persist(() => saveProduct(next), "Produkt konnte nicht gespeichert werden.");
      },
      upsertProduct: (row) => {
        patch((prev) => ({
          ...prev,
          productRows: prev.productRows.some((r) => r.id === row.id)
            ? prev.productRows.map((r) => (r.id === row.id ? row : r))
            : [...prev.productRows, row],
        }));
        persist(() => saveProduct(row), "Produkt konnte nicht gespeichert werden.");
      },
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
        persist(() => saveProduct(copy), "Produktkopie konnte nicht gespeichert werden.");
        return copy;
      },
      deleteProduct: (id) => {
        patch((prev) => ({ ...prev, productRows: prev.productRows.filter((r) => r.id !== id) }));
        persist(() => removeProduct(id), "Produkt konnte nicht gelöscht werden.");
      },
      upsertCategory: (row) => {
        patch((prev) => ({
          ...prev,
          catalog: {
            ...prev.catalog,
            categories: prev.catalog.categories.some((c) => c.id === row.id)
              ? prev.catalog.categories.map((c) => (c.id === row.id ? row : c))
              : [...prev.catalog.categories, row],
          },
        }));
        persist(() => saveCategory(row), "Kategorie konnte nicht gespeichert werden.");
      },
      deleteCategory: (id) => {
        // Kategorien mit Produkten dürfen nicht gelöscht werden (Fremdschlüssel).
        if (state.productRows.some((r) => r.categoryId === id)) {
          toast.error("Kategorie enthält noch Produkte und kann nicht gelöscht werden.");
          return;
        }
        const rest = reindex(state.catalog.categories.filter((c) => c.id !== id));
        patch((prev) => ({ ...prev, catalog: { ...prev.catalog, categories: rest } }));
        persist(async () => {
          await removeCategory(id);
          await saveCategoryOrder(rest);
        }, "Kategorie konnte nicht gelöscht werden.");
      },
      upsertIngredient: (row) => {
        patch((prev) => ({
          ...prev,
          catalog: {
            ...prev.catalog,
            ingredients: prev.catalog.ingredients.some((c) => c.id === row.id)
              ? prev.catalog.ingredients.map((c) => (c.id === row.id ? row : c))
              : [...prev.catalog.ingredients, row],
          },
        }));
        persist(() => saveIngredient(row), "Zutat konnte nicht gespeichert werden.");
      },
      deleteIngredient: (id) => {
        const rest = reindex(state.catalog.ingredients.filter((c) => c.id !== id));
        patch((prev) => ({ ...prev, catalog: { ...prev.catalog, ingredients: rest } }));
        persist(async () => {
          await removeIngredient(id);
          await saveIngredientOrder(rest);
        }, "Zutat konnte nicht gelöscht werden.");
      },
      upsertExtra: (row) => {
        patch((prev) => ({
          ...prev,
          catalog: {
            ...prev.catalog,
            extras: prev.catalog.extras.some((c) => c.id === row.id)
              ? prev.catalog.extras.map((c) => (c.id === row.id ? row : c))
              : [...prev.catalog.extras, row],
          },
        }));
        persist(() => saveExtra(row), "Extra konnte nicht gespeichert werden.");
      },
      deleteExtra: (id) => {
        const rest = reindex(state.catalog.extras.filter((c) => c.id !== id));
        const touched = state.productRows
          .filter((r) => r.extraIds.includes(id))
          .map((r) => ({ id: r.id, extraIds: r.extraIds.filter((x) => x !== id) }));
        patch((prev) => ({
          ...prev,
          catalog: { ...prev.catalog, extras: rest },
          productRows: prev.productRows.map((r) => ({
            ...r,
            extraIds: r.extraIds.filter((x) => x !== id),
          })),
        }));
        persist(async () => {
          await removeExtra(id, touched);
          await saveExtraOrder(rest);
        }, "Extra konnte nicht gelöscht werden.");
      },
      moveEntry: (list, id, dir) => {
        const entries = [...state.catalog[list]].sort((a, b) => a.sortOrder - b.sortOrder);
        const index = entries.findIndex((e) => e.id === id);
        const target = index + dir;
        if (index < 0 || target < 0 || target >= entries.length) return;
        const swapped = [...entries];
        const a = swapped[index]!;
        swapped[index] = swapped[target]!;
        swapped[target] = a;
        const next = reindex(swapped);
        patch((prev) => ({
          ...prev,
          catalog: { ...prev.catalog, [list]: next } as Catalog,
        }));
        persist(() => {
          if (list === "categories") return saveCategoryOrder(next as CategoryRecord[]);
          if (list === "ingredients") return saveIngredientOrder(next as IngredientRecord[]);
          return saveExtraOrder(next as ExtraRecord[]);
        }, "Reihenfolge konnte nicht gespeichert werden.");
      },
      moveProduct: (id, dir) => {
        const row = state.productRows.find((r) => r.id === id);
        if (!row) return;
        const group = state.productRows
          .filter((r) => r.categoryId === row.categoryId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const index = group.findIndex((r) => r.id === id);
        const target = index + dir;
        if (target < 0 || target >= group.length) return;
        const swapped = [...group];
        const a = swapped[index]!;
        swapped[index] = swapped[target]!;
        swapped[target] = a;
        const ordered = swapped.map((r, i) => ({ id: r.id, sortOrder: i }));
        const orderById = new Map(ordered.map((r) => [r.id, r.sortOrder]));
        patch((prev) => ({
          ...prev,
          productRows: prev.productRows.map((r) =>
            orderById.has(r.id) ? { ...r, sortOrder: orderById.get(r.id)! } : r,
          ),
        }));
        persist(() => saveProductOrder(ordered), "Reihenfolge konnte nicht gespeichert werden.");
      },
      setProductSoldOut: (id, soldOut) => {
        const row = state.productRows.find((r) => r.id === id);
        if (!row) return;
        const next = { ...row, soldOut };
        patch((prev) => ({
          ...prev,
          productRows: prev.productRows.map((r) => (r.id === id ? next : r)),
        }));
        persist(() => saveProduct(next), "Verfügbarkeit konnte nicht gespeichert werden.");
      },
      reorderProducts: (categoryId, orderedIds) => {
        const rank = new Map(orderedIds.map((id, i) => [id, i]));
        patch((prev) => ({
          ...prev,
          productRows: prev.productRows.map((r) =>
            r.categoryId === categoryId && rank.has(r.id)
              ? { ...r, sortOrder: rank.get(r.id)! }
              : r,
          ),
        }));
        persist(
          () => saveProductOrder(orderedIds.map((id, i) => ({ id, sortOrder: i }))),
          "Reihenfolge konnte nicht gespeichert werden.",
        );
      },
      setCategoryPaused: (id, paused) => {
        const row = state.catalog.categories.find((c) => c.id === id);
        if (!row) return;
        const next = { ...row, paused };
        patch((prev) => ({
          ...prev,
          catalog: {
            ...prev.catalog,
            categories: prev.catalog.categories.map((c) => (c.id === id ? next : c)),
          },
        }));
        persist(() => saveCategory(next), "Kategorie konnte nicht gespeichert werden.");
      },
      addOrder: async (order) => {
        // Kapazitätsprüfung passiert atomar in der Datenbank – kein optimistisches Insert.
        const saved = await placeOrderRemote({
          reference: order.reference,
          name: order.name,
          phone: order.phone,
          pickupISO: order.pickupISO,
          pickupLabel: order.pickupLabel,
          payment: order.payment,
          lines: order.lines,
          total: order.total,
          note: order.note ?? "",
        });
        patch((prev) => ({ ...prev, orders: [saved, ...prev.orders] }));
        return saved;
      },
      setOrderStatus: (id, status) => {
        const order = state.orders.find((o) => o.id === id);
        if (!order) return;
        const next = withStatus(order, status);
        patch((prev) => ({ ...prev, orders: prev.orders.map((o) => (o.id === id ? next : o)) }));
        persist(
          () => saveOrderPatch(id, { status: next.status, timestamps: next.timestamps ?? {} }),
          "Status konnte nicht gespeichert werden.",
        );
      },
      cancelOrder: (id, reason, cancelNote) => {
        const order = state.orders.find((o) => o.id === id);
        if (!order) return;
        const next: ShopOrder = {
          ...withStatus(order, "storniert"),
          cancelReason: reason,
          cancelNote: cancelNote ?? "",
        };
        patch((prev) => ({ ...prev, orders: prev.orders.map((o) => (o.id === id ? next : o)) }));
        persist(
          () =>
            saveOrderPatch(id, {
              status: next.status,
              timestamps: next.timestamps ?? {},
              cancelReason: reason,
              cancelNote: cancelNote ?? "",
            }),
          "Stornierung konnte nicht gespeichert werden.",
        );
      },
      restoreOrder: (id, status) => {
        const order = state.orders.find((o) => o.id === id);
        if (!order) return;
        const withNext = withStatus(order, status);
        const timestamps = { ...(withNext.timestamps ?? {}) };
        delete timestamps.completedAt;
        delete timestamps.cancelledAt;
        const restored: ShopOrder = { ...withNext, timestamps };
        delete restored.cancelReason;
        delete restored.cancelNote;
        patch((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => (o.id === id ? restored : o)),
        }));
        const orderPatch: OrderPatch = {
          status,
          timestamps,
          cancelReason: null,
          cancelNote: null,
        };
        persist(
          () => saveOrderPatch(id, orderPatch),
          "Bestellung konnte nicht reaktiviert werden.",
        );
      },
      setOrderNote: (id, internalNote) => {
        patch((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => (o.id === id ? { ...o, internalNote } : o)),
        }));
        persist(
          () => saveOrderPatch(id, { internalNote }),
          "Notiz konnte nicht gespeichert werden.",
        );
      },
      simulateOrder: async () => {
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
        const saved = await placeOrderRemote({
          reference: `TIT-${Math.floor(1000 + Math.random() * 9000)}`,
          name: DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)]!,
          phone: "0151 2345678",
          pickupISO: pickup.toISOString(),
          pickupLabel: `${String(pickup.getHours()).padStart(2, "0")}:${String(pickup.getMinutes()).padStart(2, "0")} Uhr`,
          payment: DEMO_PAYMENTS[Math.floor(Math.random() * DEMO_PAYMENTS.length)]!,
          lines,
          total,
          note: "",
        });
        patch((prev) => ({ ...prev, orders: [saved, ...prev.orders] }));
        return saved;
      },
      login: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) return { ok: false, error: "Anmeldung fehlgeschlagen. Bitte Daten prüfen." };
        const admin = await checkIsAdmin();
        if (!admin) {
          await supabase.auth.signOut();
          patch((prev) => ({ ...prev, adminAuthed: false, orders: [] }));
          return { ok: false, error: "Kein Admin-Zugriff für dieses Konto." };
        }
        patch((prev) => ({ ...prev, adminAuthed: true }));
        await refresh();
        return { ok: true };
      },
      logout: async () => {
        // Push-Registrierung dieses Geräts entfernen, solange die Session noch gültig ist.
        const { disablePush } = await import("@/lib/push");
        await disablePush();
        // Sensible Daten sofort verwerfen, dann Session beenden.
        knownOrderIds.current.clear();
        patch((prev) => ({ ...prev, adminAuthed: false, orders: [] }));
        await supabase.auth.signOut();
      },
      setSoundOn: (on) => {
        try {
          localStorage.setItem(SOUND_KEY, on ? "1" : "0");
        } catch {
          /* ignore */
        }
        patch((prev) => ({ ...prev, soundOn: on }));
      },
    };
  }, [state, patch, persist, refresh, loading, authLoading, loadError]);

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
