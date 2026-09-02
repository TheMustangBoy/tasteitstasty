import { createFileRoute } from "@tanstack/react-router";
import { reservationStatusSchema, type ReservationStatus } from "@/lib/payments/config";

/**
 * Statusabfrage einer Reservierung – nur mit ID **und** Token.
 * Liefert keine Kundendaten, nur Status und Bestellnummer.
 */
export const Route = createFileRoute("/api/public/payments/status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { rateLimit, clientKey } = await import("@/lib/payments/rate-limit.server");
        if (!rateLimit(`status:${clientKey(request)}`, 120)) {
          return Response.json({ error: "Zu viele Anfragen." }, { status: 429 });
        }

        const parsed = reservationStatusSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("payment_reservations")
          .select("status, reference, expires_at")
          .eq("id", parsed.data.reservationId)
          .eq("token", parsed.data.token)
          .maybeSingle();

        if (error) return Response.json({ error: "Status nicht verfügbar." }, { status: 500 });
        if (!data) return Response.json({ error: "Nicht gefunden." }, { status: 404 });

        const expired =
          data.status === "pending" && new Date(data.expires_at).getTime() <= Date.now();
        const body: ReservationStatus = {
          status: expired ? "expired" : (data.status as ReservationStatus["status"]),
          reference: data.reference,
        };
        return Response.json(body, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
