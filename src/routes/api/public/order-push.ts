import { createFileRoute } from "@tanstack/react-router";
import { ApplicationServerKeys, generatePushHTTPRequest, setWebCrypto } from "webpush-webcrypto";
import { z } from "zod";

/**
 * Push-Versand für neue Bestellungen.
 * Aufruf ausschließlich durch den Datenbank-Trigger `orders_notify_new_order`
 * (pg_net) mit gemeinsamem Secret im Header `x-push-secret`.
 * Es werden keine Kundendaten übertragen oder geloggt.
 */
const payloadSchema = z.object({
  reference: z.string().min(1).max(40),
  pickup_label: z.string().max(60).optional().default(""),
  pickup_at: z.string().optional(),
  total: z.union([z.number(), z.string()]).optional(),
});

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function formatPickup(label: string, iso?: string): string {
  if (label) return label;
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export const Route = createFileRoute("/api/public/order-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PUSH_HOOK_SECRET"];
        const provided = request.headers.get("x-push-secret") ?? "";
        if (!secret || !timingSafeEqual(provided, secret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad Request", { status: 400 });
        const order = parsed.data;

        const publicKey = process.env["VAPID_PUBLIC_KEY"];
        const privateKey = process.env["VAPID_PRIVATE_KEY"];
        const subject = process.env["VAPID_SUBJECT"] ?? "mailto:admin@example.com";
        if (!publicKey || !privateKey) {
          console.error("[push] VAPID keys missing");
          return new Response("Not configured", { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: subs, error } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth");

        if (error) {
          console.error("[push] subscription lookup failed");
          return new Response("Lookup failed", { status: 500 });
        }
        if (!subs || subs.length === 0) return Response.json({ sent: 0, removed: 0 });

        const totalNumber = Number(order.total ?? 0);
        const priceText = Number.isFinite(totalNumber)
          ? `${totalNumber.toFixed(2).replace(".", ",")} €`
          : "";
        const pickup = formatPickup(order.pickup_label, order.pickup_at);
        const bodyText = [`Nr. ${order.reference}`, pickup && `Abholung ${pickup}`, priceText]
          .filter(Boolean)
          .join(" · ");

        const message = JSON.stringify({
          title: "Neue Bestellung eingegangen",
          body: bodyText,
          tag: `order-${order.reference}`,
        });

        // Die Bibliothek erwartet eine explizite WebCrypto-Instanz (Worker/Node).
        setWebCrypto(globalThis.crypto);
        const keys = await ApplicationServerKeys.fromJSON({ publicKey, privateKey });
        const stale: string[] = [];
        let sent = 0;

        await Promise.all(
          subs.map(async (sub) => {
            try {
              const { headers, body, endpoint } = await generatePushHTTPRequest({
                applicationServerKeys: keys,
                payload: message,
                target: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                adminContact: subject,
                ttl: 600,
                urgency: "high",
              });
              const res = await fetch(endpoint, { method: "POST", headers, body });
              if (res.status === 404 || res.status === 410) {
                stale.push(sub.id);
              } else if (res.ok) {
                sent += 1;
              } else {
                console.error(`[push] delivery failed with status ${res.status}`);
              }
            } catch {
              console.error("[push] delivery error");
            }
          }),
        );

        if (stale.length > 0) {
          await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
        }

        return Response.json({ sent, removed: stale.length });
      },
    },
  },
});
