import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/data/menu";
import { useCart } from "@/context/cart";

const HIDDEN_ON = ["/checkout", "/bestellung", "/admin"];

/** Schwebende Warenkorb-Leiste – erscheint ab dem ersten Artikel. */
export function CartBar() {
  const { count, total, setOpen, isOpen } = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (count === 0 || isOpen || HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-primary/40 bg-card/95 p-3 shadow-flame backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-flame text-primary-foreground">
            <ShoppingBag className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-background px-1 text-center text-xs font-bold text-foreground">
              {count}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm text-muted-foreground">
              {count} {count === 1 ? "Artikel" : "Artikel"} · Abholung
            </span>
            <span className="block font-display text-xl leading-tight">{formatPrice(total)}</span>
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            className="h-12 rounded-xl px-4 font-semibold"
            onClick={() => setOpen(true)}
          >
            Zum Warenkorb
          </Button>
          <Button
            asChild
            className="hidden h-12 rounded-xl bg-flame px-4 font-bold uppercase text-primary-foreground sm:inline-flex"
          >
            <Link to="/checkout">Zur Kasse</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
