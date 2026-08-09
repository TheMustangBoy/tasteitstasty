import { useEffect, useState } from "react";
import { Clock, Phone, RotateCcw, StickyNote, Timer, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { WheelField } from "@/components/ui/wheel-picker";
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
import { formatPrice } from "@/data/menu";
import { lineOptions, linePrice } from "@/context/cart";
import {
  CANCEL_REASONS,
  ORDER_STATUSES,
  STATUS_LABEL,
  type CancelReason,
  type OrderStatus,
  type ShopOrder,
} from "@/context/shop";

const STATUS_STYLE: Record<OrderStatus, string> = {
  neu: "bg-primary/20 text-primary border-primary/50",
  angenommen: "bg-accent/15 text-accent border-accent/40",
  zubereitung: "bg-accent/15 text-accent border-accent/40",
  abholbereit: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  abgeschlossen: "bg-muted text-muted-foreground border-border",
  abgelehnt: "bg-destructive/15 text-destructive border-destructive/40",
  storniert: "bg-destructive/15 text-destructive border-destructive/40",
};

const NEXT_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  angenommen: { to: "zubereitung", label: "In Zubereitung" },
  zubereitung: { to: "abholbereit", label: "Abholbereit" },
};

/** Minuten seit einem ISO-Zeitstempel, gerundet. */
function minutesSince(iso: string | undefined, now: number) {
  if (!iso) return null;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

export function OrderCard({
  order,
  onStatus,
  onNote,
  onCancel,
  onRestore,
}: {
  order: ShopOrder;
  onStatus: (status: OrderStatus) => void;
  onNote?: (note: string) => void;
  onCancel?: (reason: CancelReason, note: string) => void;
  onRestore?: (status: OrderStatus) => void;
}) {
  const next = NEXT_STATUS[order.status];
  const [note, setNote] = useState(order.internalNote ?? "");
  useEffect(() => setNote(order.internalNote ?? ""), [order.internalNote]);

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [reason, setReason] = useState<CancelReason>("kunde");
  const [reasonNote, setReasonNote] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<OrderStatus>("angenommen");

  const readyMinutes =
    order.status === "abholbereit" && now ? minutesSince(order.timestamps?.readyAt, now) : null;
  const overdue = readyMinutes !== null && readyMinutes >= 10;
  const isClosed =
    order.status === "abgeschlossen" ||
    order.status === "abgelehnt" ||
    order.status === "storniert";

  // Neue Bestellungen kurz hervorheben, danach normale Darstellung.
  const [fresh, setFresh] = useState(order.status === "neu");
  useEffect(() => {
    if (order.status !== "neu") {
      setFresh(false);
      return;
    }
    setFresh(true);
    const t = setTimeout(() => setFresh(false), 6000);
    return () => clearTimeout(t);
  }, [order.status, order.id]);

  const isReady = order.status === "abholbereit";

  return (
    <article
      className={`rounded-2xl border bg-card p-4 transition-shadow sm:p-5 ${
        fresh ? "order-card-fresh border-primary/70" : "border-border"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`font-display leading-none tracking-wide ${
              isReady ? "text-5xl text-emerald-400 sm:text-6xl" : "text-3xl sm:text-4xl"
            }`}
          >
            {order.reference}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" /> Abholung: {order.pickupLabel}
          </p>
        </div>
        <Badge variant="outline" className={`shrink-0 ${STATUS_STYLE[order.status]}`}>
          {STATUS_LABEL[order.status]}
        </Badge>
      </header>

      {readyMinutes !== null && (
        <p
          className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
            overdue
              ? "border-primary/60 bg-primary/10 text-primary"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          }`}
        >
          <Timer className="h-4 w-4 shrink-0" />
          Abholbereit seit {readyMinutes} Min.
          {overdue && <span className="font-normal">· Abholung überfällig</span>}
        </p>
      )}

      <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <User className="h-4 w-4" /> {order.name || "Gast"}
        </p>
        {order.phone && (
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0" />
            <a
              href={`tel:${order.phone.replace(/[^+\d]/g, "")}`}
              className="font-semibold text-foreground underline underline-offset-4"
            >
              {order.phone}
            </a>
          </p>
        )}
        {order.note && (
          <p className="flex items-start gap-2">
            <StickyNote className="mt-0.5 h-4 w-4" /> {order.note}
          </p>
        )}
        {order.cancelReason && (
          <p className="text-destructive">
            Storniert: {CANCEL_REASONS.find((r) => r.value === order.cancelReason)?.label}
            {order.cancelNote ? ` – ${order.cancelNote}` : ""}
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
              {lineOptions(line).length > 0 && (
                <span className="block text-xs text-muted-foreground">
                  {lineOptions(line)
                    .map((o) => o.name)
                    .join(", ")}
                </span>
              )}
              {(line.extras?.length || line.bacon) && (
                <span className="block text-xs text-primary">
                  + {(line.extras?.length ? line.extras.map((e) => e.name) : ["Bacon"]).join(", ")}
                </span>
              )}
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
        {!isClosed && order.status !== "neu" && (
          <>
            <Button
              className="h-12 flex-1 rounded-xl bg-flame font-bold uppercase text-primary-foreground"
              onClick={() => setCompleteOpen(true)}
            >
              Bestellung abschließen
            </Button>
            <Button
              variant="outline"
              className="h-12 flex-1 rounded-xl border-destructive/50 font-bold uppercase text-destructive"
              onClick={() => setCancelOpen(true)}
            >
              Stornieren
            </Button>
          </>
        )}
        {isClosed && onRestore && (
          <Button
            variant="ghost"
            className="h-11 flex-1 rounded-xl text-muted-foreground"
            onClick={() => setRestoreOpen(true)}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Reaktivieren
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-4 rounded-xl border border-border/70 bg-background/40 p-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Status
          </p>
          <WheelField
            ariaLabel="Bestellstatus wählen"
            title="Bestellstatus ändern"
            description="Status auswählen und mit „Bestätigen“ übernehmen."
            confirmLabel="Bestätigen"
            value={order.status}
            options={ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            onChange={(v) => onStatus(v as OrderStatus)}
          />
        </div>
        {onNote && (
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Interne Notiz
            </p>
            <Textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                onNote(e.target.value);
              }}
              onBlur={() => note !== (order.internalNote ?? "") && onNote(note)}
              placeholder="Nur intern sichtbar, z. B. Sonderwunsch oder Rückruf"
              className="min-h-[132px]"
            />
          </div>
        )}
      </div>

      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestellung {order.reference} abschließen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Bestellung wird als abgeschlossen markiert und in die Historie verschoben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => onStatus("abgeschlossen")}>
              Abschließen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestellung {order.reference} stornieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Bitte einen Grund angeben. Stornierte Bestellungen bleiben in der Historie sichtbar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              {CANCEL_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
                    reason === r.value ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name={`cancel-${order.id}`}
                    className="accent-primary"
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
            {reason === "sonstiges" && (
              <div>
                <Label htmlFor={`cancel-note-${order.id}`}>Freitext (optional)</Label>
                <Input
                  id={`cancel-note-${order.id}`}
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  className="mt-2 h-12"
                  placeholder="z. B. Truck defekt"
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Zurück</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                onCancel
                  ? onCancel(reason, reason === "sonstiges" ? reasonNote.trim() : "")
                  : onStatus("storniert")
              }
            >
              Stornieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestellung {order.reference} reaktivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Bestellung erscheint wieder unter „Offene Bestellungen“.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            {(["neu", "angenommen", "zubereitung", "abholbereit"] as OrderStatus[]).map((s) => (
              <label
                key={s}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
                  restoreStatus === s ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name={`restore-${order.id}`}
                  className="accent-primary"
                  checked={restoreStatus === s}
                  onChange={() => setRestoreStatus(s)}
                />
                Zurücksetzen auf „{STATUS_LABEL[s]}“
              </label>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => onRestore?.(restoreStatus)}>
              Reaktivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
