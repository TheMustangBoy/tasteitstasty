import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useShop } from "@/context/shop";

type ListKey = "categories" | "ingredients" | "extras";

const slug = (value: string) =>
  value.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `id-${Date.now().toString(36)}`;

export function CatalogManager() {
  const {
    catalog,
    productRows,
    upsertCategory,
    deleteCategory,
    upsertIngredient,
    deleteIngredient,
    upsertExtra,
    deleteExtra,
    moveEntry,
  } = useShop();

  const [newCategory, setNewCategory] = useState("");
  const [newIngredient, setNewIngredient] = useState("");
  const [newExtra, setNewExtra] = useState("");
  const [newExtraPrice, setNewExtraPrice] = useState("1");
  const [pending, setPending] = useState<{ list: ListKey; id: string; label: string } | null>(null);

  const sorted = <T extends { sortOrder: number }>(list: T[]) =>
    [...list].sort((a, b) => a.sortOrder - b.sortOrder);

  const move = (list: ListKey, id: string, dir: -1 | 1) => moveEntry(list, id, dir);

  const confirmDelete = () => {
    if (!pending) return;
    if (pending.list === "categories") {
      if (productRows.some((p) => p.categoryId === pending.id)) {
        toast.error("Kategorie enthält noch Produkte", {
          description: "Produkte zuerst umziehen oder löschen.",
        });
        setPending(null);
        return;
      }
      deleteCategory(pending.id);
    }
    if (pending.list === "ingredients") deleteIngredient(pending.id);
    if (pending.list === "extras") deleteExtra(pending.id);
    toast.success("Eintrag gelöscht");
    setPending(null);
  };

  const MoveButtons = ({ list, id }: { list: ListKey; id: string }) => (
    <span className="flex shrink-0 gap-1">
      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => move(list, id, -1)} aria-label="Nach oben">
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => move(list, id, 1)} aria-label="Nach unten">
        <ArrowDown className="h-4 w-4" />
      </Button>
    </span>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-xl">Kategorien</h2>
        <div className="mt-4 space-y-2">
          {sorted(catalog.categories).map((c) => (
            <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={c.label}
                  onChange={(e) => upsertCategory({ ...c, label: e.target.value })}
                  className="h-11"
                />
                <Input
                  value={c.note}
                  placeholder="Hinweistext"
                  onChange={(e) => upsertCategory({ ...c, note: e.target.value })}
                  className="h-11"
                />
              </div>
              <span className="flex shrink-0 items-center">
                <MoveButtons list="categories" id={c.id} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-destructive"
                  onClick={() => setPending({ list: "categories", id: c.id, label: c.label })}
                  aria-label="Kategorie löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Neue Kategorie"
            className="h-11"
          />
          <Button
            variant="outline"
            className="h-11"
            disabled={!newCategory.trim()}
            onClick={() => {
              upsertCategory({
                id: slug(newCategory),
                label: newCategory.trim(),
                note: "",
                sortOrder: catalog.categories.length,
              });
              setNewCategory("");
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Anlegen
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-xl">Zutaten</h2>
        <div className="mt-4 space-y-2">
          {sorted(catalog.ingredients).map((i) => (
            <div key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <Input
                value={i.name}
                onChange={(e) => upsertIngredient({ ...i, name: e.target.value })}
                className="h-11"
              />
              <span className="flex shrink-0 items-center">
                <MoveButtons list="ingredients" id={i.id} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-destructive"
                  onClick={() => setPending({ list: "ingredients", id: i.id, label: i.name })}
                  aria-label="Zutat löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input
            value={newIngredient}
            onChange={(e) => setNewIngredient(e.target.value)}
            placeholder="Neue Zutat"
            className="h-11"
          />
          <Button
            variant="outline"
            className="h-11"
            disabled={!newIngredient.trim()}
            onClick={() => {
              upsertIngredient({
                id: slug(newIngredient),
                name: newIngredient.trim(),
                sortOrder: catalog.ingredients.length,
              });
              setNewIngredient("");
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Anlegen
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-xl">Extras</h2>
        <div className="mt-4 space-y-2">
          {sorted(catalog.extras).map((e) => (
            <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
                <Input
                  value={e.name}
                  onChange={(ev) => upsertExtra({ ...e, name: ev.target.value })}
                  className="h-11"
                />
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={e.price}
                  onChange={(ev) => upsertExtra({ ...e, price: Math.max(0, Number(ev.target.value) || 0) })}
                  className="h-11"
                />
              </div>
              <span className="flex shrink-0 items-center">
                <MoveButtons list="extras" id={e.id} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-destructive"
                  onClick={() => setPending({ list: "extras", id: e.id, label: e.name })}
                  aria-label="Extra löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_100px_auto] gap-2">
          <Input
            value={newExtra}
            onChange={(e) => setNewExtra(e.target.value)}
            placeholder="Neues Extra"
            className="h-11"
          />
          <Input
            type="number"
            step="0.5"
            min="0"
            value={newExtraPrice}
            onChange={(e) => setNewExtraPrice(e.target.value)}
            className="h-11"
          />
          <Button
            variant="outline"
            className="h-11"
            disabled={!newExtra.trim()}
            onClick={() => {
              upsertExtra({
                id: slug(newExtra),
                name: newExtra.trim(),
                price: Math.max(0, Number(newExtraPrice) || 0),
                sortOrder: catalog.extras.length,
              });
              setNewExtra("");
              setNewExtraPrice("1");
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Anlegen
          </Button>
        </div>
      </section>

      <AlertDialog open={Boolean(pending)} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>„{pending?.label}“ löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Eintrag wird aus dem Katalog und aus zugeordneten Produkten entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
