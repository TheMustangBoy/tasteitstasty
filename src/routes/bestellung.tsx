import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BUSINESS, formatPrice } from "@/data/menu";
import { linePrice, useCart, type CartLine } from "@/context/cart";
import {
  clearPendingPayment,
  readPendingPayment,
  writePendingPayment,
  type PendingPayment,
} from "@/lib/pending-order";
import { waitForPaidReservation } from "@/lib/payments/client";
import type { ReservationStatusValue } from "@/lib/payments/config";

export const Route = createFileRoute("/bestellung")({
  head: () => ({
    meta: [
      { title: "Bestellbestätigung – Taste It's Tasty" },
      {
        name: "description",
        content: "Deine Abholbestellung beim Food Truck Taste It's Tasty in Dachau.",
      },
      { property: "og:title", content: "Bestellbestätigung – Taste It's Tasty" },
      { property: "og:description", content: "Abholbestellung bestätigt." },
    ],
  }),
  component: OrderPage,
});

type RedirectPhase =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "pending" }
  | { phase: "done"; status: ReservationStatusValue };

function OrderPage() {
  const { activeOrder, clear, placeOrder } = useCart();
  const lastOrder = activeOrder;
  // Rückkehr aus einem Stripe-Redirect (z. B. 3-D-Secure) ohne lokalen Bestellstand.
  const [redirectState, setRedirectState] = useState<RedirectPhase>({ phase: "idle" });
  // Reservierungsdaten intern halten, damit die URL bereinigt werden kann,
  // ein späterer erneuter Check aber weiterhin möglich bleibt.
  const ticketRef = useRef<PendingPayment | null>(null);
  const [reference, setReference] = useState("");
  const [attempt, setAttempt] = useState(0);
  // Stabile Referenzen: der Statuscheck darf nicht bei jeder Warenkorbänderung neu starten.
  const actionsRef = useRef({ clear, placeOrder });
  actionsRef.current = { clear, placeOrder };

  // Eine frische Onlinezahlung hat immer Vorrang vor einer älteren Bestellung.
  const [dismissedFailure, setDismissedFailure] = useState(false);

  useEffect(() => {
    if (!ticketRef.current) {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = {
        reservation: params.get("reservation"),
        token: params.get("token"),
        reference: params.get("ref"),
      };
      const stored = readPendingPayment();
      const ticket = resolvePendingTicket(fromUrl, stored);
      if (!ticket) {
        setRedirectState({ phase: "idle" });
        return;
      }
      if (fromUrl.reservation && fromUrl.token) {
        // Erst dauerhaft sichern, dann die URL bereinigen – ein Reload
        // während `pending` verliert den Token dadurch nicht mehr.
        writePendingPayment(ticket);
        window.history.replaceState({}, "", window.location.pathname);
      }
      ticketRef.current = ticket;
      setReference(ticket.reference);
    }
    const ticket = ticketRef.current;
    if (!pendingTakesPrecedence(ticket, !!lastOrder)) {
      ticketRef.current = null;
      setRedirectState({ phase: "idle" });
      return;
    }
    let active = true;
    setRedirectState({ phase: "checking" });
    void waitForPaidReservation(ticket.reservation, ticket.token).then((status) => {
      if (!active) return;
      if (status === "paid") {
        // Bezahlte Bestellung lokal sichtbar machen und Warenkorb leeren.
        const snap = ticket.snapshot;
        if (snap) {
          actionsRef.current.placeOrder({
            reference: ticket.reference || snap.reference,
            lines: (snap.lines ?? []) as CartLine[],
            total: snap.total,
            pickupLabel: snap.pickupLabel,
            pickupISO: snap.pickupISO,
            payment: snap.payment,
            name: snap.name,
          });
        } else {
          actionsRef.current.clear();
        }
      }
      // Terminaler Status: der Token wird nicht mehr gebraucht.
      if (status !== "pending") clearPendingPayment();
      setRedirectState(status === "pending" ? { phase: "pending" } : { phase: "done", status });
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  const paidDone = redirectState.phase === "done" && redirectState.status === "paid";
  // Während Prüfung/Pending nie die alte Bestellung zeigen.
  const blockOldOrder =
    redirectState.phase === "checking" ||
    redirectState.phase === "pending" ||
    (redirectState.phase === "done" && !paidDone && !dismissedFailure);

  if (redirectState.phase === "checking") {

    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
        <h1 className="mt-4 text-3xl">Zahlung wird bestätigt</h1>
        <p className="mt-3 text-muted-foreground">
          Bitte dieses Fenster kurz geöffnet lassen – das dauert nur wenige Sekunden.
        </p>
      </div>
    );
  }

  if (redirectState.phase === "pending") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <Clock className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-3xl">Zahlung wird noch bestätigt</h1>
        <p className="mt-3 text-muted-foreground">
          Deine Zahlung ist unterwegs, die endgültige Bestätigung deiner Bank bzw. von Stripe steht
          aber noch aus. Das kann einen Moment dauern. Bitte starte keine zweite Zahlung.
        </p>
        {reference && (
          <p className="mt-5 text-sm text-muted-foreground">
            Vorgemerkte Bestellnummer: <strong className="text-foreground">{reference}</strong>
          </p>
        )}
        <Button
          className="mt-6 h-14 rounded-xl bg-flame px-8 font-bold uppercase text-primary-foreground"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Erneut prüfen
        </Button>
      </div>
    );
  }

  if (redirectState.phase === "done" && (!lastOrder || blockOldOrder)) {
    const status = redirectState.status;
    const paid = status === "paid";
    const refunded = status === "refunded" || status === "slot_full_after_expiry";
    const title = paid
      ? "Zahlung erfolgreich"
      : refunded
        ? "Betrag wurde zurückerstattet"
        : "Zahlung nicht abgeschlossen";
    const text = paid
      ? "Deine Bestellung ist beim Truck eingegangen."
      : refunded
        ? "Die Abholzeit war leider bereits vergeben, bevor die Zahlung bestätigt werden konnte. Der Betrag wurde vollständig zurückerstattet."
        : "Es wurde keine Zahlung gebucht. Du kannst die Bestellung jederzeit erneut starten.";
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl">{title}</h1>
        <p className="mt-3 text-muted-foreground">{text}</p>
        {paid && reference && <p className="mt-5 font-display text-4xl">{reference}</p>}

        {!paid && lastOrder && (
          <p className="mt-4 text-sm text-muted-foreground">
            Deine frühere Bestellung {lastOrder.reference} ist weiterhin gültig.
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!paid && lastOrder && (
            <Button
              variant="outline"
              className="h-14 rounded-xl px-8 font-bold uppercase"
              onClick={() => setDismissedFailure(true)}
            >
              Bestehende Bestellung anzeigen
            </Button>
          )}
          <Button
            asChild
            className="h-14 rounded-xl bg-flame px-8 font-bold uppercase text-primary-foreground"
          >
            <Link to="/speisekarte">Zur Speisekarte</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!lastOrder) {

    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl">Keine Bestellung gefunden</h1>
        <p className="mt-3 text-muted-foreground">Starte eine neue Bestellung.</p>
        <Button
          asChild
          className="mt-6 h-14 rounded-xl bg-flame px-8 font-bold uppercase text-primary-foreground"
        >
          <Link to="/speisekarte">Zur Speisekarte</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <div className="rounded-3xl border border-primary/40 bg-card p-6 shadow-flame sm:p-10">
        <CheckCircle2 className="h-12 w-12 text-primary" />
        <h1 className="mt-4 text-3xl sm:text-4xl">Bestellung bestätigt</h1>
        <p className="mt-2 text-muted-foreground">
          Danke, {lastOrder.name || "Gast"}! Zeig diese Nummer bei der Abholung am Truck.
        </p>

        <div className="mt-5 rounded-2xl border border-primary/50 bg-primary/10 p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
            Bestellnummer
          </p>
          <p className="mt-1 font-display text-4xl leading-none sm:text-5xl">
            {lastOrder.reference}
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <Clock className="h-4 w-4" /> Abholzeit
            </p>
            <p className="mt-2 font-display text-xl">{lastOrder.pickupLabel}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <MapPin className="h-4 w-4" /> Abholort
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {BUSINESS.place}, {BUSINESS.street}, {BUSINESS.city}
            </p>
          </div>
        </div>

        <Separator className="my-6" />
        <ul className="space-y-3 text-sm">
          {(Array.isArray(lastOrder.lines) ? lastOrder.lines : []).map((line, index) => {
            const removed = Array.isArray(line?.removed) ? line.removed : [];
            const safeLine = { ...line, removed, quantity: line?.quantity ?? 1, basePrice: line?.basePrice ?? 0 };
            return (
              <li
                key={line?.lineId ?? index}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {safeLine.quantity}× {line?.name ?? "Artikel"}
                  </span>
                  {line?.bacon && <span className="block text-xs text-primary">+ Bacon</span>}
                  {removed.length > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      ohne {removed.join(", ")}
                    </span>
                  )}
                </span>
                <span className="shrink-0">{formatPrice(linePrice(safeLine))}</span>
              </li>
            );
          })}
        </ul>
        <Separator className="my-6" />
        <div className="flex items-center justify-between">
          <span className="text-sm uppercase tracking-wide text-muted-foreground">
            {lastOrder.payment}
          </span>
          <span className="font-display text-2xl">{formatPrice(lastOrder.total ?? 0)}</span>
        </div>

        <Button asChild variant="outline" className="mt-6 h-12 w-full rounded-xl">
          <Link to="/speisekarte">Neue Bestellung</Link>
        </Button>
      </div>
    </div>
  );
}
