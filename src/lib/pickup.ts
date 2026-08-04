import { DEFAULT_HOURS, WEEKDAYS, type DayHours } from "@/data/menu";

/** Abholzeiten-Logik: Vorlauf + 5-Minuten-Takt, immer innerhalb der Öffnungszeiten. */
export const SLOT_STEP_MINUTES = 5;
export const DEFAULT_MIN_LEAD_MINUTES = 15;
export const DEFAULT_MAX_ORDERS_PER_SLOT = 4;

export type Slot = {
  key: string;
  date: Date;
  label: string;
  dayLabel: string;
  dayKey: string;
  booked: number;
  full: boolean;
};

export type SlotDay = { dayKey: string; dayLabel: string; slots: Slot[] };

export type SlotConfig = {
  now?: Date;
  hours?: DayHours[];
  minLeadMinutes?: number;
  maxOrdersPerSlot?: number;
  bookings?: Record<string, number>;
  daysAhead?: number;
};

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function dayLabelFor(date: Date, now: Date) {
  const diff = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  return `${WEEKDAYS[date.getDay()]}, ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.`;
}

/** Alle wählbaren Abholzeiten, nach Tag gruppiert. */
export function buildSlotDays(config: SlotConfig = {}): SlotDay[] {
  const now = config.now ?? new Date();
  const hours = config.hours ?? DEFAULT_HOURS;
  const minLead = config.minLeadMinutes ?? DEFAULT_MIN_LEAD_MINUTES;
  const maxPerSlot = config.maxOrdersPerSlot ?? DEFAULT_MAX_ORDERS_PER_SLOT;
  const bookings = config.bookings ?? {};
  const daysAhead = config.daysAhead ?? 6;

  const earliest = new Date(now.getTime() + minLead * 60_000);
  earliest.setSeconds(0, 0);
  const rest = earliest.getMinutes() % SLOT_STEP_MINUTES;
  if (rest !== 0) earliest.setMinutes(earliest.getMinutes() + (SLOT_STEP_MINUTES - rest));

  const days: SlotDay[] = [];
  for (let offset = 0; offset <= daysAhead; offset++) {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayHours = hours[base.getDay()] ?? DEFAULT_HOURS[base.getDay()]!;
    if (dayHours.closed) continue;

    const open = parseTime(dayHours.open);
    const close = parseTime(dayHours.close);
    const start = new Date(base);
    start.setHours(open.h, open.m, 0, 0);
    const end = new Date(base);
    end.setHours(close.h, close.m, 0, 0);
    if (end <= start) continue;

    const slots: Slot[] = [];
    for (let t = start.getTime(); t <= end.getTime(); t += SLOT_STEP_MINUTES * 60_000) {
      const date = new Date(t);
      if (date < earliest) continue; // vergangene / zu kurzfristige Fenster ausblenden
      const key = date.toISOString();
      const booked = bookings[key] ?? 0;
      slots.push({
        key,
        date,
        label: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
        dayLabel: dayLabelFor(date, now),
        dayKey: dayKeyOf(date),
        booked,
        full: booked >= maxPerSlot,
      });
    }
    if (slots.length > 0)
      days.push({ dayKey: dayKeyOf(base), dayLabel: dayLabelFor(base, now), slots });
  }
  return days;
}

export function flattenSlots(days: SlotDay[]) {
  return days.flatMap((d) => d.slots);
}

/** Nächstes freies Zeitfenster – wird automatisch vorgeschlagen. */
export function nextAvailableSlot(days: SlotDay[]) {
  return flattenSlots(days).find((s) => !s.full);
}

/** Ist der Truck gerade geöffnet? */
export function isOpenNow(now = new Date(), hours: DayHours[] = DEFAULT_HOURS) {
  const dayHours = hours[now.getDay()];
  if (!dayHours || dayHours.closed) return false;
  const open = parseTime(dayHours.open);
  const close = parseTime(dayHours.close);
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= open.h * 60 + open.m && minutes <= close.h * 60 + close.m;
}

/** Text für „wann kann wieder bestellt werden“. */
export function nextOpeningLabel(now = new Date(), hours: DayHours[] = DEFAULT_HOURS) {
  for (let offset = 0; offset <= 7; offset++) {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayHours = hours[base.getDay()];
    if (!dayHours || dayHours.closed) continue;
    const open = parseTime(dayHours.open);
    const close = parseTime(dayHours.close);
    const opensAt = new Date(base);
    opensAt.setHours(open.h, open.m, 0, 0);
    const closesAt = new Date(base);
    closesAt.setHours(close.h, close.m, 0, 0);
    if (offset === 0 && now > closesAt) continue;
    if (offset === 0 && now >= opensAt) return `heute bis ${dayHours.close} Uhr`;
    return `${dayLabelFor(base, now).replace(",", "")} ab ${dayHours.open} Uhr`;
  }
  return "in Kürze";
}
