import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Clock, CreditCard, Smartphone, Wallet, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { formatPrice, BUSINESS } from "@/data/menu";
import { linePrice, useCart } from "@/context/cart";
import { useShop } from "@/context/shop";
import {
  buildSlotDays,
  flattenSlots,
  isOpenNow,
  nextAvailableSlot,
  nextOpeningLabel,
} from "@/lib/pickup";

const PAYMENTS = [
  { id: "card", label: "Kreditkarte", icon: CreditCard, hint: "Online bezahlen" },
  { id: "apple", label: "Apple Pay", icon: Smartphone, hint: "Online bezahlen" },
  { id: "google", label: "Google Pay", icon: Wallet, hint: "Online bezahlen" },
  { id: "cash", label: "Barzahlung bei Abholung", icon: Banknote, hint: "Am Truck" },
  { id: "terminal", label: "Kartenzahlung bei Abholung", icon: CreditCard, hint: "Am Truck" },
] as const;

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout – Abholzeit & Zahlung | Taste It's Tasty" },
      {
        name: "description",
        content: "Abholzeit wählen, Zahlungsart festlegen und Bestellung am Food Truck abholen.",
      },
      { property: "og:title", content: "Checkout – Taste It's Tasty" },
      { property: "og:description", content: "Abholzeit und Zahlungsart wählen." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const { lines, total, placeOrder } = useCart();
  const { settings, bookings, addOrder } = useShop();
  const [now, setNow] = useState<Date | null>(null);

  // Slots erst im Browser berechnen, damit SSR und Client identisch starten.
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const slotDays = useMemo(
    () =>
      now
        ? buildSlotDays({
            now,
            hours: settings.hours,
            minLeadMinutes: settings.minLeadMinutes,
            maxOrdersPerSlot: settings.maxOrdersPerSlot,
            bookings,
          })
        : [],
    [now, settings, bookings],
  );
  const slots = useMemo(() => flattenSlots(slotDays), [slotDays]);
  const suggested = nextAvailableSlot(slotDays);
  const [slotKey, setSlotKey] = useState("");
  const [dayKey, setDayKey] = useState("");
  const activeDayKey = slotDays.some((d) => d.dayKey === dayKey)
    ? dayKey
    : (suggested?.dayKey ?? slotDays[0]?.dayKey ?? "");
  const activeDay = slotDays.find((d) => d.dayKey === activeDayKey);
  const [payment, setPayment] = useState<string>("card");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  const selectedSlot =
    slots.find((s) => s.key === slotKey && !s.full) ??
    (activeDay ? (activeDay.slots.find((s) => !s.full) ?? suggested) : suggested);
  const canSubmit = lines.length > 0 && Boolean(selectedSlot) && name.trim().length > 1;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl">Warenkorb leer</h1>
        <p className="mt-3 text-muted-foreground">Wähle zuerst deine Burger aus.</p>
        <Button asChild className="mt-6 h-13 rounded-xl bg-flame px-8 font-bold uppercase text-primary-foreground">
          <Link to="/speisekarte">Zur Speisekarte</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl sm:text-4xl">Checkout</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Abholung bei {BUSINESS.name} · {BUSINESS.place}, {BUSINESS.street}, {BUSINESS.city}
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-10">
          <section>
            <h2 className="flex items-center gap-2 text-xl">
              <Clock className="h-5 w-5 text-primary" /> Abholzeit
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Mindestens {settings.minLeadMinutes} Minuten Vorlauf, 5-Minuten-Takt, max.{" "}
              {settings.maxOrdersPerSlot} Bestellungen pro Zeitfenster. Nur innerhalb der
              Öffnungszeiten (Mo – Sa 11:00 – 18:00 Uhr, Sonntag geschlossen).
            </p>

            {now && slotDays.length === 0 && (
              <p className="mt-4 flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Aktuell sind keine Abholzeiten verfügbar.
              </p>
            )}

            {now && !isOpenNow(now, settings.hours) && slotDays.length > 0 && (
              <p className="mt-4 flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Der Truck ist gerade geschlossen. Vorbestellung möglich – wieder geöffnet{" "}
                {nextOpeningLabel(now, settings.hours)}.
              </p>
            )}

            {suggested && (
              <p className="mt-3 text-sm text-muted-foreground">
                Vorschlag – nächstes freies Zeitfenster:{" "}
                <strong className="text-foreground">
                  {suggested.dayLabel}, {suggested.label} Uhr
                </strong>
              </p>
            )}

            {slotDays.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {slotDays.map((day) => (
                  <button
                    key={day.dayKey}
                    type="button"
                    onClick={() => {
                      setDayKey(day.dayKey);
                      setSlotKey("");
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      day.dayKey === activeDayKey
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card hover:border-primary/60"
                    }`}
                  >
                    {day.dayLabel}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              {(activeDay?.slots ?? []).map((slot) => {
                const active = slot.key === selectedSlot?.key;
                return (
                  <button
                    key={slot.key}
                    type="button"
                    disabled={slot.full}
                    onClick={() => setSlotKey(slot.key)}
                    className={`rounded-lg border px-2 py-3 text-sm font-semibold transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : slot.full
                          ? "cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground/50 line-through"
                          : "border-border bg-card hover:border-primary/60"
                    }`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-xl">Zahlungsart</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {PAYMENTS.map((option) => {
                const Icon = option.icon;
                const active = payment === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPayment(option.id)}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-xl">Kontakt</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Max Mustermann"
                  className="mt-2 h-12"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefon (optional)</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01234 567890"
                  className="mt-2 h-12"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="note">Anmerkung (optional)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-2"
                  placeholder="z. B. Bitte gut durch"
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-24">
          <h2 className="text-lg">Bestellübersicht</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {lines.map((line) => (
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
          <Separator className="my-4" />
          <div className="flex items-center justify-between">
            <span className="text-sm uppercase tracking-wide text-muted-foreground">Gesamt</span>
            <span className="font-display text-2xl">{formatPrice(total)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Abholung:{" "}
            {selectedSlot
              ? `${selectedSlot.dayLabel}, ${selectedSlot.label} Uhr`
              : "kein Fenster verfügbar"}
          </p>
          <Button
            size="lg"
            disabled={!canSubmit}
            className="mt-5 h-14 w-full rounded-xl bg-flame text-base font-bold uppercase tracking-wide text-primary-foreground shadow-flame hover:opacity-90"
            onClick={() => {
              if (!selectedSlot) return;
              const paymentLabel = PAYMENTS.find((p) => p.id === payment)?.label ?? "";
              const pickupLabel = `${selectedSlot.dayLabel}, ${selectedSlot.label} Uhr`;
              const order = placeOrder({
                pickupLabel,
                payment: paymentLabel,
                name: name.trim(),
              });
              addOrder({
                reference: order.reference,
                createdAt: new Date().toISOString(),
                pickupISO: selectedSlot.key,
                pickupLabel,
                name: order.name,
                phone: phone.trim(),
                note: note.trim(),
                payment: paymentLabel,
                lines: order.lines,
                total: order.total,
              });
              navigate({ to: "/bestellung" });
            }}
          >
            Bestellung abschließen
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Demo: Es wird keine echte Zahlung ausgeführt.
          </p>
        </aside>
      </div>
    </div>
  );
}