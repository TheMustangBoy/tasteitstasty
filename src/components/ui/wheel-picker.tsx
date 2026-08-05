import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

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

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const el = ref.current;
    if (!el || index < 0) return;
    programmatic.current = true;
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: smooth ? "smooth" : "auto" });
    setTimeout(() => (programmatic.current = false), smooth ? 350 : 60);
  }, []);

  const index = options.findIndex((o) => o.value === value);

  useEffect(() => {
    if (index >= 0) scrollToIndex(index, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, options.length]);

  const handleScroll = () => {
    if (programmatic.current) return;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      let next = Math.round(el.scrollTop / ITEM_HEIGHT);
      next = Math.max(0, Math.min(options.length - 1, next));
      // Deaktivierte Einträge überspringen – nächsten freien Eintrag wählen.
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
      scrollToIndex(next, true);
      if (option.value !== value) onChange(option.value);
    }, 120);
  };

  return (
    <div
      className={cn("relative select-none", className)}
      style={{ height: ITEM_HEIGHT * VISIBLE }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 rounded-xl border border-primary/60 bg-primary/10"
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
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-none focus:outline-none"
        style={{ scrollPaddingTop: ITEM_HEIGHT * 2 }}
      >
        <div style={{ height: ITEM_HEIGHT * ((VISIBLE - 1) / 2) }} />
        {options.map((option, i) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === value}
            disabled={option.disabled}
            onClick={() => {
              if (option.disabled) return;
              onChange(option.value);
              scrollToIndex(i, true);
            }}
            className={cn(
              "flex w-full snap-center items-center justify-center text-base font-semibold transition-all",
              option.disabled
                ? "cursor-not-allowed text-muted-foreground/35"
                : option.value === value
                  ? "scale-105 text-foreground"
                  : "text-muted-foreground",
            )}
            style={{ height: ITEM_HEIGHT }}
          >
            {option.label}
          </button>
        ))}
        <div style={{ height: ITEM_HEIGHT * ((VISIBLE - 1) / 2) }} />
      </div>
    </div>
  );
}