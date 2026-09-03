import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BACON_EXTRA, type Extra, type MenuItem, type SelectionOption } from "@/data/menu";

const STORAGE_KEY = "tit-cart-v1";

export type CartLine = {
  lineId: string;
  itemId: string;
  name: string;
  basePrice: number;
  quantity: number;
  removed: string[];
  bacon: boolean;
  /** Ausgewählte Extras (inkl. Bacon, falls gewählt). */
  extras?: Extra[];
  /** Gewählte Auswahl-Optionen (Mehrfachwahl). */
  options?: SelectionOption[];
  /** @deprecated Alte Einzel-Variante aus gespeicherten Warenkörben. */
  variant?: SelectionOption | null;
};

export type PlacedOrder = {
  reference: string;
  lines: CartLine[];
  total: number;
  pickupLabel: string;
  /** ISO-Zeitpunkt der Abholung – Basis für die 2-Stunden-Regel. */
  pickupISO: string;
  payment: string;
  name: string;
};

/** Eine Bestellung bleibt bis 2 Stunden nach der Abholzeit lokal sichtbar. */
export const ORDER_ACTIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Ablaufzeitpunkt der lokalen Anzeige (null bei fehlendem/ungültigem pickupISO). */
export function orderExpiresAt(order: Pick<PlacedOrder, "pickupISO"> | null | undefined) {
  if (!order?.pickupISO) return null;
  const pickup = new Date(order.pickupISO).getTime();
  if (!Number.isFinite(pickup)) return null;
  return new Date(pickup + ORDER_ACTIVE_WINDOW_MS);
}

/** Legacy-Bestellungen ohne pickupISO gelten als abgelaufen und werden bereinigt. */
export function isOrderActive(
  order: Pick<PlacedOrder, "pickupISO"> | null | undefined,
  now: number = Date.now(),
): boolean {
  const expires = orderExpiresAt(order);
  return expires ? expires.getTime() > now : false;
}


export const linePrice = (line: CartLine) => {
  const extras = line.extras ?? [];
  const extrasSum = extras.reduce((s, e) => s + e.price, 0);
  // Legacy-Zeilen ohne extras-Liste: Bacon separat verrechnen.
  const legacyBacon = extras.length === 0 && line.bacon ? BACON_EXTRA.price : 0;
  const optionsSum = (line.options ?? []).reduce((s, o) => s + o.priceDelta, 0);
  const legacyVariant = (line.options ?? []).length === 0 ? (line.variant?.priceDelta ?? 0) : 0;
  return (line.basePrice + optionsSum + legacyVariant + extrasSum + legacyBacon) * line.quantity;
};

/** Zeilen-Beschriftung der gewählten Optionen (inkl. Legacy-Variante). */
export const lineOptions = (line: CartLine): SelectionOption[] =>
  (line.options ?? []).length > 0 ? line.options! : line.variant ? [line.variant] : [];

type CartContextValue = {
  lines: CartLine[];
  count: number;
  total: number;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  add: (
    item: MenuItem,
    opts: {
      removed: string[];
      bacon: boolean;
      quantity: number;
      extras?: Extra[];
      options?: SelectionOption[];
    },
  ) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  lastOrder: PlacedOrder | null;
  /** Bestellung nur, solange sie innerhalb des 2-Stunden-Fensters liegt. */
  activeOrder: PlacedOrder | null;
  placeOrder: (
    data: Omit<PlacedOrder, "reference" | "lines" | "total"> & {
      reference?: string;
      lines?: CartLine[];
      total?: number;
    },
  ) => PlacedOrder;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<PlacedOrder | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [nowTick, setNowTick] = useState(0);

  // Erst nach dem Mount lesen, damit SSR und erster Client-Render identisch sind.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { lines?: CartLine[]; lastOrder?: PlacedOrder | null };
        if (Array.isArray(parsed.lines)) setLines(parsed.lines);
        // Abgelaufene bzw. Legacy-Bestellungen ohne pickupISO werden verworfen.
        if (parsed.lastOrder && isOrderActive(parsed.lastOrder)) setLastOrder(parsed.lastOrder);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Minütlich prüfen, damit die Bestellung nach Ablauf von selbst verschwindet.
  useEffect(() => {
    const timer = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (lastOrder && !isOrderActive(lastOrder)) setLastOrder(null);
  }, [hydrated, lastOrder, nowTick]);


  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, lastOrder }));
    } catch {
      /* ignore */
    }
  }, [hydrated, lines, lastOrder]);

  const value = useMemo<CartContextValue>(() => {
    const total = lines.reduce((sum, line) => sum + linePrice(line), 0);
    return {
      lines,
      total,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      isOpen,
      setOpen,
      add: (item, opts) =>
        setLines((prev) => {
          const sig = (
            id: string,
            removed: string[],
            extras: Extra[] | undefined,
            options: SelectionOption[] | undefined,
          ) =>
            `${id}|${[...removed].sort().join(",")}|${(extras ?? [])
              .map((e) => e.id)
              .sort()
              .join(",")}|${(options ?? [])
              .map((o) => o.id)
              .sort()
              .join(",")}`;
          const signature = sig(item.id, opts.removed, opts.extras, opts.options);
          const existing = prev.find(
            (l) => sig(l.itemId, l.removed, l.extras, lineOptions(l)) === signature,
          );
          if (existing) {
            return prev.map((l) =>
              l.lineId === existing.lineId ? { ...l, quantity: l.quantity + opts.quantity } : l,
            );
          }
          return [
            ...prev,
            {
              lineId: `${item.id}-${Date.now()}-${prev.length}`,
              itemId: item.id,
              name: item.name,
              basePrice: item.price,
              quantity: opts.quantity,
              removed: opts.removed,
              bacon: opts.bacon,
              extras: opts.extras ?? [],
              options: opts.options ?? [],
            },
          ];
        }),
      setQuantity: (lineId, quantity) =>
        setLines((prev) =>
          quantity <= 0
            ? prev.filter((l) => l.lineId !== lineId)
            : prev.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)),
        ),
      remove: (lineId) => setLines((prev) => prev.filter((l) => l.lineId !== lineId)),
      clear: () => setLines([]),
      lastOrder,
      activeOrder: lastOrder && isOrderActive(lastOrder) ? lastOrder : null,
      placeOrder: (data) => {
        // Eine neue Bestellung ersetzt immer die vorherige (nur eine aktive).
        const order: PlacedOrder = {
          ...data,
          reference: data.reference ?? `TIT-${Math.floor(1000 + Math.random() * 9000)}`,
          lines: data.lines ?? lines,
          total: data.total ?? total,
        };
        // Synchron persistieren, damit ein Reload/Navigation direkt nach der
        // Bestellung die Bestätigung noch findet (Effect läuft erst später).
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines: [], lastOrder: order }));
        } catch {
          /* ignore */
        }
        setLastOrder(order);
        setLines([]);
        return order;
      },
    };
  }, [lines, isOpen, lastOrder]);


  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
