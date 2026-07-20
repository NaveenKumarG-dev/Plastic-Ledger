import { ClientOnly } from "@/components/client-only";
import { Loader2 } from "lucide-react";
import { GisMap } from "@/components/gis-map";

function LoadingMap() {
  return (
    <div className="w-full h-[calc(100vh-6rem)] rounded-2xl glass border border-white/10 grid place-items-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-secondary" />
        <span className="text-sm">Loading GIS workspace…</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-[1600px] px-3 lg:px-4 py-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">GIS Command Workspace</h1>
          <p className="text-xs text-muted-foreground">
            Interactive satellite intelligence · Draw regions · Detect, classify and attribute plastic pollution
          </p>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-secondary font-mono">
          Live · Sentinel-2 · Copernicus
        </div>
      </div>
      <ClientOnly fallback={<LoadingMap />}>
        <GisMap />
      </ClientOnly>
    </div>
  );
}
