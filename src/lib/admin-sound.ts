/**
 * Zentrales Audio-Handling für den Adminbereich.
 * Ein einziger, wiederverwendeter AudioContext (Browser limitieren die Anzahl),
 * der per Nutzergeste „geprimt“ (resumed) werden muss.
 */
let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    sharedCtx ??= new Ctx();
    return sharedCtx;
  } catch {
    return null;
  }
}

/**
 * Muss aus einer Nutzergeste heraus aufgerufen werden (Login, Ton-Schalter …),
 * damit spätere, automatisch ausgelöste Töne nicht vom Browser blockiert werden.
 */
export function primeAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* Priming nicht möglich – Toasts bleiben als Fallback */
  }
}

/** Kurzer Benachrichtigungston (WebAudio, ohne Asset-Datei). Wirft nie. */
export function playNotificationSound() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.18);
    });
  } catch {
    /* Ton nicht verfügbar – kein Fehler nach außen */
  }
}

/** Sehr kurzer Tick beim Weiterrasten des Wheel Pickers (gleicher AudioContext). */
export function playWheelTick() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 1500;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    /* Ton nicht verfügbar */
  }
}

/**
 * Kurze Vibration, sofern das Gerät sie unterstützt.
 *
 * Plattform-Einschränkung: iOS/Safari unterstützt `navigator.vibrate` nicht
 * (Stand 2026) – dort gibt es ohne native App keine Wheel-Haptik. Als Fallback
 * dienen die visuelle Hervorhebung der aktiven Zeile und der optionale
 * Tick-Ton. Rückgabewert sagt, ob eine Vibration ausgelöst wurde.
 */
export function hapticTick(): boolean {
  if (typeof navigator === "undefined") return false;
  try {
    return navigator.vibrate?.(8) ?? false;
  } catch {
    return false;
  }
}

/** True, wenn die Vibrations-API grundsätzlich verfügbar ist (nicht iOS/Safari). */
export const hapticsSupported = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
