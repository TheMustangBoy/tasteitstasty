/**
 * Zentrale Helfer für den „heutigen Tag“ in der Zeitzone Europe/Berlin.
 * Wird von der Notfall-Schließung („Heute schließen“) genutzt, damit Client,
 * Admin und Datenbank denselben Tagesschlüssel verwenden.
 */
const BERLIN_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Tagesschlüssel `YYYY-MM-DD` in Berliner Zeit. */
export function berlinDayKey(date: Date = new Date()): string {
  return BERLIN_DAY.format(date);
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
