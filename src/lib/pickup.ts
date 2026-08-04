/** Abholzeiten-Logik: 15 Min Vorlauf, 5-Minuten-Takt, max. 4 Bestellungen pro Slot. */
export const MIN_LEAD_MINUTES = 15;
export const SLOT_STEP_MINUTES = 5;
export const MAX_ORDERS_PER_SLOT = 4;

export type Slot = {
  key: string;
  date: Date;
  label: string;
  booked: number;
  full: boolean;
};

/** Demo-Auslastung – wird später durch echte Bestelldaten ersetzt. */
function demoBooked(date: Date) {
  const seed = date.getHours() * 60 + date.getMinutes();
  return [0, 1, 4, 2, 0, 3, 4, 1][seed % 8] ?? 0;
}

export function buildSlots(now = new Date(), hoursAhead = 4): Slot[] {
  const start = new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000);
  start.setSeconds(0, 0);
  const remainder = start.getMinutes() % SLOT_STEP_MINUTES;
  if (remainder !== 0) start.setMinutes(start.getMinutes() + (SLOT_STEP_MINUTES - remainder));

  const slots: Slot[] = [];
  const count = (hoursAhead * 60) / SLOT_STEP_MINUTES;
  for (let i = 0; i < count; i++) {
    const date = new Date(start.getTime() + i * SLOT_STEP_MINUTES * 60_000);
    const booked = demoBooked(date);
    slots.push({
      key: date.toISOString(),
      date,
      label: date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      booked,
      full: booked >= MAX_ORDERS_PER_SLOT,
    });
  }
  return slots;
}

/** Nächstes freies Zeitfenster – wird automatisch vorgeschlagen. */
export function nextAvailableSlot(slots: Slot[]) {
  return slots.find((s) => !s.full);
}