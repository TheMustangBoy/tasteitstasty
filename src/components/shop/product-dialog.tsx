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
import { BACON_EXTRA, formatPrice, REMOVABLE, type Extra, type MenuItem } from "@/data/menu";
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
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [variantId, setVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (open) {
      setRemoved([]);
      setExtraIds([]);
      setVariantId(item?.variants?.[0]?.id ?? "");
      setQuantity(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  if (!item) return null;

  const removable =
    item.removable && item.removable.length > 0
      ? item.removable
      : item.ingredients.filter((i) => (REMOVABLE as readonly string[]).includes(i));

  const availableExtras: Extra[] =
    item.extras && item.extras.length > 0
      ? item.extras
      : item.category === "burger"
        ? [BACON_EXTRA]
        : [];

  const variants = item.variants ?? [];
  const variant = variants.find((v) => v.id === variantId) ?? null;
  const selectedExtras = availableExtras.filter((e) => extraIds.includes(e.id));
  const unitPrice =
    item.price + (variant?.priceDelta ?? 0) + selectedExtras.reduce((s, e) => s + e.price, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">{item.name}</DialogTitle>
          <DialogDescription>
            {item.description
              ? item.description
              : item.patties
                ? `${item.patties >= 3 ? "Drei Patties" : "Double Patty"} · frisch gesmasht`
                : "Frisch frittiert"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.name}
              loading="lazy"
              className="h-40 w-full rounded-xl object-cover"
            />
          )}

          <section>
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Zutaten
            </h4>
            {item.ingredientsPlaceholder ? (
              <p className="mt-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-3 text-sm text-muted-foreground">
                Platzhalter: Zutaten werden noch ergänzt.
              </p>
            ) : item.ingredients.length ? (
              <p className="mt-2 text-sm text-foreground/90">{item.ingredients.join(", ")}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Ohne weitere Zutaten.</p>
            )}
          </section>

          {variants.length > 0 && (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Variante
              </h4>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    className={`flex items-center justify-between rounded-lg border p-3 text-sm transition-colors ${
                      v.id === variantId
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/40 hover:border-primary/50"
                    }`}
                  >
                    <span>{v.name}</span>
                    {v.priceDelta !== 0 && (
                      <span className="font-semibold text-primary">
                        {v.priceDelta > 0 ? "+" : "−"}
                        {formatPrice(Math.abs(v.priceDelta))}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

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

          {availableExtras.length > 0 && (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Extras
              </h4>
              <div className="mt-3 space-y-2">
                {availableExtras.map((extra) => (
                  <label
                    key={extra.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm"
                  >
                    <span className="flex items-center gap-3">
                      <Checkbox
                        checked={extraIds.includes(extra.id)}
                        onCheckedChange={(c) =>
                          setExtraIds((prev) =>
                            c ? [...prev, extra.id] : prev.filter((id) => id !== extra.id),
                          )
                        }
                      />
                      {extra.name}
                    </span>
                    <span className="font-semibold text-primary">+{formatPrice(extra.price)}</span>
                  </label>
                ))}
              </div>
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
              add(item, {
                removed,
                bacon: extraIds.includes(BACON_EXTRA.id),
                quantity,
                extras: selectedExtras,
                variant,
              });
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
