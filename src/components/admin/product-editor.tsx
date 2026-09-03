import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
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

/** "8,50" und "8.50" akzeptieren; leere Eingabe ergibt 0. */
function parsePrice(input: string): number {
  const normalized = input.replace(",", ".").replace(/[^0-9.]/g, "");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Auswahl-Eintrag um eine Position verschieben. */
function moveOption<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const a = next[index]!;
  next[index] = next[target]!;
  next[target] = a;
  return next;
}

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
  const [priceText, setPriceText] = useState(
    product ? String(product.price).replace(".", ",") : "",
  );
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    setDraft(product);
    setPriceText(product ? String(product.price).replace(".", ",") : "");
    setShowErrors(false);
  }, [product]);

  const dirty = useMemo(
    () => Boolean(draft && product && JSON.stringify(draft) !== JSON.stringify(product)),
    [draft, product],
  );

  if (!draft) return null;
  const set = (patch: Partial<ProductRecord>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const categories = [...catalog.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const ingredients = [...catalog.ingredients].sort((a, b) => a.sortOrder - b.sortOrder);
  const extras = [...catalog.extras].sort((a, b) => a.sortOrder - b.sortOrder);

  const nameError = !draft.name.trim() ? "Name ist ein Pflichtfeld." : "";
  const priceError = priceText.trim() === "" ? "Preis ist ein Pflichtfeld." : "";
  const invalid = Boolean(nameError || priceError);

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
                <Label htmlFor="p-name">
                  Name <span className="text-primary">*</span>
                </Label>
                <Input
                  id="p-name"
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className="mt-2 h-12"
                  placeholder="z. B. Smash Burger"
                />
                {showErrors && nameError && (
                  <p className="mt-1 text-xs text-destructive">{nameError}</p>
                )}
              </div>
              <div>
                <Label htmlFor="p-cat">
                  Kategorie <span className="text-primary">*</span>
                </Label>
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
                <Label htmlFor="p-price">
                  Preis (€) <span className="text-primary">*</span>
                </Label>
                <Input
                  id="p-price"
                  inputMode="decimal"
                  value={priceText}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPriceText(next);
                    set({ price: parsePrice(next) });
                  }}
                  onBlur={() => {
                    if (priceText.trim() === "") return;
                    setPriceText(parsePrice(priceText).toFixed(2).replace(".", ","));
                  }}
                  className="mt-2 h-12"
                  placeholder="z. B. 8,50"
                />
                {showErrors && priceError && (
                  <p className="mt-1 text-xs text-destructive">{priceError}</p>
                )}
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
              <div>
                <Label htmlFor="p-tag">Badge / Label (optional)</Label>
                <Input
                  id="p-tag"
                  value={draft.tag}
                  onChange={(e) => set({ tag: e.target.value })}
                  className="mt-2 h-12"
                  placeholder="z. B. Klassiker – leer = kein Badge"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Leeres Feld blendet das Badge auf der Karte aus.
                </p>
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
                <Switch
                  checked={draft.vegetarian}
                  onCheckedChange={(v) => set({ vegetarian: v })}
                />{" "}
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
                <Label>Auswahl (optional, mehrfach wählbar)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    set({
                      options: [
                        ...draft.options,
                        {
                          id: `opt-${Date.now().toString(36)}`,
                          name: "",
                          priceDelta: 0,
                          active: true,
                        },
                      ],
                    })
                  }
                >
                  Auswahl hinzufügen
                </Button>
              </div>
              <div className="mt-2 space-y-2">
                {draft.options.map((v, i) => (
                  <div
                    key={v.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/20 p-3 md:grid md:grid-cols-[minmax(0,1fr)_110px_auto_auto_auto_auto] md:items-center md:gap-2 md:bg-transparent md:p-0 md:rounded-none"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground md:hidden">Bezeichnung</span>
                      <Input
                        value={v.name}
                        placeholder="z. B. Menü mit Pommes"
                        onChange={(e) =>
                          set({
                            options: draft.options.map((x, xi) =>
                              xi === i ? { ...x, name: e.target.value } : x,
                            ),
                          })
                        }
                        className="h-11"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground md:hidden">Aufpreis (€)</span>
                      <Input
                        type="number"
                        step="0.5"
                        value={v.priceDelta}
                        onChange={(e) =>
                          set({
                            options: draft.options.map((x, xi) =>
                              xi === i ? { ...x, priceDelta: Number(e.target.value) || 0 } : x,
                            ),
                          })
                        }
                        className="h-11"
                      />
                    </div>
                    <div className="flex items-center gap-2 md:justify-self-center">
                      <span className="text-xs text-muted-foreground md:hidden">Aktiv</span>
                      <Switch
                        checked={v.active !== false}
                        aria-label="Auswahl aktiv"
                        onCheckedChange={(c) =>
                          set({
                            options: draft.options.map((x, xi) =>
                              xi === i ? { ...x, active: c } : x,
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 md:contents">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11"
                        aria-label="Auswahl nach oben"
                        disabled={i === 0}
                        onClick={() => set({ options: moveOption(draft.options, i, -1) })}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11"
                        aria-label="Auswahl nach unten"
                        disabled={i === draft.options.length - 1}
                        onClick={() => set({ options: moveOption(draft.options, i, 1) })}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-11 text-destructive"
                        onClick={() => set({ options: draft.options.filter((_, xi) => xi !== i) })}
                      >
                        Entfernen
                      </Button>
                    </div>
                  </div>
                ))}
                {draft.options.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Noch keine Auswahl – z. B. „Menü mit Pommes“ mit Aufpreis.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-secondary/20 p-4">
              <Label>Vorschau (Kundenansicht)</Label>
              <p className="mt-2 font-display text-xl">{draft.name || "Ohne Namen"}</p>
              <p className="text-sm text-primary">{formatPrice(parsePrice(priceText))}</p>
              {draft.description && (
                <p className="mt-1 text-sm text-muted-foreground">{draft.description}</p>
              )}
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Zutaten abwählen
                  </p>
                  <p className="text-muted-foreground">
                    {draft.removable.length
                      ? draft.removable.map((n) => `Ohne ${n}`).join(" · ")
                      : "–"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Extras
                  </p>
                  <p className="text-muted-foreground">
                    {draft.extraIds.length
                      ? draft.extraIds
                          .map((id) => {
                            const e = extras.find((x) => x.id === id);
                            return e ? `${e.name} +${formatPrice(e.price)}` : id;
                          })
                          .join(" · ")
                      : "–"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Auswahl
                  </p>
                  <p className="text-muted-foreground">
                    {draft.options.filter((o) => o.active !== false).length
                      ? draft.options
                          .filter((o) => o.active !== false)
                          .map(
                            (o) =>
                              `${o.name || "Ohne Namen"}${
                                o.priceDelta ? ` +${formatPrice(o.priceDelta)}` : ""
                              }`,
                          )
                          .join(" · ")
                      : "–"}
                  </p>
                </div>
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
              onClick={() => {
                if (invalid) {
                  setShowErrors(true);
                  toast.error("Bitte Pflichtfelder ausfüllen");
                  return;
                }
                const saved = {
                  ...draft,
                  name: draft.name.trim(),
                  tag: draft.tag.trim(),
                  price: parsePrice(priceText),
                };

                upsertProduct(saved);
                toast.success("✓ Gespeichert", {
                  description: `${saved.name} · ${formatPrice(saved.price)}`,
                });
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
