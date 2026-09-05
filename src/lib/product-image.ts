/**
 * Produktbilder: Verkleinern, WebP-Komprimierung und Ablage im Storage-Bucket
 * `product-images`. Es wird ausschließlich die fertige Bild-URL in
 * `products.image_url` gespeichert.
 *
 * Annahme (dokumentiert): Öffentliche Buckets sind in diesem Workspace gesperrt,
 * deshalb liegt der Bucket privat und die Bilder werden über eine langlebige
 * signierte URL (10 Jahre) ausgeliefert. Schreibrechte hat nur `is_admin()`.
 */
import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_IMAGE_BUCKET = "product-images";
/** Längste Kantenlänge nach dem Verkleinern. */
export const MAX_EDGE = 1600;
/** WebP-Qualität. */
export const WEBP_QUALITY = 0.82;
/** Maximale Dateigröße vor der Komprimierung. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** Gültigkeit der signierten URL in Sekunden (10 Jahre). */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
];

export const ACCEPT_ATTRIBUTE = "image/*";

/** Prüft Typ und Größe der gewählten Datei. */
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Bitte eine Bilddatei auswählen (JPG, PNG, WebP, HEIC …).";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "Das Bild ist zu groß (max. 15 MB).";
  }
  return null;
}

async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: CanvasImageSource }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, draw: bitmap };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, draw: img };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Verkleinert auf max. 1600 px Kantenlänge und komprimiert als WebP. */
export async function compressToWebp(file: File): Promise<Blob> {
  const { width, height, draw } = await loadBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bild konnte nicht verarbeitet werden.");
  ctx.drawImage(draw, 0, 0, targetW, targetH);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
  );
  if (!blob) throw new Error("Bild konnte nicht komprimiert werden.");
  return blob;
}

/** Ermittelt den Storage-Pfad aus einer zuvor gespeicherten Bild-URL. */
export function storagePathFromUrl(url: string): string | null {
  if (!url) return null;
  const marker = `/${PRODUCT_IMAGE_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

/** Löscht eine Datei im Bucket, sofern die URL auf diesen Bucket zeigt. */
export async function deleteProductImage(url: string): Promise<void> {
  const path = storagePathFromUrl(url);
  if (!path) return;
  await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
}

/**
 * Lädt ein Bild hoch und gibt die dauerhaft nutzbare URL zurück.
 * Schlägt der Signaturschritt fehl, wird die hochgeladene Datei wieder
 * entfernt – so entstehen keine verwaisten Dateien.
 */
export async function uploadProductImage(productId: string, file: File): Promise<string> {
  const blob = await compressToWebp(file);
  const safeId = productId.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "produkt";
  const path = `${safeId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.webp`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, blob, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(error.message);

  const signed = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (signed.error || !signed.data?.signedUrl) {
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
    throw new Error(signed.error?.message ?? "Bild-URL konnte nicht erzeugt werden.");
  }
  return signed.data.signedUrl;
}
