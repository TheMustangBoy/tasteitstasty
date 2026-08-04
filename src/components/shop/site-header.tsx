import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { useCart } from "@/context/cart";

const NAV = [
  { to: "/speisekarte", label: "Speisekarte" },
  { to: "/standort", label: "Standort" },
  { to: "/oeffnungszeiten", label: "Öffnungszeiten" },
] as const;

export function SiteHeader() {
  const { count, setOpen } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link to="/" className="min-w-0">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-5 md:flex">
            {NAV.map((entry) => (
              <Link
                key={entry.to}
                to={entry.to}
                className="text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
                activeProps={{ className: "text-primary" }}
              >
                {entry.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="relative h-11 rounded-full border-primary/40 px-4"
            onClick={() => setOpen(true)}
            aria-label="Warenkorb öffnen"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="ml-2 rounded-full bg-flame px-2 py-0.5 text-xs font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menü"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-border bg-background px-4 py-3 md:hidden">
          {NAV.map((entry) => (
            <Link
              key={entry.to}
              to={entry.to}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-base font-semibold uppercase tracking-wide"
            >
              {entry.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}