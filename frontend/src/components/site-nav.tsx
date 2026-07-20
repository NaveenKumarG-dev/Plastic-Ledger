import { Link, useRouterState } from "@tanstack/react-router";
import { Waves, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/monitoring", label: "Live Monitoring" },
  { to: "/analytics", label: "Analytics" },
  { to: "/reports", label: "Reports" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary glow">
            <Waves className="h-5 w-5 text-white" />
            <span className="absolute inset-0 rounded-xl border border-white/30" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-sm font-bold tracking-tight">PlasticLedger</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-secondary">AI · Ocean Intel</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {links.map((l) => {
            const active = path === l.to || (l.to !== "/" && path.startsWith(l.to));
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`relative px-3 py-2 text-sm rounded-md transition-colors ${
                  active ? "text-white" : "text-muted-foreground hover:text-white"
                }`}
              >
                {l.label}
                {active && <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-gradient-primary" />}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <Button asChild size="sm" className="bg-gradient-primary hover:opacity-90 text-white border-0">
            <Link to="/dashboard">Launch Dashboard</Link>
          </Button>
        </div>

        <button className="lg:hidden text-white p-2" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-white/10 px-4 py-3 space-y-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-white hover:bg-white/5"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
