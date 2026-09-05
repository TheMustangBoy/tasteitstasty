import { Plus } from "lucide-react";
import { formatPrice, pattyLabel, type MenuItem } from "@/data/menu";

export function ProductCard({
  item,
  onSelect,
  soldOut = false,
}: {
  item: MenuItem;
  onSelect: () => void;
  soldOut?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={soldOut}
      aria-disabled={soldOut}
      className="group relative flex w-full gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/60 hover:shadow-flame focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {item.imageUrl && (
        <div className="w-[32%] shrink-0 self-start overflow-hidden rounded-xl border border-border bg-secondary/30 sm:w-[30%]">
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            className="aspect-square h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
        {item.tag && (
          <span className="absolute right-3 top-3 z-10 max-w-[45%] rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
            {item.tag}
          </span>
        )}
        <div className="min-w-0">
          <h3 className={`min-w-0 break-words text-lg font-normal ${item.tag ? "pr-24" : ""}`}>
            {item.name}
          </h3>
          {soldOut && (
            <p className="mt-2 inline-block rounded-full bg-destructive/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive">
              Ausverkauft
            </p>
          )}

          <p className="mt-2 text-sm text-muted-foreground">
            {item.description
              ? item.description
              : item.ingredientsPlaceholder
                ? "Zutaten folgen (Platzhalter)"
                : item.ingredients.length
                  ? item.ingredients.join(" · ")
                  : "Frisch frittiert"}
          </p>
          {pattyLabel(item) && (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {pattyLabel(item)}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-xl text-foreground">{formatPrice(item.price)}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-flame px-3 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground">
            <Plus className="h-4 w-4" /> {soldOut ? "Aus" : "Wählen"}
          </span>
        </div>
      </div>
    </button>
  );
}
