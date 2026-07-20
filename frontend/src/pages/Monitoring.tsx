import { WorldMap } from "@/components/world-map";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Radio, Satellite, Waves } from "lucide-react";
import { hotspots } from "@/lib/mock-data";

export default function Monitoring() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between mb-6">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-secondary">Live monitoring</div>
          <h1 className="text-3xl sm:text-4xl font-bold">Ocean intelligence, right now</h1>
          <p className="text-sm text-muted-foreground mt-1">Streaming from 312 sensors and 6 satellite constellations.</p>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-400 border-0 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
          STREAMING
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <WorldMap />

        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <Satellite className="h-4 w-4 text-secondary" />
              <h3 className="font-semibold">Uplink</h3>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[["Sentinel-2", "OK"], ["Landsat-9", "OK"], ["MODIS", "OK"]].map(([n, s]) => (
                <div key={n} className="glass rounded-lg p-2">
                  <div className="text-xs font-semibold">{n}</div>
                  <div className="text-[10px] text-emerald-400">{s}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-secondary" />
              <h3 className="font-semibold">Recent detections</h3>
            </div>
            <ul className="mt-3 space-y-3 max-h-80 overflow-auto pr-1">
              {hotspots.map((h) => (
                <li key={h.id} className="flex items-start gap-3 border-b border-white/5 pb-3 last:border-0">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${h.level === "critical" ? "text-red-500" : h.level === "high" ? "text-amber-500" : "text-yellow-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{h.name}</div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{h.level}</div>
                  </div>
                  <Waves className="h-4 w-4 text-muted-foreground" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
