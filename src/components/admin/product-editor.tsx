import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useShop, type ProductRecord } from "@/context/shop";
import { formatPrice } from "@/data/menu";

export function ProductEditor({
  product,
  open,
  onOpenChange,
}: {
  product: ProductRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { catalog, upsertProduct } = useShop();
  const [draft, setDraft] = useState<ProductRecord | null>(product);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => setDraft(product), [product]);

  const dirty = useMemo(
    () => Boolean(draft && product && JSON.stringify(draft) !== JSON.stringify(product)),
    [draft, product],
  );

  if (!draft) return null;
  const set = (patch: Partial<ProductRecord>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const categories = [...catalog.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const ingredients = [...catalog.ingredients].sort((a, b) => a.sortOrder - b.sortOrder);
  const extras = [...catalog.extras].sort((a, b) => a.sortOrder - b.sortOrder);

  const close = () => {
    if (dirty) setConfirmDiscard(true);
    else onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{product?.name ? "Produkt bearbeiten" : "Neues Produkt"}</DialogTitle>
            <DialogDescription>
              Änderungen wirken nach dem Speichern sofort in der Kundenansicht.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="p-name">Name</Label>
                <Input
                  id="p-name"
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className="mt-2 h-12"
                  placeholder="z. B. Smash Burger"
                />
              </div>
              <div>
                <Label htmlFor="p-cat">Kategorie</Label>
                <select
                  id="p-cat"
                  value={draft.categoryId}
                  onChange={(e) => set({ categoryId: e.target.value })}
                  className="mt-2 h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="p-price">Preis (€)</Label>
                <Input
                  id="p-price"
                  type="number"
                  step="0.5"
                  min="0"
                  value={draft.price}
                  onChange={(e) => set({ price: Math.max(0, Number(e.target.value) || 0) })}
                  className="mt-2 h-12"
                />
              </div>
              <div>
                <Label htmlFor="p-patties">Patty-Anzahl (leer = keine)</Label>
                <Input
                  id="p-patties"
                  type="number"
                  min="0"
                  max="5"
                  value={draft.patties ?? ""}
                  onChange={(e) =>
                    set({ patties: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className="mt-2 h-12"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="p-img">Bild-URL (optional)</Label>
                <Input
                  id="p-img"
                  value={draft.imageUrl}
                  onChange={(e) => set({ imageUrl: e.target.value })}
                  className="mt-2 h-12"
                  placeholder="https://… (Platzhalter, solange kein Bild hinterlegt ist)"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="p-desc">Beschreibung</Label>
                <Textarea
                  id="p-desc"
                  value={draft.description}
                  onChange={(e) => set({ description: e.target.value })}
                  className="mt-2"
                  placeholder="Kurzbeschreibung für die Speisekarte"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 rounded-xl border border-border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={draft.active} onCheckedChange={(v) => set({ active: v })} /> Aktiv
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={draft.soldOut} onCheckedChange={(v) => set({ soldOut: v })} />{" "}
                Ausverkauft
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={draft.vegetarian} onCheckedChange={(v) => set({ vegetarian: v })} />{" "}
                Vegetarisch
              </label>
            </div>

            <section>
              <Label>Enthaltene Zutaten</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {ingredients.map((ing) => {
                  const on = draft.ingredients.includes(ing.name);
                  return (
                    <label
                      key={ing.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-2 text-sm"
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={(c) =>
                          set({
                            ingredients: c
                              ? [...draft.ingredients, ing.name]
                              : draft.ingredients.filter((n) => n !== ing.name),
                            removable: c
                              ? draft.removable
                              : draft.removable.filter((n) => n !== ing.name),
                          })
                        }
                      />
                      {ing.name}
                    </label>
                  );
                })}
              </div>
            </section>

            <section>
              <Label>Davon abwählbar</Label>
              {draft.ingredients.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Zuerst Zutaten auswählen.</p>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {draft.ingredients.map((name) => (
                    <label
                      key={name}
                      className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-2 text-sm"
                    >
                      <Checkbox
                        checked={draft.removable.includes(name)}
                        onCheckedChange={(c) =>
                          set({
                            removable: c
                              ? [...draft.removable, name]
                              : draft.removable.filter((n) => n !== name),
                          })
                        }
                      />
                      Ohne {name}
                    </label>
                  ))}
                </div>
              )}
            </section>

            <section>
              <Label>Extras</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {extras.map((extra) => (
                  <label
                    key={extra.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-2 text-sm"
                  >
                    <span className="flex items-center gap-3">
                      <Checkbox
                        checked={draft.extraIds.includes(extra.id)}
                        onCheckedChange={(c) =>
                          set({
                            extraIds: c
                              ? [...draft.extraIds, extra.id]
                              : draft.extraIds.filter((id) => id !== extra.id),
                          })
                        }
                      />
                      {extra.name}
                    </span>
                    <span className="text-primary">+{formatPrice(extra.price)}</span>
                  </label>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between">
                <Label>Varianten</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    set({
                      variants: [
                        ...draft.variants,
                        { id: `var-${Date.now().toString(36)}`, name: "", priceDelta: 0 },
                      ],
                    })
                  }
                >
                  Variante hinzufügen
                </Button>
              </div>
              <div className="mt-2 space-y-2">
                {draft.variants.map((v, i) => (
                  <div key={v.id} className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2">
                    <Input
                      value={v.name}
                      placeholder="z. B. Menü mit Pommes"
                      onChange={(e) =>
                        set({
                          variants: draft.variants.map((x, xi) =>
                            xi === i ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                      className="h-11"
                    />
                    <Input
                      type="number"
                      step="0.5"
                      value={v.priceDelta}
                      onChange={(e) =>
                        set({
                          variants: draft.variants.map((x, xi) =>
                            xi === i ? { ...x, priceDelta: Number(e.target.value) || 0 } : x,
                          ),
                        })
                      }
                      className="h-11"
                    />
                    <Button
                      variant="ghost"
                      className="h-11 text-destructive"
                      onClick={() =>
                        set({ variants: draft.variants.filter((_, xi) => xi !== i) })
                      }
                    >
                      Entfernen
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            {dirty && (
              <p className="flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
                Ungespeicherte Änderungen.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="h-12" onClick={close}>
              Verwerfen
            </Button>
            <Button
              className="h-12 bg-flame font-bold uppercase text-primary-foreground"
              disabled={!draft.name.trim()}
              onClick={() => {
                upsertProduct({ ...draft, name: draft.name.trim() });
                onOpenChange(false);
              }}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Änderungen verwerfen?</AlertDialogTitle>
            <AlertDialogDescription>
              Es gibt ungespeicherte Änderungen an diesem Produkt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiter bearbeiten</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDraft(product);
                setConfirmDiscard(false);
                onOpenChange(false);
              }}
            >
              Verwerfen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
