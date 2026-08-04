import { Clock, Phone, StickyNote, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/data/menu";
import { linePrice } from "@/context/cart";
import { STATUS_LABEL, type OrderStatus, type ShopOrder } from "@/context/shop";

const STATUS_STYLE: Record<OrderStatus, string> = {
  neu: "bg-primary/20 text-primary border-primary/50",
  angenommen: "bg-accent/15 text-accent border-accent/40",
  zubereitung: "bg-accent/15 text-accent border-accent/40",
  abholbereit: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  abgeschlossen: "bg-muted text-muted-foreground border-border",
  abgelehnt: "bg-destructive/15 text-destructive border-destructive/40",
};

const NEXT_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  angenommen: { to: "zubereitung", label: "In Zubereitung" },
  zubereitung: { to: "abholbereit", label: "Abholbereit" },
  abholbereit: { to: "abgeschlossen", label: "Abgeschlossen" },
};

export function OrderCard({
  order,
  onStatus,
}: {
  order: ShopOrder;
  onStatus: (status: OrderStatus) => void;
}) {
  const next = NEXT_STATUS[order.status];

  return (
    <article className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl">{order.reference}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" /> Abholung: {order.pickupLabel}
          </p>
        </div>
        <Badge variant="outline" className={`shrink-0 ${STATUS_STYLE[order.status]}`}>
          {STATUS_LABEL[order.status]}
        </Badge>
      </header>

      <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <User className="h-4 w-4" /> {order.name || "Gast"}
        </p>
        {order.phone && (
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4" /> {order.phone}
          </p>
        )}
        {order.note && (
          <p className="flex items-start gap-2">
            <StickyNote className="mt-0.5 h-4 w-4" /> {order.note}
          </p>
        )}
      </div>

      <ul className="mt-4 space-y-2 rounded-xl border border-border/70 bg-background/40 p-3 text-sm">
        {order.lines.map((line) => (
          <li key={line.lineId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {line.quantity}× {line.name}
              </span>
              {line.bacon && <span className="block text-xs text-primary">+ Bacon</span>}
              {line.removed.length > 0 && (
                <span className="block text-xs text-muted-foreground">
                  ohne {line.removed.join(", ")}
                </span>
              )}
            </span>
            <span className="shrink-0">{formatPrice(linePrice(line))}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {order.payment}
        </span>
        <span className="font-display text-2xl">{formatPrice(order.total)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {order.status === "neu" && (
          <>
            <Button
              className="h-12 flex-1 rounded-xl bg-flame font-bold uppercase text-primary-foreground"
              onClick={() => onStatus("angenommen")}
            >
              Annehmen
            </Button>
            <Button
              variant="outline"
              className="h-12 flex-1 rounded-xl border-destructive/50 font-bold uppercase text-destructive"
              onClick={() => onStatus("abgelehnt")}
            >
              Ablehnen
            </Button>
          </>
        )}
        {next && (
          <Button
            variant="secondary"
            className="h-12 flex-1 rounded-xl font-bold uppercase"
            onClick={() => onStatus(next.to)}
          >
            {next.label}
          </Button>
        )}
        {(order.status === "abgeschlossen" || order.status === "abgelehnt") && (
          <Button
            variant="ghost"
            className="h-11 flex-1 rounded-xl text-muted-foreground"
            onClick={() => onStatus("neu")}
          >
            Zurück auf „Neu“
          </Button>
        )}
      </div>
    </article>
  );
}
