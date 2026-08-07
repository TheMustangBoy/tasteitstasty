/** Erlaubt Ziffern, Leerzeichen, Bindestriche, Klammern, Schrägstrich und ein führendes „+“. */
const ALLOWED = /^\+?[\d\s\-()/.]*$/;

/** Entfernt alle Formatierungszeichen und liefert nur „+“ und Ziffern. */
export function normalizePhone(value: string) {
  const trimmed = value.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

/** Blockiert Buchstaben bereits bei der Eingabe. */
export function sanitizePhoneInput(value: string) {
  return value.replace(/[^\d+\s\-()/.]/g, "").replace(/(?!^)\+/g, "");
}

/**
 * Gültig sind deutsche und internationale Rufnummern:
 * +49…, 0049… oder mit führender 0. Mindestens 7, maximal 15 Ziffern.
 */
export function isValidPhone(value: string) {
  if (!ALLOWED.test(value.trim())) return false;
  const normalized = normalizePhone(value);
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return normalized.startsWith("+") || digits.startsWith("0");
}

export const PHONE_ERROR = "Bitte gib eine gültige Telefonnummer ein.";
