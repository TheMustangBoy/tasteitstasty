import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  BellRing,
  Smartphone,
  ClipboardList,
  Copy,
  Download,
  Layers,
  LogOut,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Power,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UtensilsCrossed,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { SortableRow } from "@/components/admin/sortable-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { OrderCard } from "@/components/admin/order-card";
import { ProductEditor } from "@/components/admin/product-editor";
import { CatalogManager } from "@/components/admin/catalog-manager";
import { EmergencyClosure } from "@/components/admin/emergency-closure";
import { PaymentsHealth } from "@/components/admin/payments-health";
import { berlinDayKey, isEmergencyClosedToday } from "@/lib/berlin-day";

import { supabase } from "@/integrations/supabase/client";
import { formatPrice, WEEKDAYS } from "@/data/menu";
import {
  CLOSED_STATUSES,
  emptyProduct,
  ORDER_STATUSES,
  STATUS_LABEL,
  useShop,
  type OrderStatus,
  type ProductRecord,
} from "@/context/shop";
import { primeAudio, playNotificationSound } from "@/lib/admin-sound";
import { disablePush, enablePush, readPushStatus, type PushStatus } from "@/lib/push";

import { downloadCsv, ordersToCsv } from "@/lib/csv";

/** Kompakte Statusfilter über den offenen Bestellungen. */
const LIVE_FILTERS = ["alle", "neu", "angenommen", "zubereitung", "abholbereit"] as const;

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Adminbereich – Bestellungen & Einstellungen | Taste It's Tasty" },
      {
        name: "description",
        content:
          "Interner Adminbereich des Food Trucks: Bestellungen verwalten, Produkte pflegen, Öffnungszeiten und Abholfenster einstellen.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Adminbereich – Taste It's Tasty" },
      { property: "og:description", content: "Bestellungen und Einstellungen verwalten." },
    ],
  }),
  component: AdminPage,
});

const LINK_ERROR = "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.";
const PASSWORD_POLICY_ERROR =
  "Dieses Passwort ist zu schwach oder als leicht zu erraten bekannt. Bitte wähle ein anderes Passwort mit mindestens 8 Zeichen, Groß- und Kleinbuchstaben, Zahl und Sonderzeichen.";

/** Übersetzt Auth-Fehler in sichere, hilfreiche Meldungen ohne Backend-Details offenzulegen. */
function recoveryErrorMessage(error: { code?: unknown; message?: unknown; status?: unknown }) {
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  if (
    code === "weak_password" ||
    code === "same_password" ||
    message.includes("password is known to be weak") ||
    message.includes("password should be")
  )
    return PASSWORD_POLICY_ERROR;

  if (error.status === 429 || code.includes("rate_limit"))
    return "Zu viele Versuche. Bitte warte einen Moment und versuche es dann erneut.";

  if (
    error.status === 401 ||
    [
      "bad_jwt",
      "flow_state_expired",
      "invalid_jwt",
      "reauthentication_needed",
      "refresh_token_not_found",
      "refresh_token_already_used",
      "session_expired",
      "session_not_found",
    ].includes(code) ||
    message.includes("jwt") ||
    message.includes("session") ||
    message.includes("token")
  )
    return LINK_ERROR;

  return "Das Passwort konnte nicht gespeichert werden. Bitte erneut versuchen.";
}

/** Erkennt beide Supabase-Linkvarianten: Hash/implicit und PKCE/query. */
function readRecoveryUrl() {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const code = query.get("code");
  const isRecovery =
    hash.get("type") === "recovery" || query.get("type") === "recovery" || Boolean(code);
  if (!isRecovery) return null;
  return { accessToken, refreshToken, code };
}

/** Entfernt Recovery-Parameter aus der URL, ohne zu navigieren. */
function cleanRecoveryUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const key of ["code", "type", "token_hash", "error", "error_description"])
    url.searchParams.delete(key);
  url.hash = "";
  window.history.replaceState({}, "", url.pathname + url.search);
}

function AdminPage() {
  const { adminAuthed, authLoading } = useShop();
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const params = readRecoveryUrl();
    setRecovering(Boolean(params));
    setRecoveryChecked(true);

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!recoveryChecked)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center text-sm text-muted-foreground sm:px-6">
        Zugang wird geprüft …
      </div>
    );

  if (recovering)
    return (
      <ResetPasswordForm
        onDone={() => {
          cleanRecoveryUrl();
          setRecovering(false);
        }}
      />
    );
  if (authLoading)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center text-sm text-muted-foreground sm:px-6">
        Zugang wird geprüft …
      </div>
    );
  return adminAuthed ? <AdminConsole /> : <AdminLogin />;
}

/** Formular zum Setzen eines neuen Passworts nach einem Recovery-Link. */
function ResetPasswordForm({ onDone }: { onDone: () => void }) {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const params = readRecoveryUrl();
      const { data } = await supabase.auth.getSession();
      let session = data.session;

      if (!session && params) {
        if (params.code) {
          const res = await supabase.auth.exchangeCodeForSession(params.code);
          session = res.data.session ?? null;
        } else if (params.accessToken && params.refreshToken) {
          const res = await supabase.auth.setSession({
            access_token: params.accessToken,
            refresh_token: params.refreshToken,
          });
          session = res.data.session ?? null;
        }
      }

      if (cancelled) return;
      if (session) {
        setReady(true);
      } else {
        setError(LINK_ERROR);
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <ShieldCheck className="h-10 w-10 text-primary" />
        <h1 className="mt-4 text-3xl">Neues Passwort setzen</h1>
        {checking ? (
          <p className="mt-4 text-sm text-muted-foreground">Recovery-Link wird geprüft …</p>
        ) : !ready ? (
          <>
            <p className="mt-4 text-sm text-destructive">{error ?? LINK_ERROR}</p>
            <Button
              type="button"
              onClick={onDone}
              className="mt-6 h-12 w-full rounded-xl bg-flame font-bold uppercase tracking-wide text-primary-foreground"
            >
              Zurück zum Login
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Bitte vergeben Sie ein neues Passwort für Ihr Admin-Konto.
            </p>
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (busy) return;
                if (pw1.length < 8) {
                  setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
                  return;
                }
                if (pw1 !== pw2) {
                  setError("Die Passwörter stimmen nicht überein.");
                  return;
                }
                setBusy(true);
                setError(null);
                void (async () => {
                  const { data } = await supabase.auth.getSession();
                  if (!data.session) {
                    setError(LINK_ERROR);
                    setReady(false);
                    setBusy(false);
                    return;
                  }
                  const { error: err } = await supabase.auth.updateUser({ password: pw1 });
                  if (err) {
                    setError(recoveryErrorMessage(err));
                    setBusy(false);
                    return;
                  }
                  toast.success("Passwort wurde aktualisiert.");
                  setBusy(false);
                  onDone();
                })();
              }}
            >
              <div>
                <Label htmlFor="pw-new">Neues Passwort</Label>
                <Input
                  id="pw-new"
                  type="password"
                  required
                  minLength={8}
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  autoComplete="new-password"
                  className="mt-2 h-12"
                />
              </div>
              <div>
                <Label htmlFor="pw-repeat">Passwort wiederholen</Label>
                <Input
                  id="pw-repeat"
                  type="password"
                  required
                  minLength={8}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  autoComplete="new-password"
                  className="mt-2 h-12"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                disabled={busy}
                className="h-13 w-full rounded-xl bg-flame py-4 font-bold uppercase tracking-wide text-primary-foreground"
              >
                {busy ? "Speichern läuft …" : "Passwort speichern"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function AdminLogin() {
  const { login } = useShop();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const requestReset = () => {
    if (resetBusy || !email) return;
    setResetBusy(true);
    void (async () => {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin`,
      });
      // Generische Rückmeldung – unabhängig davon, ob das Konto existiert.
      setResetSent(true);
      setResetBusy(false);
    })();
  };

  if (resetMode) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <ShieldCheck className="h-10 w-10 text-primary" />
          <h1 className="mt-4 text-3xl">Passwort zurücksetzen</h1>
          {resetSent ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Wenn ein Konto mit dieser E-Mail-Adresse existiert, wurde eine E-Mail mit einem Link
              zum Zurücksetzen des Passworts versendet.
            </p>
          ) : (
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                requestReset();
              }}
            >
              <div>
                <Label htmlFor="reset-email">E-Mail</Label>
                <Input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="mt-2 h-12"
                  placeholder="admin@example.com"
                />
              </div>
              <Button
                type="submit"
                disabled={resetBusy}
                className="h-13 w-full rounded-xl bg-flame py-4 font-bold uppercase tracking-wide text-primary-foreground"
              >
                {resetBusy ? "Wird gesendet …" : "Link zum Zurücksetzen senden"}
              </Button>
            </form>
          )}
          <button
            type="button"
            onClick={() => {
              setResetMode(false);
              setResetSent(false);
            }}
            className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
          >
            Zurück zur Anmeldung
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <ShieldCheck className="h-10 w-10 text-primary" />
        <h1 className="mt-4 text-3xl">Adminbereich</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Anmeldung nur für freigeschaltete Admin-Konten.
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            // Login ist eine Nutzergeste: Audio hier freischalten, damit spätere
            // Benachrichtigungstöne nicht vom Browser blockiert werden.
            void primeAudio();
            setBusy(true);
            setError(null);

            void (async () => {
              const res = await login(email, password);
              if (!res.ok) setError(res.error ?? "Anmeldung fehlgeschlagen.");
              setBusy(false);
            })();
          }}
        >
          <div>
            <Label htmlFor="admin-email">E-Mail</Label>
            <Input
              id="admin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-2 h-12"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <Label htmlFor="admin-pass">Passwort</Label>
            <Input
              id="admin-pass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-2 h-12"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={busy}
            className="h-13 w-full rounded-xl bg-flame py-4 font-bold uppercase tracking-wide text-primary-foreground"
          >
            {busy ? "Anmeldung läuft …" : "Anmelden"}
          </Button>
          <button
            type="button"
            onClick={() => setResetMode(true)}
            className="w-full text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
          >
            Passwort vergessen?
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminConsole() {
  const {
    orders,
    productRows,
    catalog,
    settings,
    soundOn,
    setSoundOn,
    setOverride,
    setSettings,
    setEmergencyClosed,

    setDayHours,
    setOrderStatus,
    setOrderNote,
    cancelOrder,
    restoreOrder,
    refundAndCloseOrder,
    duplicateProduct,
    deleteProduct,
    moveProduct,
    reorderProducts,
    setCategoryPaused,
    logout,
    loading,
    loadError,
  } = useShop();

  const [query, setQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [filter, setFilter] = useState<OrderStatus | "alle">("alle");
  const [liveFilter, setLiveFilter] = useState<(typeof LIVE_FILTERS)[number]>("alle");

  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductRecord | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  /**
   * Wiederhergestellte Session (kein Login-Submit): Audio bei der ersten
   * Nutzergeste freischalten, danach Listener wieder entfernen.
   */
  useEffect(() => {
    if (!soundOn) return;
    const onGesture = () => {
      void primeAudio();
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [soundOn]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Drag & Drop innerhalb einer Kategorie: neue Reihenfolge persistieren. */
  const handleDragEnd = (categoryId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = productRows
      .filter((r) => r.categoryId === categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => r.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorderProducts(categoryId, arrayMove(ids, from, to));
  };

  const categoryLabel = (id: string) => catalog.categories.find((c) => c.id === id)?.label ?? id;
  const sortedProducts = useMemo(
    () =>
      [...productRows].sort(
        (a, b) => a.categoryId.localeCompare(b.categoryId) || a.sortOrder - b.sortOrder,
      ),
    [productRows],
  );

  // Admin-Suche über Produktnamen, Beschreibung, Zutaten und Kategorien.
  const visibleProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return sortedProducts;
    return sortedProducts.filter((row) =>
      [
        row.name,
        row.description,
        categoryLabel(row.categoryId),
        ...row.ingredients,
        ...row.options.map((o) => o.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedProducts, productQuery, catalog.categories]);

  const live = orders.filter((o) => !CLOSED_STATUSES.includes(o.status));
  const visibleLive = liveFilter === "alle" ? live : live.filter((o) => o.status === liveFilter);
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
      (o) =>
        new Date(o.createdAt).toDateString() === today &&
        !["abgelehnt", "storniert"].includes(o.status),
    );
    const revenue = relevant.reduce((s, o) => s + o.total, 0);
    const counter = new Map<string, number>();
    for (const o of relevant)
      for (const l of o.lines) counter.set(l.name, (counter.get(l.name) ?? 0) + l.quantity);
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
            Bestellungen, Produkte und Öffnungszeiten verwalten.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-full"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              // Nutzergeste: Audio freischalten und beim Einschalten einmal testen.
              if (next) {
                void (async () => {
                  if (await primeAudio()) void playNotificationSound();
                })();
              }
            }}
            aria-label={soundOn ? "Ton ausschalten" : "Ton einschalten"}
          >
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            <span className="ml-2 hidden sm:inline">{soundOn ? "Ton an" : "Ton aus"}</span>
          </Button>
          <Button variant="ghost" className="h-11 rounded-full" onClick={logout}>
            <LogOut className="h-5 w-5" />
            <span className="ml-2 hidden sm:inline">Abmelden</span>
          </Button>
        </div>
      </header>

      {loading && <p className="mt-4 text-sm text-muted-foreground">Daten werden geladen …</p>}
      {loadError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {loadError}
        </p>
      )}

      <Tabs defaultValue="live" className="mt-8">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
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
          <TabsTrigger value="katalog" className="py-3">
            <Layers className="mr-2 h-4 w-4" /> Katalog
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
              value={
                metrics.top.length ? metrics.top.map(([n, q]) => `${q}× ${n}`).join(", ") : "–"
              }
              small
            />
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-xl">
              <BarChart3 className="h-5 w-5 text-primary" /> Offene Bestellungen
            </h2>
            <div className="-mx-3 mt-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max gap-2">
                {LIVE_FILTERS.map((status) => {
                  const count =
                    status === "alle"
                      ? live.length
                      : live.filter((o) => o.status === status).length;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setLiveFilter(status)}
                      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                        liveFilter === status
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-card hover:border-primary/60"
                      }`}
                    >
                      {status === "alle" ? "Alle" : STATUS_LABEL[status]}
                      <span className="ml-2 text-xs text-muted-foreground">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {visibleLive.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Keine offenen Bestellungen.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {visibleLive.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatus={(status) => setOrderStatus(order.id, status)}
                    onNote={(note) => setOrderNote(order.id, note)}
                    onCancel={(reason, cancelNote) => cancelOrder(order.id, reason, cancelNote)}
                    onRefundClose={(status, reason, cancelNote) =>
                      refundAndCloseOrder(order.id, status, reason, cancelNote)
                    }
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
            <Button
              variant="outline"
              className="h-12 shrink-0"
              onClick={() => {
                downloadCsv(
                  `bestellungen-${new Date().toISOString().slice(0, 10)}.csv`,
                  ordersToCsv(history),
                );
                toast.success("CSV-Export erstellt", {
                  description: `${history.length} Bestellungen exportiert.`,
                });
              }}
            >
              <Download className="mr-2 h-4 w-4" /> CSV-Export
            </Button>
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
                  onNote={(note) => setOrderNote(order.id, note)}
                  onCancel={(reason, cancelNote) => cancelOrder(order.id, reason, cancelNote)}
                  onRefundClose={(status, reason, cancelNote) =>
                    refundAndCloseOrder(order.id, status, reason, cancelNote)
                  }
                  onRestore={(status) => {
                    restoreOrder(order.id, status);
                    toast.success(`${order.reference} wieder aktiv`);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="produkte" className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Produkte oder Kategorien suchen"
              className="h-12"
            />
            <Button
              className="h-12 shrink-0 rounded-xl bg-flame font-bold uppercase text-primary-foreground"
              onClick={() => {
                setEditing(emptyProduct(catalog.categories[0]?.id ?? "burger", productRows.length));
                setEditorOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Neues Produkt
            </Button>
          </div>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg">Kategorien pausieren</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pausierte Kategorien sind für Kund:innen nicht bestellbar.
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              {[...catalog.categories]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={c.paused !== true}
                      onCheckedChange={(v) => setCategoryPaused(c.id, !v)}
                    />
                    {c.label}
                    {c.paused && <Badge variant="destructive">Pausiert</Badge>}
                  </label>
                ))}
            </div>
          </section>

          {visibleProducts.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Keine Treffer für „{productQuery}“.
            </p>
          )}

          {[...catalog.categories]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((category) => {
              const rows = visibleProducts
                .filter((r) => r.categoryId === category.id)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              // Bei aktiver Suche nur Kategorien mit Treffern zeigen.
              if (rows.length === 0 && productQuery.trim()) return null;
              const isOpen = collapsed[category.id] !== true;
              return (
                <section key={category.id} className="space-y-3">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [category.id]: !(c[category.id] !== true) }))
                    }
                    className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-primary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-primary" />
                    )}
                    <span className="font-display text-lg">{category.label}</span>
                    <span className="text-sm text-muted-foreground">({rows.length})</span>
                    {category.paused && <Badge variant="destructive">Pausiert</Badge>}
                  </button>

                  {isOpen && rows.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Noch keine Produkte in dieser Kategorie.
                    </p>
                  )}

                  {isOpen && (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(category.id, event)}
                    >
                      <SortableContext
                        items={rows.map((r) => r.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {rows.map((row) => (
                            <SortableRow
                              key={row.id}
                              id={row.id}
                              disabled={Boolean(productQuery.trim())}
                              label={row.name || "Ohne Namen"}
                            >
                              {(handle) => (
                                <>
                                  <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
                                    {handle}
                                    <div className="min-w-0 flex-1 basis-[calc(100%-2.5rem)]">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="min-w-0 break-words text-lg">
                                          {row.name || "Ohne Namen"}
                                        </h3>
                                        {row.soldOut && (
                                          <Badge variant="destructive">Ausverkauft</Badge>
                                        )}
                                        {!row.active && <Badge variant="outline">Inaktiv</Badge>}
                                      </div>
                                      <p className="mt-1 text-sm text-muted-foreground">
                                        {categoryLabel(row.categoryId)} · {formatPrice(row.price)}
                                        {row.ingredients.length > 0 &&
                                          ` · ${row.ingredients.join(", ")}`}
                                      </p>
                                    </div>
                                    <span className="flex basis-full flex-wrap gap-1 sm:basis-auto sm:shrink-0">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-11 w-11"
                                        aria-label="Nach oben schieben"
                                        onClick={() => moveProduct(row.id, -1)}
                                      >
                                        <ArrowUp className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-11 w-11"
                                        aria-label="Nach unten schieben"
                                        onClick={() => moveProduct(row.id, 1)}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-11 w-11"
                                        aria-label="Produkt bearbeiten"
                                        onClick={() => {
                                          setEditing(row);
                                          setEditorOpen(true);
                                        }}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-11 w-11"
                                        aria-label="Produkt duplizieren"
                                        onClick={() => {
                                          const copy = duplicateProduct(row.id);
                                          if (copy)
                                            toast.success(`„${copy.name}“ angelegt (inaktiv)`);
                                        }}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-11 w-11 text-destructive"
                                        aria-label="Produkt löschen"
                                        onClick={() => setDeleteTarget(row)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </span>
                                  </div>
                                  <div className="mt-4 flex flex-wrap items-center gap-6">
                                    <label className="flex items-center gap-2 text-sm">
                                      <Switch
                                        checked={row.active}
                                        onCheckedChange={(v) =>
                                          setOverride(row.id, { available: v })
                                        }
                                      />
                                      Aktiv
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                      <Switch
                                        checked={row.soldOut}
                                        onCheckedChange={(v) => setOverride(row.id, { soldOut: v })}
                                      />
                                      Ausverkauft
                                    </label>
                                  </div>
                                </>
                              )}
                            </SortableRow>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </section>
              );
            })}

          <ProductEditor product={editing} open={editorOpen} onOpenChange={setEditorOpen} />

          <AlertDialog
            open={Boolean(deleteTarget)}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>„{deleteTarget?.name}“ löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Das Produkt verschwindet sofort aus der Speisekarte. Bereits bestehende
                  Bestellungen bleiben unverändert.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (deleteTarget) deleteProduct(deleteTarget.id);
                    setDeleteTarget(null);
                    toast.success("Produkt gelöscht");
                  }}
                >
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="katalog" className="mt-6">
          <CatalogManager />
        </TabsContent>

        <TabsContent value="einstellungen" className="mt-6 space-y-6">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-xl">
              <Power className="h-5 w-5 text-primary" /> Shop-Status
            </h2>
            <div className="mt-4 flex flex-wrap gap-6">
              <label className="flex items-center gap-3 text-sm">
                <Switch
                  checked={!settings.ordersPaused}
                  onCheckedChange={(v) => {
                    setSettings({ ordersPaused: !v });
                    toast.success(v ? "Online-Bestellungen aktiv" : "Online-Bestellungen pausiert");
                  }}
                />
                {settings.ordersPaused ? "Online-Bestellungen aus" : "Online-Bestellungen an"}
              </label>
            </div>
          </section>

          <EmergencyClosure
            closedToday={emergencyClosedToday}
            closedDate={settings.emergencyClosedDate}
            openOrdersToday={openOrdersToday}
            onToggle={setEmergencyClosed}
          />

          <PaymentsHealth />


          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-xl">Öffnungszeiten</h2>
            <div className="mt-4 space-y-3">
              {[1, 2, 3, 4, 5, 6, 0].map((index) => {
                const day = settings.hours[index]!;
                return (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 p-3 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="flex items-center justify-between gap-3 sm:justify-start">
                      <span className="font-semibold">{WEEKDAYS[index]}</span>
                      <label className="flex shrink-0 items-center gap-2 text-sm sm:hidden">
                        <Switch
                          checked={!day.closed}
                          onCheckedChange={(v) => setDayHours(index, { closed: !v })}
                        />
                        {day.closed ? "Geschlossen" : "Geöffnet"}
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:contents">
                      <Input
                        type="time"
                        value={day.open}
                        disabled={day.closed}
                        onChange={(e) => setDayHours(index, { open: e.target.value })}
                        className="h-11 w-full"
                      />
                      <Input
                        type="time"
                        value={day.close}
                        disabled={day.closed}
                        onChange={(e) => setDayHours(index, { close: e.target.value })}
                        className="h-11 w-full"
                      />
                    </div>
                    <label className="hidden shrink-0 items-center gap-2 whitespace-nowrap text-sm sm:flex">
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
              Zeitfenster bleiben im 5-Minuten-Takt.
            </p>
          </section>

          <PushSection />

          <SecuritySection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** App-Installation und geräteweise Push-Benachrichtigungen für neue Bestellungen. */
function PushSection() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installEvent, setInstallEvent] = useState<{ prompt: () => Promise<void> } | null>(null);

  useEffect(() => {
    void readPushStatus().then(setStatus);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const statusText: Record<PushStatus, string> = {
    loading: "Status wird geprüft …",
    unsupported: "Dieses Gerät oder dieser Browser unterstützt keine Push-Benachrichtigungen.",
    "needs-install": "Auf iPhone/iPad zuerst über „Teilen → Zum Home-Bildschirm“ installieren.",
    blocked:
      "Benachrichtigungen sind im Browser blockiert. Bitte in den Website-Einstellungen erlauben.",
    inactive: "Push ist auf diesem Gerät noch nicht aktiv.",
    active: "Push ist auf diesem Gerät aktiv.",
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-xl">
        <Smartphone className="h-5 w-5 text-primary" /> App &amp; Benachrichtigungen
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Installiere den Adminbereich als App und erhalte Push-Meldungen bei neuen Bestellungen –
        auch wenn der Tab geschlossen ist.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge
          className={
            status === "active"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }
        >
          {status === "active" ? "Aktiv" : status === "blocked" ? "Blockiert" : "Inaktiv"}
        </Badge>
        <span className="text-sm text-muted-foreground">{statusText[status]}</span>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={busy || status === "active" || status === "unsupported" || status === "loading"}
          onClick={() => {
            setBusy(true);
            setError(null);
            void (async () => {
              const result = await enablePush();
              setStatus(result.status);
              setBusy(false);
              if (result.ok) toast.success("Push für dieses Gerät aktiviert.");
              else setError(result.error ?? "Push konnte nicht aktiviert werden.");
            })();
          }}
          className="h-12 rounded-xl bg-flame px-6 font-bold uppercase tracking-wide text-primary-foreground"
        >
          <BellRing className="mr-2 h-4 w-4" /> Push aktivieren
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || status !== "active"}
          onClick={() => {
            setBusy(true);
            void (async () => {
              await disablePush();
              setStatus(await readPushStatus());
              setBusy(false);
              toast.success("Push für dieses Gerät deaktiviert.");
            })();
          }}
          className="h-12 rounded-xl px-6"
        >
          Push deaktivieren
        </Button>
        {installEvent && (
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl px-6"
            onClick={() => {
              void installEvent.prompt();
              setInstallEvent(null);
            }}
          >
            App installieren
          </Button>
        )}
      </div>

      <p className="mt-4 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        Hinweis: Jedes Gerät meldet sich einzeln an. Beim Abmelden wird die Push-Registrierung
        dieses Geräts wieder entfernt. Push-Meldungen enthalten nur Bestellnummer, Abholzeit und
        Betrag – keine Kundendaten.
      </p>
    </section>
  );
}

/** Eingeloggte Admins können hier ihr eigenes Passwort ändern. */
function SecuritySection() {
  const [current, setCurrent] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-xl">
        <ShieldCheck className="h-5 w-5 text-primary" /> Sicherheit
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Eigenes Admin-Passwort ändern.</p>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          if (pw1.length < 8) {
            setError("Das neue Passwort muss mindestens 8 Zeichen lang sein.");
            return;
          }
          if (pw1 !== pw2) {
            setError("Die neuen Passwörter stimmen nicht überein.");
            return;
          }
          setBusy(true);
          setError(null);
          void (async () => {
            const { error: err } = await supabase.auth.updateUser({
              password: pw1,
              current_password: current,
            });
            setBusy(false);
            if (err) {
              setError(
                "Passwort konnte nicht geändert werden. Bitte aktuelles Passwort prüfen und erneut versuchen.",
              );
              return;
            }
            toast.success("Passwort wurde geändert.");
            setCurrent("");
            setPw1("");
            setPw2("");
          })();
        }}
      >
        <div>
          <Label htmlFor="sec-current">Aktuelles Passwort</Label>
          <Input
            id="sec-current"
            type="password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className="mt-2 h-12"
          />
        </div>
        <div>
          <Label htmlFor="sec-new">Neues Passwort</Label>
          <Input
            id="sec-new"
            type="password"
            required
            minLength={8}
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            autoComplete="new-password"
            className="mt-2 h-12"
          />
        </div>
        <div>
          <Label htmlFor="sec-repeat">Neues Passwort wiederholen</Label>
          <Input
            id="sec-repeat"
            type="password"
            required
            minLength={8}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
            className="mt-2 h-12"
          />
        </div>
        <div className="sm:col-span-3">
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={busy}
            className="h-12 rounded-xl bg-flame px-6 font-bold uppercase tracking-wide text-primary-foreground"
          >
            {busy ? "Speichern läuft …" : "Passwort ändern"}
          </Button>
        </div>
      </form>
    </section>
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
