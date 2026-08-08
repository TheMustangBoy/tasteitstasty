import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTick, playWheelTick } from "@/lib/admin-sound";
import { useShop } from "@/context/shop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type WheelOption = {
  value: string;
  label: string;
  /** Nicht auswählbar – wird ausgegraut und übersprungen. */
  disabled?: boolean;
};

const ITEM_HEIGHT = 44;
const VISIBLE = 5;

/**
 * Wheel Picker im iOS-/Android-Stil.
 * Scroll-Snap-basiert, funktioniert mit Touch, Maus und Tastatur.
 *
 * Layout-Regeln gegen seitliches Wandern der Labels:
 * - Zeilen sind Blockelemente mit fester Breite (w-full) und text-center,
 *   niemals scale/transform (Transform verschiebt Subpixel horizontal).
 * - Der Scroll-Container blendet horizontales Overflow aus und versteckt
 *   die Scrollbar, damit die Inhaltsbreite konstant bleibt.
 * - Gewicht/Farbe statt Größe markieren die Auswahl, damit sich die
 *   Textbreite beim Scrollen nicht ändert.
 */
export function WheelPicker({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: WheelOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmatic = useRef(false);
  const { settings } = useShop();
  const soundOn = settings.wheelSoundOn !== false;
  const [activeIndex, setActiveIndex] = useState(0);
  const lastTick = useRef(-1);

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const el = ref.current;
    if (!el || index < 0) return;
    programmatic.current = true;
    const max = el.scrollHeight - el.clientHeight;
    const top = Math.min(index * ITEM_HEIGHT, Math.max(0, max));
    el.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
    setTimeout(() => (programmatic.current = false), smooth ? 350 : 60);
  }, []);

  const index = options.findIndex((o) => o.value === value);

  useEffect(() => {
    if (index >= 0) {
      setActiveIndex(index);
      lastTick.current = index;
      scrollToIndex(index, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, options.length]);

  const handleScroll = () => {
    if (programmatic.current) return;
    const el = ref.current;
    if (el) {
      // Live-Hervorhebung: aktive Zeile schon während des Scrollens markieren.
      const live = Math.max(
        0,
        Math.min(options.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT)),
      );
      setActiveIndex(live);
      if (live !== lastTick.current) {
        lastTick.current = live;
        if (soundOn) {
          playWheelTick();
          hapticTick();
        }
      }
    }
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      // Am unteren Ende immer auf den letzten Eintrag rasten, damit die
      // letzte Option nicht zurückspringt.
      let next =
        max > 0 && el.scrollTop >= max - 2
          ? options.length - 1
          : Math.round(el.scrollTop / ITEM_HEIGHT);
      next = Math.max(0, Math.min(options.length - 1, next));
      if (options[next]?.disabled) {
        const forward = options.findIndex((o, i) => i >= next && !o.disabled);
        const backward = [...options].reduce(
          (acc, o, i) => (i <= next && !o.disabled ? i : acc),
          -1,
        );
        next = forward >= 0 ? forward : backward;
      }
      const option = options[next];
      if (!option) return;
      setActiveIndex(next);
      lastTick.current = next;
      scrollToIndex(next, true);
      if (option.value !== value) onChange(option.value);
    }, 120);
  };

  return (
    <div
      className={cn("relative w-full select-none overflow-hidden", className)}
      style={{ height: ITEM_HEIGHT * VISIBLE }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 rounded-xl border border-primary/60 bg-primary/10"
        style={{ height: ITEM_HEIGHT }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-12 bg-gradient-to-b from-card to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 bg-gradient-to-t from-card to-transparent" />
      <div
        ref={ref}
        role="listbox"
        aria-label={ariaLabel}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
          e.preventDefault();
          const dir = e.key === "ArrowDown" ? 1 : -1;
          for (let i = index + dir; i >= 0 && i < options.length; i += dir) {
            if (!options[i]!.disabled) {
              onChange(options[i]!.value);
              scrollToIndex(i, true);
              return;
            }
          }
        }}
        className="h-full w-full snap-y snap-mandatory overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-none focus:outline-none"
      >
        <div style={{ height: ITEM_HEIGHT * ((VISIBLE - 1) / 2) }} />
        {options.map((option, i) => (
          <div
            key={option.value}
            role="option"
            aria-selected={option.value === value}
            aria-disabled={option.disabled}
            onClick={() => {
              if (option.disabled) return;
              onChange(option.value);
              scrollToIndex(i, true);
            }}
            className={cn(
              "flex w-full snap-center items-center justify-center px-2 text-center text-base leading-none transition-colors duration-150",
              option.disabled
                ? "cursor-not-allowed text-muted-foreground/35"
                : i === activeIndex
                  ? "cursor-pointer font-extrabold tracking-tight text-primary"
                  : "cursor-pointer font-semibold text-muted-foreground/80",
            )}
            style={{ height: ITEM_HEIGHT }}
          >
            <span className="block w-full truncate">{option.label}</span>
          </div>
        ))}
        <div style={{ height: ITEM_HEIGHT * ((VISIBLE - 1) / 2) }} />
      </div>
    </div>
  );
}

/**
 * Kompaktes Auswahlfeld, das den Wheel Picker erst auf Tap in einem Dialog
 * öffnet. Die Auswahl bleibt lokal, bis „Übernehmen“ gedrückt wird –
 * Abbrechen lässt den Ausgangswert unverändert.
 *
 * Wird sowohl für die Abholzeit (Checkout) als auch für den Bestellstatus
 * (Admin) genutzt, damit beide Stellen identisch funktionieren.
 */
export function WheelField({
  options,
  value,
  onChange,
  ariaLabel,
  title,
  placeholder = "Auswählen",
  description,
  confirmLabel = "Übernehmen",
  disabled,
  className,
}: {
  options: WheelOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  title: string;
  placeholder?: string;
  description?: string;
  confirmLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const current = options.find((o) => o.value === value);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        className={cn(
          "flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 text-left text-sm font-semibold transition-colors hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <span className={cn("min-w-0 truncate", !current && "text-muted-foreground")}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          <WheelPicker
            ariaLabel={ariaLabel}
            options={options}
            value={draft}
            onChange={setDraft}
            className="rounded-2xl border border-border bg-card"
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-xl"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 rounded-xl bg-flame font-bold uppercase text-primary-foreground"
              disabled={!draft}
              onClick={() => {
                if (draft && draft !== value) onChange(draft);
                setOpen(false);
              }}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
