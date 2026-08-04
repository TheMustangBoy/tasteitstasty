import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { BACON_EXTRA, formatPrice, REMOVABLE, type MenuItem } from "@/data/menu";
import { useCart } from "@/context/cart";

export function ProductDialog({
  item,
  open,
  onOpenChange,
}: {
  item: MenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { add } = useCart();
  const [removed, setRemoved] = useState<string[]>([]);
  const [bacon, setBacon] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (open) {
      setRemoved([]);
      setBacon(false);
      setQuantity(1);
    }
  }, [open, item?.id]);

  if (!item) return null;

  const removable = item.ingredients.filter((i) =>
    (REMOVABLE as readonly string[]).includes(i),
  );
  const unitPrice = item.price + (bacon ? BACON_EXTRA.price : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">{item.name}</DialogTitle>
          <DialogDescription>
            {item.patties
              ? `${item.patties === 3 ? "Drei Patties" : "Double Patty"} · frisch gesmasht`
              : "Frisch frittiert"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section>
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Zutaten
            </h4>
            {item.ingredientsPlaceholder ? (
              <p className="mt-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-3 text-sm text-muted-foreground">
                Platzhalter: Zutaten für den Tasty Burger werden noch ergänzt.
              </p>
            ) : item.ingredients.length ? (
              <p className="mt-2 text-sm text-foreground/90">{item.ingredients.join(", ")}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Ohne weitere Zutaten.</p>
            )}
          </section>

          {removable.length > 0 && (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Abwählen
              </h4>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {removable.map((ingredient) => {
                  const isRemoved = removed.includes(ingredient);
                  return (
                    <label
                      key={ingredient}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm"
                    >
                      <Checkbox
                        checked={isRemoved}
                        onCheckedChange={(checked) =>
                          setRemoved((prev) =>
                            checked ? [...prev, ingredient] : prev.filter((i) => i !== ingredient),
                          )
                        }
                      />
                      <span className={isRemoved ? "line-through opacity-60" : ""}>
                        Ohne {ingredient}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {item.category === "burger" && (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Extra
              </h4>
              <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                <span className="flex items-center gap-3">
                  <Checkbox checked={bacon} onCheckedChange={(c) => setBacon(Boolean(c))} />
                  Bacon
                </span>
                <span className="font-semibold text-primary">+{formatPrice(BACON_EXTRA.price)}</span>
              </label>
            </section>
          )}

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 rounded-full border border-border p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Menge verringern"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-6 text-center font-display text-lg">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                aria-label="Menge erhöhen"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <span className="font-display text-2xl">{formatPrice(unitPrice * quantity)}</span>
          </div>

          <Button
            size="lg"
            className="h-14 w-full rounded-xl bg-flame text-base font-bold uppercase tracking-wide text-primary-foreground shadow-flame hover:opacity-90"
            onClick={() => {
              add(item, { removed, bacon, quantity });
              onOpenChange(false);
              toast.success("Zum Warenkorb hinzugefügt", {
                description: `${quantity}× ${item.name}`,
              });
            }}
          >
            In den Warenkorb
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}