import { Link } from "@tanstack/react-router";
import { BUSINESS } from "@/data/menu";
import { LEGAL } from "@/data/legal";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-4 text-sm text-muted-foreground">
            Abholung am
            <br />
            {BUSINESS.place}
            <br />
            {BUSINESS.street}
            <br />
            {BUSINESS.city}
          </p>
        </div>
        <div className="text-sm">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Kontakt</h2>
          <p className="mt-3 flex flex-col gap-1 text-muted-foreground">
            <a href={`tel:${LEGAL.phone}`} className="hover:text-primary">
              {LEGAL.phone}
            </a>
            <a href={`mailto:${LEGAL.email}`} className="break-all hover:text-primary">
              {LEGAL.email}
            </a>
          </p>
        </div>

        <div className="text-sm">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Rechtliches</h2>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>
              <Link to="/impressum" className="hover:text-primary">
                Impressum
              </Link>
            </li>
            <li>
              <Link to="/datenschutz" className="hover:text-primary">
                Datenschutz
              </Link>
            </li>
            <li>
              <Link to="/agb" className="hover:text-primary">
                AGB
              </Link>
            </li>
            <li>
              <Link to="/widerruf" className="hover:text-primary">
                Widerrufsrecht
              </Link>
            </li>
            <li>
              <Link to="/allergene" className="hover:text-primary">
                Allergene
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="border-t border-border/60 px-4 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {LEGAL.brand}. Alle Rechte vorbehalten.
      </p>
    </footer>
  );
}
