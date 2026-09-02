/**
 * Übersetzt die Fehlercodes der Datenbankfunktionen (`place_order`,
 * `create_payment_reservation`) in verständliche deutsche Meldungen.
 * Wird von Client und Server gemeinsam genutzt.
 */
export function orderErrorMessage(raw: string): string {
  const detail = (code: string) => raw.split(`${code}:`)[1]?.split(/["\n]/)[0]?.trim() ?? "";
  if (raw.includes("SLOT_FULL"))
    return "Dieses Abholfenster ist leider gerade ausgebucht. Bitte wähle eine andere Zeit.";
  if (raw.includes("ORDERS_PAUSED")) return "Online-Bestellungen sind aktuell pausiert.";
  if (raw.includes("EMPTY_CART")) return "Dein Warenkorb ist leer.";
  if (raw.includes("PAYMENT_NOT_ALLOWED"))
    return "Diese Zahlungsart ist für diesen Bestellweg nicht zulässig.";
  if (raw.includes("PRODUCT_UNAVAILABLE"))
    return `„${detail("PRODUCT_UNAVAILABLE") || "Ein Produkt"}“ ist aktuell nicht verfügbar. Bitte passe deinen Warenkorb an.`;
  if (raw.includes("CATEGORY_PAUSED"))
    return `Die Kategorie von „${detail("CATEGORY_PAUSED") || "einem Produkt"}“ ist derzeit pausiert.`;
  if (raw.includes("EXTRA_UNAVAILABLE"))
    return `Das Extra „${detail("EXTRA_UNAVAILABLE") || "unbekannt"}“ ist nicht mehr verfügbar.`;
  if (raw.includes("OPTION_UNAVAILABLE"))
    return `Die Auswahl „${detail("OPTION_UNAVAILABLE") || "unbekannt"}“ ist nicht mehr verfügbar.`;
  if (raw.includes("INVALID_REMOVAL"))
    return "Eine ausgewählte Änderung an den Zutaten ist nicht mehr verfügbar. Bitte lege den Artikel neu in den Warenkorb.";
  if (raw.includes("INVALID_QUANTITY"))
    return `Die Menge für „${detail("INVALID_QUANTITY") || "ein Produkt"}“ ist ungültig.`;
  if (raw.includes("PRICE_CHANGED"))
    return "Die Preise haben sich geändert. Bitte lade die Seite neu und prüfe deinen Warenkorb.";
  if (raw.includes("PICKUP_TOO_SOON"))
    return "Die gewählte Abholzeit liegt zu kurzfristig. Bitte wähle einen späteren Zeitpunkt.";
  if (raw.includes("CLOSED"))
    return "Zur gewählten Abholzeit ist der Truck geschlossen. Bitte wähle eine andere Zeit.";
  if (raw.includes("INVALID_PICKUP"))
    return "Die gewählte Abholzeit ist ungültig. Bitte wähle einen neuen Zeitpunkt.";
  return "Die Bestellung konnte nicht gespeichert werden. Bitte versuche es erneut.";
}
