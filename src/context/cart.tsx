import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { BACON_EXTRA, type Extra, type MenuItem, type Variant } from "@/data/menu";

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
  variant?: Variant | null;
};

export type PlacedOrder = {
  reference: string;
  lines: CartLine[];
  total: number;
  pickupLabel: string;
  payment: string;
  name: string;
};

export const linePrice = (line: CartLine) => {
  const extras = line.extras ?? [];
  const extrasSum = extras.reduce((s, e) => s + e.price, 0);
  // Legacy-Zeilen ohne extras-Liste: Bacon separat verrechnen.
  const legacyBacon = extras.length === 0 && line.bacon ? BACON_EXTRA.price : 0;
  const variantDelta = line.variant?.priceDelta ?? 0;
  return (line.basePrice + variantDelta + extrasSum + legacyBacon) * line.quantity;
};

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
      variant?: Variant | null;
    },
  ) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  lastOrder: PlacedOrder | null;
  placeOrder: (data: Omit<PlacedOrder, "reference" | "lines" | "total">) => PlacedOrder;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<PlacedOrder | null>(null);

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
            variant: Variant | null | undefined,
          ) =>
            `${id}|${[...removed].sort().join(",")}|${(extras ?? [])
              .map((e) => e.id)
              .sort()
              .join(",")}|${variant?.id ?? ""}`;
          const signature = sig(item.id, opts.removed, opts.extras, opts.variant);
          const existing = prev.find(
            (l) => sig(l.itemId, l.removed, l.extras, l.variant) === signature,
          );
          if (existing) {
            return prev.map((l) =>
              l.lineId === existing.lineId
                ? { ...l, quantity: l.quantity + opts.quantity }
                : l,
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
              variant: opts.variant ?? null,
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
      placeOrder: (data) => {
        const order: PlacedOrder = {
          ...data,
          reference: `TIT-${Math.floor(1000 + Math.random() * 9000)}`,
          lines,
          total,
        };
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