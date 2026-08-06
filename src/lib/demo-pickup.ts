/**
 * Demo-Abholzeit: rundet auf den nächsten 5-Minuten-Takt und schiebt die Zeit
 * in das nächste geöffnete Fenster (Mo–Sa 11:00–18:00), damit Demo-Bestellungen
 * niemals außerhalb der Öffnungszeiten liegen.
 */
export function demoPickupDate(base: Date, offsetMinutes = 0, openHour = 11, closeHour = 18): Date {
  const d = new Date(base);
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5);

  const skipSunday = () => {
    while (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
      d.setHours(openHour, 0, 0, 0);
    }
  };

  skipSunday();
  if (d.getHours() < openHour) {
    d.setHours(openHour, 0, 0, 0);
    d.setMinutes(d.getMinutes() + offsetMinutes);
  } else if (d.getHours() > closeHour || (d.getHours() === closeHour && d.getMinutes() > 0)) {
    d.setDate(d.getDate() + 1);
    d.setHours(openHour, 0, 0, 0);
    skipSunday();
    d.setMinutes(d.getMinutes() + offsetMinutes);
  }
  return d;
}
