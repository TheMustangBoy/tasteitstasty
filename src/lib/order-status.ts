/**
 * Kundenseitiger Bestellstatus – geräte-/browsergebunden über einen
 * zufälligen Status-Token. Kein Konto, kein Tracking, keine Token in URLs.
 */
export type CustomerOrderStatus = {
  status: string;
  paymentStatus: string;
  reference: string;
};

/** Gründe, aus denen eine lokale Bestellung nicht mehr aktiv angezeigt wird. */
export type OrderClosedReason = "storniert" | "abgelehnt" | "erstattet" | "abgeschlossen";

/** Kryptografisch sicherer Hex-Token (64 Zeichen) für die Statusabfrage. */
export function createStatusToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Ordnet einen Serverstatus dem lokalen Abschlussgrund zu (null = weiter aktiv). */
export function closedReasonFor(state: {
  status: string;
  paymentStatus?: string;
}): OrderClosedReason | null {
  if (state.paymentStatus === "refunded") return "erstattet";
  if (state.status === "storniert") return "storniert";
  if (state.status === "abgelehnt") return "abgelehnt";
  if (state.status === "abgeschlossen") return "abgeschlossen";
  return null;
}

/** Meldungstext zum Abschlussgrund. */
export function closedReasonMessage(reason: OrderClosedReason): string {
  switch (reason) {
    case "storniert":
      return "Diese Bestellung wurde storniert.";
    case "abgelehnt":
      return "Diese Bestellung wurde vom Truck abgelehnt.";
    case "erstattet":
      return "Diese Bestellung wurde storniert – der Betrag wurde erstattet.";
    case "abgeschlossen":
      return "Diese Bestellung wurde bereits abgeholt.";
  }
}

/** Anzeigetext für den Live-Status einer Bestellung. */
export type OrderStatusLabel = {
  title: string;
  hint: string;
  /** `open` = Bestellung läuft, `closed` = beendet. */
  tone: "open" | "closed";
};

/** Label/Hinweis für jeden bekannten Serverstatus (inkl. Erstattung). */
export function statusLabel(state: {
  status: string;
  paymentStatus?: string;
}): OrderStatusLabel {
  if (state.paymentStatus === "refunded") {
    return {
      title: "Betrag erstattet",
      hint: "Der Betrag wurde vollständig zurückerstattet.",
      tone: "closed",
    };
  }
  switch (state.status) {
    case "neu":
      return {
        title: "Bestellung eingegangen",
        hint: "Warte auf Bestätigung durch den Truck.",
        tone: "open",
      };
    case "angenommen":
      return {
        title: "Bestellung angenommen",
        hint: "Der Truck hat deine Bestellung bestätigt.",
        tone: "open",
      };
    case "zubereitung":
      return { title: "In Zubereitung", hint: "Deine Bestellung wird frisch zubereitet.", tone: "open" };
    case "abholbereit":
      return { title: "Abholbereit", hint: "Deine Bestellung wartet am Truck.", tone: "open" };
    case "storniert":
      return { title: "Bestellung storniert", hint: closedReasonMessage("storniert"), tone: "closed" };
    case "abgelehnt":
      return { title: "Bestellung abgelehnt", hint: closedReasonMessage("abgelehnt"), tone: "closed" };
    case "abgeschlossen":
      return {
        title: "Bestellung abgeschlossen",
        hint: closedReasonMessage("abgeschlossen"),
        tone: "closed",
      };
    default:
      return { title: "Bestellung aktiv", hint: "Status wird aktualisiert.", tone: "open" };
  }
}


/** Status abfragen. `null` bei Netz-/Serverfehlern, `"gone"` wenn unbekannt. */
export async function fetchOrderStatus(
  token: string,
): Promise<CustomerOrderStatus | "gone" | null> {
  try {
    const res = await fetch("/api/public/orders/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.status === 404) return "gone";
    if (!res.ok) return null;
    return (await res.json()) as CustomerOrderStatus;
  } catch {
    return null;
  }
}
