import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/data/menu";
import { linePrice, useCart } from "@/context/cart";

export function CartDrawer() {
  const { lines, isOpen, setOpen, setQuantity, remove, total, count } = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Drawer schließt nach Navigation – nicht im Klick-Handler, sonst bricht der Link ab.
  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <ShoppingBag className="h-5 w-5 text-primary" /> Warenkorb
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">Dein Warenkorb ist noch leer.</p>
              <Button asChild variant="secondary">
                <Link to="/speisekarte">Zur Speisekarte</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-4">
              {lines.map((line) => (
                <li key={line.lineId} className="rounded-xl border border-border bg-card p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{line.name}</p>
                      {line.bacon && <p className="text-xs text-primary">+ Bacon</p>}
                      {line.removed.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ohne {line.removed.join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-display">{formatPrice(linePrice(line))}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setQuantity(line.lineId, line.quantity - 1)}
                        aria-label="Menge verringern"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-5 text-center text-sm font-semibold">{line.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setQuantity(line.lineId, line.quantity + 1)}
                        aria-label="Menge erhöhen"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => remove(line.lineId)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Entfernen
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t border-border p-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{count} Artikel · Abholung</span>
              <span>Nur Abholung möglich</span>
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-sm uppercase tracking-wide text-muted-foreground">Summe</span>
              <span className="font-display text-2xl">{formatPrice(total)}</span>
            </div>
            <Button
              asChild
              size="lg"
              className="mt-4 h-14 w-full rounded-xl bg-flame text-base font-bold uppercase tracking-wide text-primary-foreground shadow-flame hover:opacity-90"
            >
              <Link to="/checkout">Zur Kasse</Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}