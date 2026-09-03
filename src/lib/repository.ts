/**
 * Zentrale Datenzugriffsschicht (Repository) zwischen UI und Datenbank.
 * UI-Komponenten greifen ausschließlich über den ShopProvider hierauf zu.
 */
import { supabase } from "@/integrations/supabase/client";
import { orderErrorMessage } from "@/lib/payments/errors";
import type { DayHours, SelectionOption } from "@/data/menu";
import type { CartLine } from "@/context/cart";
import type {
  CancelReason,
  CategoryRecord,
  ExtraRecord,
  IngredientRecord,
  OrderStatus,
  OrderTimestamps,
  ProductRecord,
  ShopOrder,
  ShopSettings,
} from "@/context/shop";

/* ---------------------------------------------------------------- Mapping */

type ProductRow = {
  id: string;
  name: string;
  category_id: string;
  description: string;
  price: number | string;
  image_url: string;
  active: boolean;
  sold_out: boolean;
  patties: number | null;
  ingredients: string[];
  removable: string[];
  extra_ids: string[];
  options: unknown;
  tag: string;
  vegetarian: boolean;
  ingredients_placeholder: boolean;
  sort_order: number | string;
};

const num = (value: number | string | null | undefined) => Number(value ?? 0);

export const toProduct = (row: ProductRow): ProductRecord => ({
  id: row.id,
  name: row.name,
  categoryId: row.category_id,
  description: row.description ?? "",
  price: num(row.price),
  imageUrl: row.image_url ?? "",
  active: row.active,
  soldOut: row.sold_out,
  patties: row.patties,
  ingredients: row.ingredients ?? [],
  removable: row.removable ?? [],
  extraIds: row.extra_ids ?? [],
  options: (row.options as SelectionOption[] | null) ?? [],
  tag: row.tag ?? "",
  vegetarian: row.vegetarian,
  ingredientsPlaceholder: row.ingredients_placeholder,
  sortOrder: num(row.sort_order),
});

const fromProduct = (row: ProductRecord) => ({
  id: row.id,
  name: row.name,
  category_id: row.categoryId,
  description: row.description ?? "",
  price: row.price,
  image_url: row.imageUrl ?? "",
  active: row.active,
  sold_out: row.soldOut,
  patties: row.patties,
  ingredients: row.ingredients ?? [],
  removable: row.removable ?? [],
  extra_ids: row.extraIds ?? [],
  options: (row.options ?? []) as unknown as never,
  tag: row.tag ?? "",
  vegetarian: row.vegetarian,
  ingredients_placeholder: row.ingredientsPlaceholder,
  sort_order: row.sortOrder,
});

type OrderRow = {
  id: string;
  reference: string;
  customer_name: string;
  phone: string;
  pickup_at: string;
  pickup_label: string;
  payment: string;
  lines: unknown;
  total: number | string;
  status: string;
  note: string;
  internal_note: string;
  cancel_reason: string | null;
  cancel_note: string | null;
  status_timestamps: unknown;
  created_at: string;
  payment_provider?: string | null;
  payment_status?: string | null;
  paid_at?: string | null;
  customer_status_token?: string | null;
};

export function toOrder(row: OrderRow): ShopOrder {
  const order: ShopOrder = {
    id: row.id,
    reference: row.reference,
    createdAt: row.created_at,
    // Slot-Keys sind ISO-Strings – Normalisierung hält sie mit der Slot-Logik kompatibel.
    pickupISO: new Date(row.pickup_at).toISOString(),
    pickupLabel: row.pickup_label,
    status: row.status as OrderStatus,
    name: row.customer_name,
    phone: row.phone,
    note: row.note ?? "",
    internalNote: row.internal_note ?? "",
    payment: row.payment ?? "",
    lines: ((row.lines as CartLine[] | null) ?? []) as CartLine[],
    total: num(row.total),
    timestamps: ((row.status_timestamps as OrderTimestamps | null) ?? {}) as OrderTimestamps,
    paymentProvider: (row.payment_provider ?? null) as "manual" | "stripe" | null,
    paymentStatus: (row.payment_status ?? null) as "pay_on_pickup" | "paid" | "refunded" | null,
    paidAt: row.paid_at ?? null,
    customerStatusToken: row.customer_status_token ?? null,
  };
  if (row.cancel_reason) order.cancelReason = row.cancel_reason as CancelReason;
  if (row.cancel_note) order.cancelNote = row.cancel_note;
  return order;
}

/* -------------------------------------------------------------- Lesen */

export type ShopSnapshot = {
  categories: CategoryRecord[];
  ingredients: IngredientRecord[];
  extras: ExtraRecord[];
  products: ProductRecord[];
  settings: ShopSettings;
};

/** Öffentlich lesbare Stammdaten – ohne Bestellungen (keine Kundendaten). */
export async function fetchPublicSnapshot(): Promise<ShopSnapshot> {
  const [categories, ingredients, extras, products, settings, hours] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("ingredients").select("*").order("sort_order"),
    supabase.from("extras").select("*").order("sort_order"),
    supabase.from("products").select("*").order("sort_order"),
    supabase.from("shop_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("opening_hours").select("*").order("weekday"),
  ]);

  const firstError = [categories, ingredients, extras, products, settings, hours].find(
    (r) => r.error,
  )?.error;
  if (firstError) throw firstError;

  const hourRows = hours.data ?? [];
  const dayHours: DayHours[] = Array.from({ length: 7 }, (_, weekday) => {
    const row = hourRows.find((h) => h.weekday === weekday);
    return {
      open: row?.open_time ?? "11:00",
      close: row?.close_time ?? "18:00",
      closed: row?.closed ?? weekday === 0,
    };
  });

  return {
    categories: (categories.data ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      note: c.note ?? "",
      sortOrder: c.sort_order,
      paused: c.paused,
    })),
    ingredients: (ingredients.data ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      sortOrder: i.sort_order,
    })),
    extras: (extras.data ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      price: num(e.price),
      sortOrder: e.sort_order,
    })),
    products: (products.data ?? []).map((p) => toProduct(p as ProductRow)),
    settings: {
      hours: dayHours,
      maxOrdersPerSlot: settings.data?.max_orders_per_slot ?? 4,
      minLeadMinutes: settings.data?.min_lead_minutes ?? 15,
      ordersPaused: settings.data?.orders_paused ?? false,
      wheelSoundOn: settings.data?.wheel_sound_on ?? true,
    },
  };
}

/** Vollständige Bestellungen – nur für angemeldete Admins (RLS). */
export async function fetchAdminOrders(): Promise<ShopOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((o) => toOrder(o as OrderRow));
}

/** Slot-Auslastung ohne personenbezogene Daten (nur Zeit + Anzahl). */
export async function fetchSlotBookings(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("get_slot_bookings");
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    map[new Date(row.pickup_at).toISOString()] = Number(row.bookings ?? 0);
  }
  return map;
}

/** Prüft serverseitig, ob die aktuelle Session Adminrechte besitzt. */
export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) return false;
  return data === true;
}


/* -------------------------------------------------------------- Schreiben */

const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export async function saveProduct(row: ProductRecord) {
  check((await supabase.from("products").upsert(fromProduct(row))).error);
}

export async function saveProductOrder(rows: { id: string; sortOrder: number }[]) {
  await Promise.all(
    rows.map(async (r) =>
      check(
        (await supabase.from("products").update({ sort_order: r.sortOrder }).eq("id", r.id)).error,
      ),
    ),
  );
}

export async function removeProduct(id: string) {
  check((await supabase.from("products").delete().eq("id", id)).error);
}

export async function saveCategory(row: CategoryRecord) {
  check(
    (
      await supabase.from("categories").upsert({
        id: row.id,
        label: row.label,
        note: row.note ?? "",
        sort_order: row.sortOrder,
        paused: row.paused ?? false,
      })
    ).error,
  );
}

export async function saveCategoryOrder(rows: CategoryRecord[]) {
  await Promise.all(rows.map((r) => saveCategory(r)));
}

export async function removeCategory(id: string) {
  check((await supabase.from("categories").delete().eq("id", id)).error);
}

export async function saveIngredient(row: IngredientRecord) {
  check(
    (
      await supabase
        .from("ingredients")
        .upsert({ id: row.id, name: row.name, sort_order: row.sortOrder })
    ).error,
  );
}

/**
 * Umbenennen einer Zutat: alle exakten Vorkommen in `products.ingredients`
 * und `products.removable` werden serverseitig atomar mitgezogen.
 */
export async function renameIngredientRefs(oldName: string, newName: string) {
  if (!oldName || !newName || oldName === newName) return;
  const { error } = await supabase.rpc("rename_ingredient_refs", {
    p_old_name: oldName,
    p_new_name: newName,
  });
  if (error) throw new Error(error.message);
}

export async function saveIngredientOrder(rows: IngredientRecord[]) {
  await Promise.all(rows.map((r) => saveIngredient(r)));
}

/** Löscht die Zutat und entfernt sie atomar aus allen Produktlisten. */
export async function removeIngredient(id: string, name?: string) {
  if (name) {
    const { error } = await supabase.rpc("delete_ingredient_refs", { p_name: name });
    if (error) throw new Error(error.message);
  }
  check((await supabase.from("ingredients").delete().eq("id", id)).error);
}


export async function saveExtra(row: ExtraRecord) {
  check(
    (
      await supabase
        .from("extras")
        .upsert({ id: row.id, name: row.name, price: row.price, sort_order: row.sortOrder })
    ).error,
  );
}

export async function saveExtraOrder(rows: ExtraRecord[]) {
  await Promise.all(rows.map((r) => saveExtra(r)));
}

export async function removeExtra(id: string, productIds: { id: string; extraIds: string[] }[]) {
  check((await supabase.from("extras").delete().eq("id", id)).error);
  await Promise.all(
    productIds.map(async (p) =>
      check(
        (await supabase.from("products").update({ extra_ids: p.extraIds }).eq("id", p.id)).error,
      ),
    ),
  );
}

export async function saveSettings(settings: ShopSettings) {
  check(
    (
      await supabase.from("shop_settings").upsert({
        id: 1,
        orders_paused: settings.ordersPaused,
        wheel_sound_on: settings.wheelSoundOn,
        min_lead_minutes: settings.minLeadMinutes,
        max_orders_per_slot: settings.maxOrdersPerSlot,
      })
    ).error,
  );
}

export async function saveHours(hours: DayHours[]) {
  check(
    (
      await supabase.from("opening_hours").upsert(
        hours.map((h, weekday) => ({
          weekday,
          open_time: h.open,
          close_time: h.close,
          closed: h.closed,
        })),
      )
    ).error,
  );
}

/**
 * Fehlerübersetzung liegt zentral in `@/lib/payments/errors`, damit Client und
 * Server (Reservierungen) dieselben Meldungen verwenden.
 */
export { orderErrorMessage };


/** Bestellung anlegen – Validierung und Kapazitätsprüfung passieren atomar in der Datenbank. */
export async function placeOrderRemote(input: {
  reference: string;
  name: string;
  phone: string;
  pickupISO: string;
  pickupLabel: string;
  payment: string;
  lines: CartLine[];
  total: number;
  note: string;
  /** Idempotenzschlüssel des Browsers für genau diesen Bestell-Snapshot. */
  checkoutKey?: string;
  /** Zufälliger Token, mit dem der Kunde später den Status abfragen darf. */
  statusToken?: string;
}): Promise<ShopOrder> {
  const { data, error } = await supabase.rpc("place_order", {
    p_reference: input.reference,
    p_customer_name: input.name,
    p_phone: input.phone,
    p_pickup_at: input.pickupISO,
    p_pickup_label: input.pickupLabel,
    p_payment: input.payment,
    p_lines: input.lines as unknown as never,
    p_total: input.total,
    p_note: input.note,
    ...(input.checkoutKey ? { p_checkout_key: input.checkoutKey } : {}),
    ...(input.statusToken ? { p_status_token: input.statusToken } : {}),
  });

  if (error) throw new Error(orderErrorMessage(error.message));
  const row = (Array.isArray(data) ? data[0] : data) as OrderRow | null;
  if (!row) throw new Error("Die Bestellung konnte nicht gespeichert werden.");
  return toOrder(row);
}

export type OrderPatch = {
  status?: OrderStatus;
  internalNote?: string;
  timestamps?: OrderTimestamps;
  cancelReason?: CancelReason | null;
  cancelNote?: string | null;
  /** Nur beim Reaktivieren erstatteter Bestellungen: zurück auf Zahlung bei Abholung. */
  paymentProvider?: "manual" | "stripe";
  paymentStatus?: "pay_on_pickup" | "paid" | "refunded";
  payment?: string;
};

export async function saveOrderPatch(id: string, patch: OrderPatch) {
  const payload: Record<string, unknown> = {};
  if (patch.status !== undefined) payload["status"] = patch.status;
  if (patch.internalNote !== undefined) payload["internal_note"] = patch.internalNote;
  if (patch.timestamps !== undefined) payload["status_timestamps"] = patch.timestamps;
  if (patch.cancelReason !== undefined) payload["cancel_reason"] = patch.cancelReason;
  if (patch.cancelNote !== undefined) payload["cancel_note"] = patch.cancelNote;
  if (patch.paymentProvider !== undefined) payload["payment_provider"] = patch.paymentProvider;
  if (patch.paymentStatus !== undefined) payload["payment_status"] = patch.paymentStatus;
  if (patch.payment !== undefined) payload["payment"] = patch.payment;
  check(
    (
      await supabase
        .from("orders")
        .update(payload as never)
        .eq("id", id)
    ).error,
  );
}
