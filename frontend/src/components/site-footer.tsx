import { Link } from "@tanstack/react-router";
import { Waves, Github, FileText, Shield, Mail, Twitter, Linkedin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/10 glass">
      <div className="mx-auto max-w-7xl px-6 py-12 grid gap-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary glow">
              <Waves className="h-5 w-5 text-white" />
            </div>
            <div className="font-display font-bold">PlasticLedger AI</div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Autonomous micro-plastic fingerprinting and source attribution for a cleaner ocean.
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Platform</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/dashboard" className="hover:text-white">Dashboard</Link></li>
            <li><Link to="/monitoring" className="hover:text-white">Live Monitoring</Link></li>
            <li><Link to="/analytics" className="hover:text-white">Analytics</Link></li>
            <li><Link to="/reports" className="hover:text-white">Reports</Link></li>
          </ul>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Resources</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#" className="hover:text-white inline-flex items-center gap-2"><Github className="h-4 w-4" /> GitHub</a></li>
            <li><a href="#" className="hover:text-white inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Documentation</a></li>
            <li><a href="#" className="hover:text-white inline-flex items-center gap-2"><Shield className="h-4 w-4" /> Privacy Policy</a></li>
            <li><Link to="/contact" className="hover:text-white inline-flex items-center gap-2"><Mail className="h-4 w-4" /> Contact</Link></li>
          </ul>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">Connect</div>
          <div className="flex gap-3">
            {[Github, Twitter, Linkedin, Mail].map((Icon, i) => (
              <a key={i} href="#" className="grid h-9 w-9 place-items-center rounded-lg glass hover:bg-white/10 transition">
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Aligned with UN SDG 6, 12, 13 & 14.</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-muted-foreground">
        © 2026 PlasticLedger AI · Detect. Identify. Trace. Protect.
      </div>
    </footer>
  );
}
