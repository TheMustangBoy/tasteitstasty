import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_HOURS, MENU, type DayHours, type MenuItem } from "@/data/menu";
import { DEFAULT_MAX_ORDERS_PER_SLOT, DEFAULT_MIN_LEAD_MINUTES } from "@/lib/pickup";
import type { CartLine } from "@/context/cart";

export const ORDER_STATUSES = [
  "neu",
  "angenommen",
  "zubereitung",
  "abholbereit",
  "abgeschlossen",
  "abgelehnt",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  neu: "Neu",
  angenommen: "Angenommen",
  zubereitung: "In Zubereitung",
  abholbereit: "Abholbereit",
  abgeschlossen: "Abgeschlossen",
  abgelehnt: "Abgelehnt",
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
  payment: string;
  lines: CartLine[];
  total: number;
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
};

type ShopState = {
  settings: ShopSettings;
  overrides: Record<string, ProductOverride>;
  orders: ShopOrder[];
  adminAuthed: boolean;
  soundOn: boolean;
};

const STORAGE_KEY = "tit-shop-state-v1";

const DEFAULT_SETTINGS: ShopSettings = {
  hours: DEFAULT_HOURS,
  maxOrdersPerSlot: DEFAULT_MAX_ORDERS_PER_SLOT,
  minLeadMinutes: DEFAULT_MIN_LEAD_MINUTES,
};

const DEMO_NAMES = ["Lena Fischer", "Tobias Reiter", "Marie Huber", "Jonas Weber", "Sara Klein"];
const DEMO_PAYMENTS = ["Kreditkarte", "Apple Pay", "Barzahlung bei Abholung", "Google Pay"];

function demoLine(item: MenuItem, quantity: number, bacon = false, removed: string[] = []): CartLine {
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
  const statuses: OrderStatus[] = ["neu", "zubereitung", "abholbereit", "abgeschlossen", "abgeschlossen"];
  return statuses.map((status, i) => {
    const items = [MENU[i % MENU.length]!, MENU[(i + 3) % MENU.length]!];
    const lines = [demoLine(items[0]!, 1 + (i % 2), i % 2 === 0), demoLine(items[1]!, 1)];
    const total = lines.reduce((s, l) => s + (l.basePrice + (l.bacon ? 1 : 0)) * l.quantity, 0);
    const pickup = new Date(now + (i - 2) * 25 * 60_000);
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
      payment: DEMO_PAYMENTS[i % DEMO_PAYMENTS.length]!,
      lines,
      total,
    };
  });
}

type ShopContextValue = ShopState & {
  products: MenuItem[];
  orderableProducts: MenuItem[];
  bookings: Record<string, number>;
  setSettings: (patch: Partial<ShopSettings>) => void;
  setDayHours: (index: number, patch: Partial<DayHours>) => void;
  setOverride: (id: string, patch: ProductOverride) => void;
  addOrder: (order: Omit<ShopOrder, "id" | "status">) => ShopOrder;
  setOrderStatus: (id: string, status: OrderStatus) => void;
  simulateOrder: () => ShopOrder;
  login: (user: string, password: string) => boolean;
  logout: () => void;
  setSoundOn: (on: boolean) => void;
};

const ShopContext = createContext<ShopContextValue | null>(null);

const initialState: ShopState = {
  settings: DEFAULT_SETTINGS,
  overrides: {},
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
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ShopState>;
        setState({
          ...initialState,
          ...parsed,
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
          orders: parsed.orders?.length ? parsed.orders : seedOrders(),
        });
      } else {
        setState({ ...initialState, orders: seedOrders() });
      }
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
    const products = MENU.map((item) => {
      const o = state.overrides[item.id];
      return o
        ? {
            ...item,
            name: o.name ?? item.name,
            price: o.price ?? item.price,
            description: o.description ?? item.description,
          }
        : item;
    });
    const orderable = products.filter((p) => {
      const o = state.overrides[p.id];
      return o?.available !== false && o?.soldOut !== true;
    });

    const bookings: Record<string, number> = {};
    for (const order of state.orders) {
      if (order.status === "abgelehnt") continue;
      bookings[order.pickupISO] = (bookings[order.pickupISO] ?? 0) + 1;
    }

    return {
      ...state,
      products,
      orderableProducts: orderable,
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
          overrides: { ...prev.overrides, [id]: { ...prev.overrides[id], ...p } },
        })),
      addOrder: (order) => {
        const full: ShopOrder = { ...order, id: `${Date.now()}`, status: "neu" };
        patch((prev) => ({ ...prev, orders: [full, ...prev.orders] }));
        return full;
      },
      setOrderStatus: (id, status) =>
        patch((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => (o.id === id ? { ...o, status } : o)),
        })),
      simulateOrder: () => {
        const pool = orderable.length ? orderable : products;
        const lines = [
          demoLine(pool[Math.floor(Math.random() * pool.length)]!, 1 + Math.floor(Math.random() * 2), Math.random() > 0.6),
          demoLine(pool[Math.floor(Math.random() * pool.length)]!, 1),
        ];
        const total = lines.reduce((s, l) => s + (l.basePrice + (l.bacon ? 1 : 0)) * l.quantity, 0);
        const pickup = new Date(Date.now() + 25 * 60_000);
        pickup.setSeconds(0, 0);
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
