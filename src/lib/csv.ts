import type { ShopOrder } from "@/context/shop";
import { linePrice } from "@/context/cart";

const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

/** Bestellhistorie als CSV (Demo-Export, rein clientseitig). */
export function ordersToCsv(orders: ShopOrder[]) {
  const header = [
    "Bestellnummer",
    "Eingang",
    "Abholung",
    "Status",
    "Kunde",
    "Telefon",
    "Zahlungsart",
    "Kundenhinweis",
    "Interne Notiz",
    "Positionen",
    "Gesamt (EUR)",
  ];
  const rows = orders.map((o) => [
    o.reference,
    new Date(o.createdAt).toLocaleString("de-DE"),
    o.pickupLabel,
    o.status,
    o.name,
    o.phone,
    o.payment,
    o.note,
    o.internalNote ?? "",
    o.lines
      .map((l) => {
        const extras = l.extras?.length
          ? ` +${l.extras.map((e) => e.name).join("+")}`
          : l.bacon
            ? " +Bacon"
            : "";
        const removed = l.removed.length ? ` ohne ${l.removed.join("/")}` : "";
        return `${l.quantity}x ${l.name}${extras}${removed} (${linePrice(l).toFixed(2)})`;
      })
      .join(" | "),
    o.total.toFixed(2),
  ]);
  return [header, ...rows].map((row) => row.map(escape).join(";")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
