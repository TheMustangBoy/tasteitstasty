/**
 * Sehr einfaches Best-Effort-Rate-Limit pro Worker-Instanz.
 * Zusätzliche Sicherheit liefert die Idempotenz der Reservierungen –
 * dieses Limit bremst nur offensichtlichen Missbrauch ab.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 10, windowMs = 5 * 60_000): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return true;
}

export function clientKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
