import { DEFAULT_HOURS, WEEKDAYS, type DayHours } from "@/data/menu";
import {
  addBerlinDays,
  berlinDateFrom,
  berlinDayDiff,
  berlinDayKey,
  berlinParts,
  berlinWeekdayOf,
} from "@/lib/berlin-day";

/**
 * Abholzeiten-Logik: Vorlauf + 5-Minuten-Takt, immer innerhalb der Öffnungszeiten.
 * Alle Tages- und Uhrzeitberechnungen laufen in Europe/Berlin, damit Gäste in
 * anderen Zeitzonen dieselben Slots sehen wie Küche und Datenbank.
 */
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
  /** Berliner Tagesschlüssel einer Notfall-Schließung (`YYYY-MM-DD`). */
  emergencyClosedDate?: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Tagesschlüssel eines Zeitpunkts – immer in Berliner Zeit. */
export const dayKeyOf = (d: Date) => berlinDayKey(d);

function parseTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function dayLabelForKey(dayKey: string, todayKey: string) {
  const diff = berlinDayDiff(todayKey, dayKey);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  const [, m, d] = dayKey.split("-");
  return `${WEEKDAYS[berlinWeekdayOf(dayKey)]}, ${d}.${m}.`;
}

/** Alle wählbaren Abholzeiten, nach Tag gruppiert. */
export function buildSlotDays(config: SlotConfig = {}): SlotDay[] {
  const now = config.now ?? new Date();
  const hours = config.hours ?? DEFAULT_HOURS;
  const minLead = config.minLeadMinutes ?? DEFAULT_MIN_LEAD_MINUTES;
  const maxPerSlot = config.maxOrdersPerSlot ?? DEFAULT_MAX_ORDERS_PER_SLOT;
  const bookings = config.bookings ?? {};
  const daysAhead = config.daysAhead ?? 6;
  const emergencyClosedDate = config.emergencyClosedDate ?? null;

  // Frühester Zeitpunkt: Vorlaufzeit, aufgerundet auf den 5-Minuten-Takt.
  const earliest = new Date(Math.ceil((now.getTime() + minLead * 60_000) / 1000) * 1000);
  earliest.setUTCMilliseconds(0);
  earliest.setUTCSeconds(0);
  const stepMs = SLOT_STEP_MINUTES * 60_000;
  const earliestMs = Math.ceil(earliest.getTime() / stepMs) * stepMs;

  const todayKey = berlinDayKey(now);
  const days: SlotDay[] = [];

  for (let offset = 0; offset <= daysAhead; offset++) {
    const dayKey = addBerlinDays(todayKey, offset);
    if (emergencyClosedDate && dayKey === emergencyClosedDate) continue;

    const weekday = berlinWeekdayOf(dayKey);
    const dayHours = hours[weekday] ?? DEFAULT_HOURS[weekday]!;
    if (dayHours.closed) continue;

    const open = parseTime(dayHours.open);
    const close = parseTime(dayHours.close);
    const openMinutes = open.h * 60 + open.m;
    const closeMinutes = close.h * 60 + close.m;
    if (closeMinutes <= openMinutes) continue;

    const dayLabel = dayLabelForKey(dayKey, todayKey);
    const slots: Slot[] = [];
    for (let minutes = openMinutes; minutes <= closeMinutes; minutes += SLOT_STEP_MINUTES) {
      // Wanduhrzeit → echter Zeitpunkt (sommerzeitsicher).
      const date = berlinDateFrom(dayKey, Math.floor(minutes / 60), minutes % 60);
      if (date.getTime() < earliestMs) continue; // vergangene / zu kurzfristige Fenster
      const key = date.toISOString();
      const booked = bookings[key] ?? 0;
      slots.push({
        key,
        date,
        label: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`,
        dayLabel,
        dayKey,
        booked,
        full: booked >= maxPerSlot,
      });
    }
    if (slots.length > 0) days.push({ dayKey, dayLabel, slots });
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

/** Ist der Truck gerade geöffnet? (Berliner Zeit) */
export function isOpenNow(now = new Date(), hours: DayHours[] = DEFAULT_HOURS) {
  const p = berlinParts(now);
  const dayHours = hours[p.weekday];
  if (!dayHours || dayHours.closed) return false;
  const open = parseTime(dayHours.open);
  const close = parseTime(dayHours.close);
  const minutes = p.hour * 60 + p.minute;
  return minutes >= open.h * 60 + open.m && minutes <= close.h * 60 + close.m;
}

/** Text für „wann kann wieder bestellt werden“. */
export function nextOpeningLabel(now = new Date(), hours: DayHours[] = DEFAULT_HOURS) {
  const todayKey = berlinDayKey(now);
  const p = berlinParts(now);
  const nowMinutes = p.hour * 60 + p.minute;

  for (let offset = 0; offset <= 7; offset++) {
    const dayKey = addBerlinDays(todayKey, offset);
    const dayHours = hours[berlinWeekdayOf(dayKey)];
    if (!dayHours || dayHours.closed) continue;
    const open = parseTime(dayHours.open);
    const close = parseTime(dayHours.close);
    const openMinutes = open.h * 60 + open.m;
    const closeMinutes = close.h * 60 + close.m;
    if (offset === 0 && nowMinutes > closeMinutes) continue;
    if (offset === 0 && nowMinutes >= openMinutes) return `heute bis ${dayHours.close} Uhr`;
    return `${dayLabelForKey(dayKey, todayKey).replace(",", "")} ab ${dayHours.open} Uhr`;
  }
  return "in Kürze";
}
