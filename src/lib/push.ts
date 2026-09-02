import { supabase } from "@/integrations/supabase/client";

/**
 * VAPID Public Key – bewusst öffentlich (wird an den Push-Dienst des Browsers
 * gesendet). Der private Schlüssel liegt ausschließlich serverseitig.
 */
export const VAPID_PUBLIC_KEY =
  "BNwy8xlJRLRoq0oL3Ow3MJ2BhKS8LLlAMS4Q4kapR7U9wAAiWumgHXMndjHwi_5n037CKIGpDbsxxKsMgyTqqmY";

export type PushStatus =
  "unsupported" | "needs-install" | "blocked" | "inactive" | "active" | "loading";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** Liest die Schlüssel im Web-Push-Format (base64url) direkt aus der Subscription. */
function readSubscriptionKeys(
  subscription: PushSubscription,
): { p256dh: string; auth: string } | null {
  const keys = subscription.toJSON().keys;
  const p256dh = keys?.["p256dh"] ?? "";
  const auth = keys?.["auth"] ?? "";
  if (!p256dh || !auth) return null;
  return { p256dh, auth };
}


/** Registriert den Messaging-Service-Worker (nur auf Nutzergeste aufrufen). */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/sw.js");
    const registration = existing ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    return registration;
  } catch {
    return null;
  }
}

/** Aktueller Zustand für die Admin-UI. */
export async function readPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "active" : "inactive";
}

/**
 * Push für dieses Gerät aktivieren: Permission anfragen, Subscription anlegen
 * und in der Datenbank speichern (pro Gerät eine Zeile).
 */
export async function enablePush(): Promise<{ ok: boolean; status: PushStatus; error?: string }> {
  if (!pushSupported()) {
    return {
      ok: false,
      status: isIos() && !isStandalone() ? "needs-install" : "unsupported",
      error: "Dieses Gerät unterstützt keine Web-Push-Benachrichtigungen.",
    };
  }
  if (isIos() && !isStandalone()) {
    return {
      ok: false,
      status: "needs-install",
      error: "Auf iPhone/iPad zuerst über „Teilen → Zum Home-Bildschirm“ installieren.",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      status: permission === "denied" ? "blocked" : "inactive",
      error: "Benachrichtigungen wurden nicht erlaubt.",
    };
  }

  const registration = await ensureServiceWorker();
  if (!registration) {
    return { ok: false, status: "unsupported", error: "Service Worker konnte nicht starten." };
  }

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));

  const keys = readSubscriptionKeys(subscription);
  if (!keys) {
    await subscription.unsubscribe().catch(() => undefined);
    return {
      ok: false,
      status: "inactive",
      error: "Push-Schlüssel unvollständig – bitte erneut versuchen.",
    };
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return { ok: false, status: "inactive", error: "Nicht angemeldet." };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent.slice(0, 180),
    },
    { onConflict: "endpoint" },
  );


  if (error) {
    return { ok: false, status: "inactive", error: "Gerät konnte nicht registriert werden." };
  }
  return { ok: true, status: "active" };
}

/** Push für dieses Gerät abmelden und die Datenbankzeile entfernen. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } catch {
    /* stille Bereinigung – Logout darf nie blockieren */
  }
}
