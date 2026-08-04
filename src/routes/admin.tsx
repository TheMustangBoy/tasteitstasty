import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  ClipboardList,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  UtensilsCrossed,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { OrderCard } from "@/components/admin/order-card";
import { formatPrice, WEEKDAYS } from "@/data/menu";
import {
  ORDER_STATUSES,
  STATUS_LABEL,
  useShop,
  type OrderStatus,
} from "@/context/shop";
import { playNotificationSound } from "@/lib/admin-sound";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Adminbereich – Bestellungen & Einstellungen | Taste It's Tasty" },
      {
        name: "description",
        content:
          "Interner Demo-Adminbereich des Food Trucks: Bestellungen verwalten, Produkte pflegen, Öffnungszeiten und Abholfenster einstellen.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Adminbereich – Taste It's Tasty" },
      { property: "og:description", content: "Bestellungen und Einstellungen verwalten." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { adminAuthed } = useShop();
  return adminAuthed ? <AdminConsole /> : <AdminLogin />;
}

function AdminLogin() {
  const { login } = useShop();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <ShieldCheck className="h-10 w-10 text-primary" />
        <h1 className="mt-4 text-3xl">Adminbereich</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Demo-Login – es werden keine echten Zugangsdaten verwendet.
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!login(user, password)) setError(true);
          }}
        >
          <div>
            <Label htmlFor="admin-user">Benutzer</Label>
            <Input
              id="admin-user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
              className="mt-2 h-12"
              placeholder="admin"
            />
          </div>
          <div>
            <Label htmlFor="admin-pass">Passwort</Label>
            <Input
              id="admin-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-2 h-12"
              placeholder="tasty2024"
            />
          </div>
          {error && <p className="text-sm text-destructive">Zugangsdaten stimmen nicht.</p>}
          <Button
            type="submit"
            className="h-13 w-full rounded-xl bg-flame py-4 font-bold uppercase tracking-wide text-primary-foreground"
          >
            Anmelden
          </Button>
        </form>
        <p className="mt-5 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          Platzhalter-Zugang: Benutzer <strong>admin</strong>, Passwort <strong>tasty2024</strong>.
        </p>
      </div>
    </div>
  );
}

function AdminConsole() {
  const {
    orders,
    products,
    overrides,
    settings,
    soundOn,
    setSoundOn,
    setOverride,
    setSettings,
    setDayHours,
    setOrderStatus,
    simulateOrder,
    logout,
  } = useShop();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OrderStatus | "alle">("alle");

  const live = orders.filter(
    (o) => o.status !== "abgeschlossen" && o.status !== "abgelehnt",
  );
  const newCount = orders.filter((o) => o.status === "neu").length;

  const history = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "alle" && o.status !== filter) return false;
      if (!q) return true;
      return (
        o.reference.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q) ||
        o.lines.some((l) => l.name.toLowerCase().includes(q))
      );
    });
  }, [orders, query, filter]);

  const metrics = useMemo(() => {
    const today = new Date().toDateString();
    const relevant = orders.filter(
      (o) => new Date(o.createdAt).toDateString() === today && o.status !== "abgelehnt",
    );
    const revenue = relevant.reduce((s, o) => s + o.total, 0);
    const counter = new Map<string, number>();
    for (const o of relevant) for (const l of o.lines) counter.set(l.name, (counter.get(l.name) ?? 0) + l.quantity);
    const top = [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    return {
      revenue,
      count: relevant.length,
      average: relevant.length ? revenue / relevant.length : 0,
      top,
    };
  }, [orders]);

  return (
    <div className="mx-auto max-w-6xl px-3 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl">Adminbereich</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Demo-Konsole · Daten liegen lokal im Browser.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-full"
            onClick={() => setSoundOn(!soundOn)}
            aria-label={soundOn ? "Ton ausschalten" : "Ton einschalten"}
          >
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            <span className="ml-2 hidden sm:inline">{soundOn ? "Ton an" : "Ton aus"}</span>
          </Button>
          <Button
            className="h-11 rounded-full bg-flame font-bold uppercase text-primary-foreground"
            onClick={() => {
              const order = simulateOrder();
              if (soundOn) playNotificationSound();
              toast.success("Neue Bestellung eingegangen", {
                description: `${order.reference} · Abholung ${order.pickupLabel} · ${formatPrice(order.total)}`,
                duration: 8000,
              });
            }}
          >
            <Bell className="mr-2 h-4 w-4" /> Bestellung simulieren
          </Button>
          <Button variant="ghost" className="h-11 rounded-full" onClick={logout}>
            <LogOut className="h-5 w-5" />
            <span className="ml-2 hidden sm:inline">Abmelden</span>
          </Button>
        </div>
      </header>

      <Tabs defaultValue="live" className="mt-8">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="live" className="py-3">
            <ClipboardList className="mr-2 h-4 w-4" /> Live
            {newCount > 0 && (
              <span className="ml-2 rounded-full bg-flame px-2 text-xs text-primary-foreground">
                {newCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="historie" className="py-3">
            <Search className="mr-2 h-4 w-4" /> Historie
          </TabsTrigger>
          <TabsTrigger value="produkte" className="py-3">
            <UtensilsCrossed className="mr-2 h-4 w-4" /> Produkte
          </TabsTrigger>
          <TabsTrigger value="einstellungen" className="py-3">
            <Settings className="mr-2 h-4 w-4" /> Einstellungen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-6 space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Tagesumsatz" value={formatPrice(metrics.revenue)} />
            <Metric label="Bestellungen heute" value={String(metrics.count)} />
            <Metric label="Ø Bestellwert" value={formatPrice(metrics.average)} />
            <Metric
              label="Beliebteste Produkte"
              value={metrics.top.length ? metrics.top.map(([n, q]) => `${q}× ${n}`).join(", ") : "–"}
              small
            />
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-xl">
              <BarChart3 className="h-5 w-5 text-primary" /> Offene Bestellungen
            </h2>
            {live.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Keine offenen Bestellungen.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {live.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatus={(status) => setOrderStatus(order.id, status)}
                  />
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="historie" className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche nach Bestellnummer, Name oder Produkt"
              className="h-12"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["alle", ...ORDER_STATUSES] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  filter === status
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card hover:border-primary/60"
                }`}
              >
                {status === "alle" ? "Alle" : STATUS_LABEL[status]}
              </button>
            ))}
          </div>
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Keine Bestellungen gefunden.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {history.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStatus={(status) => setOrderStatus(order.id, status)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="produkte" className="mt-6 space-y-4">
          {products.map((item) => {
            const o = overrides[item.id] ?? {};
            return (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg">{item.name}</h3>
                    {o.soldOut && <Badge variant="destructive">Ausverkauft</Badge>}
                    {o.available === false && <Badge variant="outline">Inaktiv</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={o.available !== false}
                        onCheckedChange={(v) => setOverride(item.id, { available: v })}
                      />
                      Aktiv
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={o.soldOut === true}
                        onCheckedChange={(v) => setOverride(item.id, { soldOut: v })}
                      />
                      Ausverkauft
                    </label>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`name-${item.id}`}>Name</Label>
                    <Input
                      id={`name-${item.id}`}
                      value={item.name}
                      onChange={(e) => setOverride(item.id, { name: e.target.value })}
                      className="mt-2 h-12"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`price-${item.id}`}>Preis (€)</Label>
                    <Input
                      id={`price-${item.id}`}
                      type="number"
                      step="0.5"
                      min="0"
                      value={item.price}
                      onChange={(e) =>
                        setOverride(item.id, { price: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="mt-2 h-12"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`desc-${item.id}`}>Beschreibung</Label>
                    <Textarea
                      id={`desc-${item.id}`}
                      value={item.description ?? ""}
                      placeholder={item.ingredients.join(" · ") || "Beschreibung ergänzen"}
                      onChange={(e) => setOverride(item.id, { description: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="einstellungen" className="mt-6 space-y-6">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-xl">Öffnungszeiten</h2>
            <div className="mt-4 space-y-3">
              {[1, 2, 3, 4, 5, 6, 0].map((index) => {
                const day = settings.hours[index]!;
                return (
                  <div
                    key={index}
                    className="grid grid-cols-2 items-center gap-3 rounded-xl border border-border/70 p-3 sm:grid-cols-[140px_1fr_1fr_auto]"
                  >
                    <span className="font-semibold">{WEEKDAYS[index]}</span>
                    <Input
                      type="time"
                      value={day.open}
                      disabled={day.closed}
                      onChange={(e) => setDayHours(index, { open: e.target.value })}
                      className="h-11"
                    />
                    <Input
                      type="time"
                      value={day.close}
                      disabled={day.closed}
                      onChange={(e) => setDayHours(index, { close: e.target.value })}
                      className="h-11"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={!day.closed}
                        onCheckedChange={(v) => setDayHours(index, { closed: !v })}
                      />
                      {day.closed ? "Geschlossen" : "Geöffnet"}
                    </label>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-xl">Abholfenster</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="max-slot">Max. Bestellungen pro Zeitfenster</Label>
                <Input
                  id="max-slot"
                  type="number"
                  min="1"
                  max="20"
                  value={settings.maxOrdersPerSlot}
                  onChange={(e) =>
                    setSettings({ maxOrdersPerSlot: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="mt-2 h-12"
                />
              </div>
              <div>
                <Label htmlFor="lead">Mindestvorlauf (Minuten)</Label>
                <Input
                  id="lead"
                  type="number"
                  min="5"
                  step="5"
                  value={settings.minLeadMinutes}
                  onChange={(e) =>
                    setSettings({ minLeadMinutes: Math.max(5, Number(e.target.value) || 5) })
                  }
                  className="mt-2 h-12"
                />
              </div>
            </div>
            <p className="mt-4 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              Demo-Hinweis: Keine echten Zugangsdaten, Zahlungen oder Push-Dienste. Zeitfenster
              bleiben im 5-Minuten-Takt.
            </p>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{label}</p>
      <p className={small ? "mt-2 text-sm text-muted-foreground" : "mt-2 font-display text-2xl"}>
        {value}
      </p>
    </div>
  );
}
