import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Statusabfrage einer Bestellung für den Kunden – ausschließlich über den
 * geräteseitig gespeicherten, nicht erratbaren Status-Token.
 * Liefert keinerlei Kundendaten, nur Status, Zahlungsstatus und Bestellnummer.
 */
const bodySchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[0-9a-f]{32,128}$/, "invalid token"),
});

export const Route = createFileRoute("/api/public/orders/status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { rateLimit, clientKey } = await import("@/lib/payments/rate-limit.server");
        if (!rateLimit(`order-status:${clientKey(request)}`, 120)) {
          return Response.json({ error: "Zu viele Anfragen." }, { status: 429 });
        }

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("orders")
          .select("status, payment_status, reference")
          .eq("customer_status_token", parsed.data.token)
          .maybeSingle();

        if (error) return Response.json({ error: "Status nicht verfügbar." }, { status: 500 });
        if (!data) return Response.json({ error: "Nicht gefunden." }, { status: 404 });

        return Response.json(
          {
            status: data.status,
            paymentStatus: data.payment_status ?? "",
            reference: data.reference,
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
