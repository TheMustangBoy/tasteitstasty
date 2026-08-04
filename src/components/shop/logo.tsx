export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex flex-col leading-none">
      <span className="font-display text-lg tracking-tight sm:text-xl">
        <span className="text-flame-gradient">Taste It&rsquo;s Tasty</span>
      </span>
      {!compact && (
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Food Truck · Burgers
        </span>
      )}
    </span>
  );
}