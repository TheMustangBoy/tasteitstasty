import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Banknote, Clock, CreditCard, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { WheelField } from "@/components/ui/wheel-picker";
import { formatPrice, BUSINESS } from "@/data/menu";
import { lineOptions, linePrice, useCart } from "@/context/cart";
import { useShop } from "@/context/shop";
import {
  buildSlotDays,
  flattenSlots,
  isOpenNow,
  nextAvailableSlot,
  nextOpeningLabel,
} from "@/lib/pickup";
import { isValidPhone, PHONE_ERROR, sanitizePhoneInput } from "@/lib/phone";
import { PAYMENT_ON_SITE, type PaymentConfig } from "@/lib/payments/config";
import {
  checkoutKeyFor,
  createPaymentIntent,
  fetchPaymentConfig,
  waitForPaidReservation,

} from "@/lib/payments/client";
import { StripePaymentSection } from "@/components/shop/stripe-payment";

type PaymentChoice = "cash" | "terminal" | "online";

const PAYMENTS = [
  {
    id: "cash",
    label: PAYMENT_ON_SITE.cash,
    icon: Banknote,
    hint: "Am Truck",
  },
  {
    id: "terminal",
    label: PAYMENT_ON_SITE.terminal,
    icon: CreditCard,
    hint: "Am Truck",
  },
  {
    id: "online",
    label: "Online bezahlen",
    icon: Globe,
    hint: "Karte · Apple Pay · Google Pay",
  },
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
  const { settings, bookings, addOrder, orderableProducts, refresh } = useShop();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
  const [payment, setPayment] = useState<PaymentChoice>("cash");
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [intent, setIntent] = useState<{
    clientSecret: string;
    reservationId: string;
    token: string;
    reference: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneValid = isValidPhone(phone);
  const onlineReady = paymentConfig?.configured === true && Boolean(paymentConfig.publishableKey);

  // Verfügbarkeit der Online-Zahlung einmalig serverseitig erfragen.
  useEffect(() => {
    let active = true;
    void fetchPaymentConfig().then((config) => {
      if (active) setPaymentConfig(config);
    });
    return () => {
      active = false;
    };
  }, []);

  // Verfügbarkeitsprüfung: Produkt aktiv, nicht ausverkauft, Kategorie nicht pausiert.
  const productById = useMemo(
    () => new Map(orderableProducts.map((p) => [p.id, p])),
    [orderableProducts],
  );
  const unavailableLines = lines.filter((l) => !productById.has(l.itemId));

  // Extras und Auswahl-Optionen müssen im Katalog noch existieren (inkl. Preis).
  const staleLines = lines.filter((l) => {
    const product = productById.get(l.itemId);
    if (!product) return false;
    const extrasOk = (l.extras ?? []).every((e) =>
      (product.extras ?? []).some((x) => x.id === e.id && x.price === e.price),
    );
    const optionsOk = lineOptions(l).every((o) =>
      (product.options ?? []).some((x) => x.id === o.id && x.priceDelta === o.priceDelta),
    );
    return !extrasOk || !optionsOk || product.price !== l.basePrice;
  });

  const selectedSlot =
    slots.find((s) => s.key === slotKey && !s.full) ??
    (activeDay ? (activeDay.slots.find((s) => !s.full) ?? suggested) : suggested);
  const pickupLabel = selectedSlot ? `${selectedSlot.dayLabel}, ${selectedSlot.label} Uhr` : "";

  // Ändern sich Warenkorb, Zeit oder Kontaktdaten, wird eine offene
  // Zahlungssitzung verworfen (verhindert Zahlungen auf veraltete Daten).
  const intentSignature = `${total}|${selectedSlot?.key ?? ""}|${name.trim()}|${phone.trim()}|${note.trim()}|${lines.length}`;
  const [intentKey, setIntentKey] = useState("");
  useEffect(() => {
    setIntentKey((prev) => {
      if (prev && prev !== intentSignature) setIntent(null);
      return intentSignature;
    });
  }, [intentSignature]);

  const canSubmit =
    lines.length > 0 &&
    Boolean(selectedSlot) &&
    name.trim().length > 1 &&
    phoneValid &&
    unavailableLines.length === 0 &&
    staleLines.length === 0 &&
    !submitting &&
    !settings.ordersPaused &&
    (payment !== "online" || onlineReady);

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl">Warenkorb leer</h1>
        <p className="mt-3 text-muted-foreground">Wähle zuerst deine Burger aus.</p>
        <Button
          asChild
          className="mt-6 h-13 rounded-xl bg-flame px-8 font-bold uppercase text-primary-foreground"
        >
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
            {suggested && (
              <p className="mt-2 text-sm text-muted-foreground">
                Früheste Abholung:{" "}
                <strong className="text-foreground">
                  {suggested.dayLabel === "Heute" ? "" : `${suggested.dayLabel}, `}
                  {suggested.label} Uhr
                </strong>
              </p>
            )}

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

            {slotDays.length > 0 && (
              <div className="mt-5 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:max-w-md sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    Tag
                  </p>
                  <WheelField
                    ariaLabel="Abholtag wählen"
                    title="Abholtag wählen"
                    placeholder="Tag auswählen"
                    value={activeDayKey}
                    options={slotDays.map((d) => ({ value: d.dayKey, label: d.dayLabel }))}
                    onChange={(next) => {
                      setDayKey(next);
                      setSlotKey("");
                    }}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    Uhrzeit
                  </p>
                  <WheelField
                    ariaLabel="Abholzeit wählen"
                    title="Abholzeit wählen"
                    placeholder="Abholzeit auswählen"
                    value={selectedSlot?.key ?? ""}
                    options={(activeDay?.slots ?? [])
                      .filter((slot) => !slot.full)
                      .map((slot) => ({ value: slot.key, label: `${slot.label} Uhr` }))}
                    onChange={setSlotKey}
                  />
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xl">Zahlungsart</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {PAYMENTS.map((option) => {
                const Icon = option.icon;
                const active = payment === option.id;
                const disabled = option.id === "online" && !onlineReady;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={disabled}
                    aria-disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setPayment(option.id);
                      setSubmitError(null);
                    }}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      disabled
                        ? "cursor-not-allowed border-border bg-card opacity-50"
                        : active
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/50"
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
            {paymentConfig && !onlineReady && (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Stripe-Testmodus noch nicht verbunden – Online-Zahlung ist deaktiviert. Bestellungen
                mit Zahlung am Truck sind weiterhin möglich.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-xl">Kontakt</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Max Mustermann"
                  className="mt-2 h-12"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefon *</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  aria-invalid={phoneTouched && !phoneValid}
                  aria-describedby="phone-error"
                  value={phone}
                  onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="+49 151 2345678"
                  className="mt-2 h-12"
                />
                {phoneTouched && !phoneValid && (
                  <p id="phone-error" className="mt-2 text-sm text-destructive">
                    {PHONE_ERROR}
                  </p>
                )}
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
                  {lineOptions(line).length > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      {lineOptions(line)
                        .map((o) => o.name)
                        .join(", ")}
                    </span>
                  )}
                  {(line.extras?.length || line.bacon) && (
                    <span className="block text-xs text-primary">
                      +{" "}
                      {(line.extras?.length ? line.extras.map((e) => e.name) : ["Bacon"]).join(
                        ", ",
                      )}
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
          {settings.ordersPaused && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Online-Bestellungen sind aktuell pausiert. Bitte später erneut versuchen.
            </p>
          )}
          {unavailableLines.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Nicht mehr verfügbar: {unavailableLines.map((l) => l.name).join(", ")}. Bitte im
              Warenkorb entfernen.
            </p>
          )}
          {staleLines.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Preise oder Optionen haben sich geändert ({staleLines.map((l) => l.name).join(", ")}).
              Bitte den Artikel neu in den Warenkorb legen.
            </p>
          )}
          {submitError && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {submitError}
            </p>
          )}
          {intent && paymentConfig?.publishableKey ? (
            <StripePaymentSection
              publishableKey={paymentConfig.publishableKey}
              clientSecret={intent.clientSecret}
              amountLabel={formatPrice(total)}
              returnUrl={`${typeof window === "undefined" ? "" : window.location.origin}/bestellung?reservation=${intent.reservationId}&token=${intent.token}&ref=${intent.reference}`}
              onPaid={async () => {
                setSubmitError(null);
                const status = await waitForPaidReservation(intent.reservationId, intent.token);
                if (status === "refunded" || status === "slot_full_after_expiry") {
                  setSubmitError(
                    "Die Abholzeit war leider vergeben, bevor die Zahlung bestätigt wurde. Der Betrag wurde vollständig zurückerstattet – bitte wähle eine andere Zeit.",
                  );
                  setIntent(null);
                  void refresh();
                  return;
                }
                if (status !== "paid") {
                  setSubmitError(
                    "Die Zahlung wird noch bestätigt. Bitte kurz warten und die Seite nicht schließen.",
                  );
                  return;
                }

                placeOrder({
                  reference: intent.reference,
                  pickupLabel,
                  payment: "Online bezahlt",
                  name: name.trim(),
                });
                void refresh();
                navigate({ to: "/bestellung" });
              }}
            />
          ) : (
            <Button
              size="lg"
              disabled={!canSubmit}
              aria-busy={submitting}
              className="mt-5 h-14 w-full rounded-xl bg-flame text-base font-bold uppercase tracking-wide text-primary-foreground shadow-flame hover:opacity-90"
              onClick={async () => {
                // Letzte Prüfung direkt vor dem Absenden.
                if (!selectedSlot || selectedSlot.full || submitting) return;
                if (settings.ordersPaused || unavailableLines.length > 0 || staleLines.length > 0)
                  return;
                setSubmitting(true);
                setSubmitError(null);
                const orderLines = lines.map((l) => ({
                  lineId: l.lineId,
                  itemId: l.itemId,
                  name: l.name,
                  basePrice: l.basePrice,
                  quantity: l.quantity,
                  removed: l.removed,
                  bacon: l.bacon,
                  extras: l.extras ?? [],
                  options: lineOptions(l),
                }));
                try {
                  if (payment === "online") {
                    // Es entsteht nur eine Reservierung – die Bestellung erzeugt
                    // erst der Stripe-Webhook nach bestätigter Zahlung.
                    const pickupISO = new Date(selectedSlot.key).toISOString();
                    const created = await createPaymentIntent({

                      name: name.trim(),
                      phone: phone.trim(),
                      note: note.trim(),
                      pickupISO,
                      pickupLabel,
                      lines: orderLines,
                      total,
                    });
                    setIntent(created);
                    return;
                  }

                  const paymentLabel = PAYMENT_ON_SITE[payment];
                  // Erst speichern (inkl. serverseitiger Kapazitätsprüfung), dann bestätigen.
                  // Die Bestellnummer vergibt ausschließlich der Server.
                  const saved = await addOrder({
                    reference: "",
                    createdAt: new Date().toISOString(),
                    pickupISO: selectedSlot.key,
                    pickupLabel,
                    name: name.trim(),
                    phone: phone.trim(),
                    note: note.trim(),
                    payment: paymentLabel,
                    lines,
                    total,
                  });
                  placeOrder({
                    reference: saved.reference,
                    pickupLabel,
                    payment: paymentLabel,
                    name: name.trim(),
                  });
                  navigate({ to: "/bestellung" });

                } catch (error) {
                  // Warenkorb bleibt erhalten – nur Meldung anzeigen und Slots neu laden.
                  setSubmitError(
                    error instanceof Error
                      ? error.message
                      : "Die Bestellung konnte nicht gespeichert werden. Bitte versuche es erneut.",
                  );
                  void refresh();
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting
                ? "Wird gesendet …"
                : payment === "online"
                  ? "Weiter zur Zahlung"
                  : "Bestellung abschließen"}
            </Button>
          )}

          <p className="mt-3 text-center text-xs text-muted-foreground">
            {payment === "online"
              ? "Die Bestellung wird erst nach bestätigter Zahlung angelegt."
              : "Bezahlt wird direkt am Truck bei der Abholung."}
          </p>
        </aside>
      </div>
    </div>
  );
}
