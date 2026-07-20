import { hotspots } from "@/lib/mock-data";

const levelColor: Record<string, string> = {
  critical: "oklch(0.65 0.24 25)",
  high: "oklch(0.78 0.17 55)",
  medium: "oklch(0.78 0.14 220)",
};

export function WorldMap({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative w-full ${compact ? "aspect-[16/8]" : "aspect-[16/9]"} rounded-2xl overflow-hidden glass`}>
      {/* Grid backdrop */}
      <svg className="absolute inset-0 h-full w-full opacity-30" viewBox="0 0 100 60" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="oklch(0.72 0.15 190 / 0.3)" strokeWidth="0.1" />
          </pattern>
          <radialGradient id="glow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="oklch(0.4 0.15 220 / 0.5)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <rect width="100" height="60" fill="url(#glow)" />
        <rect width="100" height="60" fill="url(#grid)" />
      </svg>

      {/* Continents (stylized silhouettes) */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 60" preserveAspectRatio="none">
        <g fill="oklch(0.35 0.06 220 / 0.55)" stroke="oklch(0.72 0.15 190 / 0.6)" strokeWidth="0.15">
          {/* N America */}
          <path d="M8 15 L22 12 L28 20 L26 30 L18 32 L14 26 L10 22 Z" />
          {/* S America */}
          <path d="M26 34 L32 34 L34 44 L30 52 L26 48 L24 40 Z" />
          {/* Europe */}
          <path d="M44 14 L54 12 L58 18 L52 22 L46 20 Z" />
          {/* Africa */}
          <path d="M46 24 L56 24 L58 34 L52 46 L48 42 L44 32 Z" />
          {/* Asia */}
          <path d="M58 12 L86 14 L88 24 L78 30 L70 26 L60 22 Z" />
          {/* Australia */}
          <path d="M78 42 L88 42 L90 48 L82 50 L76 46 Z" />
        </g>
      </svg>

      {/* Hotspots */}
      {hotspots.map((h) => (
        <div
          key={h.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 group"
          style={{ left: `${h.x}%`, top: `${h.y}%` }}
        >
          <span
            className="absolute inset-0 rounded-full"
            style={{
              width: 12,
              height: 12,
              background: levelColor[h.level],
              animation: "pulse-ring 2.4s ease-out infinite",
            }}
          />
          <span
            className="relative block rounded-full ring-2 ring-white/60"
            style={{ width: 12, height: 12, background: levelColor[h.level] }}
          />
          <div className="pointer-events-none absolute left-4 top-0 min-w-[140px] rounded-md glass px-2 py-1 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
            <div className="font-semibold">{h.name}</div>
            <div className="text-muted-foreground uppercase tracking-wider">{h.level}</div>
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 glass rounded-md px-3 py-2 text-[10px] flex gap-3">
        {(["critical", "high", "medium"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full" style={{ background: levelColor[k] }} /> {k}
          </span>
        ))}
      </div>
      <div className="absolute top-3 right-3 glass rounded-md px-2 py-1 text-[10px] uppercase tracking-widest text-secondary">
        Live · Copernicus S2
      </div>
    </div>
  );
}
