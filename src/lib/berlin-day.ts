/**
 * Zentrale Helfer für Datum und Uhrzeit in der Zeitzone Europe/Berlin.
 *
 * Hintergrund: Datenbank und Küche arbeiten immer in Berliner Zeit, der Browser
 * eines Gastes kann jedoch in einer beliebigen Zeitzone laufen. Alle Tages- und
 * Slot-Berechnungen laufen deshalb über diese Helfer, damit „heute“ und die
 * Öffnungszeiten überall denselben Berliner Tag meinen.
 */
const BERLIN_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export type BerlinParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sonntag … 6 = Samstag (Berliner Kalendertag). */
  weekday: number;
  /** `YYYY-MM-DD` in Berliner Zeit. */
  dayKey: string;
};

/** Wanduhr-Bestandteile eines Zeitpunkts in Berliner Zeit. */
export function berlinParts(date: Date = new Date()): BerlinParts {
  const map: Record<string, string> = {};
  for (const part of BERLIN_PARTS.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const year = Number(map["year"]);
  const month = Number(map["month"]);
  const day = Number(map["day"]);
  // Intl liefert 24 Uhr für Mitternacht in manchen Runtimes.
  const hour = Number(map["hour"]) % 24;
  const minute = Number(map["minute"]);
  const second = Number(map["second"]);
  const dayKey = `${map["year"]}-${map["month"]}-${map["day"]}`;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, hour, minute, second, weekday, dayKey };
}

/** Tagesschlüssel `YYYY-MM-DD` in Berliner Zeit. */
export function berlinDayKey(date: Date = new Date()): string {
  return berlinParts(date).dayKey;
}

/** Offset der Berliner Zeit gegenüber UTC zum gegebenen Zeitpunkt (in ms). */
export function berlinOffsetMs(date: Date): number {
  const p = berlinParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Wandelt eine Berliner Wanduhrzeit in den echten Zeitpunkt (UTC-Instant) um.
 * Zwei Durchläufe fangen Sommerzeitwechsel korrekt ab.
 */
export function berlinDateFrom(dayKey: string, hour = 0, minute = 0): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  const naive = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hour, minute, 0);
  let result = new Date(naive - berlinOffsetMs(new Date(naive)));
  result = new Date(naive - berlinOffsetMs(result));
  return result;
}

/** Tagesschlüssel um `days` Tage verschieben (kalendarisch, DST-sicher). */
export function addBerlinDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** Kalendertage zwischen zwei Berliner Tagesschlüsseln (`b - a`). */
export function berlinDayDiff(a: string, b: string): number {
  const toUtc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Wochentag (0 = Sonntag) eines Berliner Tagesschlüssels. */
export function berlinWeekdayOf(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** Ist der markierte Notfall-Schließtag der heutige Berliner Tag? */
export function isEmergencyClosedToday(
  emergencyClosedDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  return Boolean(emergencyClosedDate) && emergencyClosedDate === berlinDayKey(now);
}

/** Menschlich lesbares Datum (z. B. „03.09.2026“) für Adminhinweise. */
export function formatBerlinDate(dayKey: string): string {
  const [y, m, d] = dayKey.split("-");
  return y && m && d ? `${d}.${m}.${y}` : dayKey;
}
