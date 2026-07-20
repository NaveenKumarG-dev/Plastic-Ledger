import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, LayersControl, Rectangle, Polygon, Marker, Popup, Circle, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import { motion, AnimatePresence } from "framer-motion";
import {
  MousePointer2, Square, Hexagon, MapPin, Ruler, Compass, RotateCcw,
  Sparkles, Loader2, X, Waves, Factory, Wind, Radar, AlertTriangle, Activity, Layers, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Fix default marker icons for Leaflet in bundlers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Tool = "select" | "rectangle" | "polygon" | "marker" | "distance" | "area" | "reset";

type LatLng = { lat: number; lng: number };

type Cluster = {
  id: number;
  lat: number;
  lng: number;
  density: "high" | "medium" | "low" | "clean";
  polymer: "PET" | "HDPE" | "PP" | "PVC" | "PS";
  confidence: number;
  areaM2: number;
  ageDays: number;
  quantityKg: number;
  risk: "High" | "Medium" | "Low";
  sourceFactory: string;
};

const densityColor: Record<Cluster["density"], string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#eab308",
  clean: "#22c55e",
};

const factories = [
  { id: 1, name: "Textile Mill A", lat: 13.08, lng: 80.28 },
  { id: 2, name: "Polymer Plant B", lat: 12.98, lng: 80.35 },
  { id: 3, name: "Packaging Co C", lat: 13.15, lng: 80.22 },
];

// ----- Map click / draw handler -----
function DrawHandler({
  tool, onRectComplete, onPolygonComplete, onMarker, onMeasureDistance, onMeasureArea, onMouseMove, onZoom,
}: {
  tool: Tool;
  onRectComplete: (b: [LatLng, LatLng]) => void;
  onPolygonComplete: (pts: LatLng[]) => void;
  onMarker: (p: LatLng) => void;
  onMeasureDistance: (pts: LatLng[]) => void;
  onMeasureArea: (pts: LatLng[]) => void;
  onMouseMove: (p: LatLng) => void;
  onZoom: (z: number) => void;
}) {
  const [rectStart, setRectStart] = useState<LatLng | null>(null);
  const [polyPts, setPolyPts] = useState<LatLng[]>([]);
  const [measurePts, setMeasurePts] = useState<LatLng[]>([]);

  useMapEvents({
    mousemove(e) {
      onMouseMove({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    zoomend(e) {
      onZoom(e.target.getZoom());
    },
    click(e) {
      const p = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (tool === "rectangle") {
        if (!rectStart) setRectStart(p);
        else {
          onRectComplete([rectStart, p]);
          setRectStart(null);
        }
      } else if (tool === "polygon") {
        setPolyPts((prev) => [...prev, p]);
      } else if (tool === "marker") {
        onMarker(p);
      } else if (tool === "distance" || tool === "area") {
        setMeasurePts((prev) => [...prev, p]);
      }
    },
    dblclick() {
      if (tool === "polygon" && polyPts.length >= 3) {
        onPolygonComplete(polyPts);
        setPolyPts([]);
      } else if (tool === "distance" && measurePts.length >= 2) {
        onMeasureDistance(measurePts);
        setMeasurePts([]);
      } else if (tool === "area" && measurePts.length >= 3) {
        onMeasureArea(measurePts);
        setMeasurePts([]);
      }
    },
  });

  useEffect(() => {
    setRectStart(null);
    setPolyPts([]);
    setMeasurePts([]);
  }, [tool]);

  return (
    <>
      {polyPts.length > 0 && (
        <Polyline positions={polyPts.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#38bdf8", dashArray: "6 4" }} />
      )}
      {measurePts.length > 0 && (
        <Polyline positions={measurePts.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#f59e0b", dashArray: "6 4" }} />
      )}
    </>
  );
}

// ----- Fly-to helper -----
function MapController({ flyTo }: { flyTo?: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (flyTo) map.flyTo(flyTo, 11, { duration: 1.2 });
  }, [flyTo, map]);
  return null;
}

// ----- Timeline animation for cluster drift -----
function driftCluster(c: Cluster, days: number): Cluster {
  // simulate current drift: SE at ~0.03 deg/day
  return { ...c, lat: c.lat - days * 0.003, lng: c.lng + days * 0.004 };
}

export function GisMap() {
  const [tool, setTool] = useState<Tool>("select");
  const [region, setRegion] = useState<{ type: "rect" | "poly"; points: LatLng[] } | null>(null);
  const [markers, setMarkers] = useState<LatLng[]>([]);
  const [measure, setMeasure] = useState<{ kind: "distance" | "area"; value: number; pts: LatLng[] } | null>(null);
  const [mouse, setMouse] = useState<LatLng>({ lat: 13.05, lng: 80.28 });
  const [zoom, setZoom] = useState(10);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [timeline, setTimeline] = useState(0);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const clusterIdRef = useRef(1);

  const analysisSteps = [
    "Downloading Satellite Tile...",
    "Processing Image...",
    "Running Plastic Detection...",
    "Classifying Polymer...",
    "Running Source Attribution...",
    "Generating Report...",
  ];

  // ----- region calculations -----
  const regionStats = useMemo(() => {
    if (!region) return null;
    let poly;
    if (region.type === "rect") {
      const [a, b] = region.points;
      const minLat = Math.min(a.lat, b.lat), maxLat = Math.max(a.lat, b.lat);
      const minLng = Math.min(a.lng, b.lng), maxLng = Math.max(a.lng, b.lng);
      poly = turf.polygon([[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]]);
    } else {
      const coords = region.points.map((p) => [p.lng, p.lat]);
      coords.push(coords[0]);
      poly = turf.polygon([coords]);
    }
    const area = turf.area(poly) / 1e6; // km²
    const bbox = turf.bbox(poly); // [minX, minY, maxX, maxY]
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const width = turf.distance([minLng, (minLat + maxLat) / 2], [maxLng, (minLat + maxLat) / 2], { units: "kilometers" });
    const height = turf.distance([(minLng + maxLng) / 2, minLat], [(minLng + maxLng) / 2, maxLat], { units: "kilometers" });
    const perimeter = turf.length(turf.polygonToLine(poly), { units: "kilometers" });
    const center = turf.centroid(poly).geometry.coordinates;
    return {
      area, width, height, perimeter,
      center: { lat: center[1], lng: center[0] },
      bbox: { north: maxLat, south: minLat, east: maxLng, west: minLng },
      corners: [
        { lat: maxLat, lng: minLng }, { lat: maxLat, lng: maxLng },
        { lat: minLat, lng: maxLng }, { lat: minLat, lng: minLng },
      ],
    };
  }, [region]);

  const runAnalysis = async () => {
    if (!regionStats) return;
    setAnalysisComplete(false);
    setClusters([]);
    for (const step of analysisSteps) {
      setAnalyzing(step);
      await new Promise((r) => setTimeout(r, 700));
    }
    setAnalyzing(null);

    // Generate mock clusters inside the region
    const n = Math.max(6, Math.min(24, Math.round(regionStats.area * 3)));
    const polymers: Cluster["polymer"][] = ["PET", "HDPE", "PP", "PVC", "PS"];
    const densities: Cluster["density"][] = ["high", "high", "medium", "medium", "low", "clean"];
    const risks: Cluster["risk"][] = ["High", "Medium", "Low"];
    const generated: Cluster[] = Array.from({ length: n }, () => {
      const lat = regionStats.bbox.south + Math.random() * (regionStats.bbox.north - regionStats.bbox.south);
      const lng = regionStats.bbox.west + Math.random() * (regionStats.bbox.east - regionStats.bbox.west);
      const density = densities[Math.floor(Math.random() * densities.length)];
      return {
        id: clusterIdRef.current++,
        lat, lng, density,
        polymer: polymers[Math.floor(Math.random() * polymers.length)],
        confidence: Math.floor(80 + Math.random() * 19),
        areaM2: Math.floor(80 + Math.random() * 900),
        ageDays: Math.floor(20 + Math.random() * 300),
        quantityKg: Math.floor(30 + Math.random() * 900),
        risk: density === "high" ? "High" : density === "medium" ? "Medium" : risks[Math.floor(Math.random() * 3)],
        sourceFactory: factories[Math.floor(Math.random() * factories.length)].name,
      };
    });
    setClusters(generated);
    setAnalysisComplete(true);
  };

  const reset = () => {
    setRegion(null); setMarkers([]); setMeasure(null); setClusters([]); setSelectedCluster(null); setAnalysisComplete(false); setTool("select");
  };

  const driftedClusters = clusters.map((c) => driftCluster(c, timeline));

  // AI summary
  const summary = useMemo(() => {
    if (!clusters.length) return null;
    const polymerCounts: Record<string, number> = {};
    clusters.forEach((c) => (polymerCounts[c.polymer] = (polymerCounts[c.polymer] || 0) + 1));
    const dominant = Object.entries(polymerCounts).sort((a, b) => b[1] - a[1])[0][0];
    const totalKg = clusters.reduce((s, c) => s + c.quantityKg, 0);
    const highCount = clusters.filter((c) => c.risk === "High").length;
    const risk = Math.min(99, Math.round((highCount / clusters.length) * 100 + 40));
    return {
      clusters: clusters.length,
      dominant,
      tons: (totalKg / 1000).toFixed(2),
      likelySource: factories[0].name,
      priority: risk > 70 ? "HIGH" : risk > 40 ? "MEDIUM" : "LOW",
      risk,
    };
  }, [clusters]);

  // Attribution path for selected cluster
  const attributionPath = useMemo(() => {
    if (!selectedCluster) return null;
    const factory = factories.find((f) => f.name === selectedCluster.sourceFactory) ?? factories[0];
    const river = { lat: (factory.lat + selectedCluster.lat) / 2 + 0.02, lng: (factory.lng + selectedCluster.lng) / 2 - 0.03 };
    const current = { lat: (river.lat + selectedCluster.lat) / 2, lng: (river.lng + selectedCluster.lng) / 2 + 0.02 };
    const distFactoryCluster = turf.distance([factory.lng, factory.lat], [selectedCluster.lng, selectedCluster.lat], { units: "kilometers" });
    return {
      points: [factory, river, current, { lat: selectedCluster.lat, lng: selectedCluster.lng }],
      factory, river, current,
      distance: distFactoryCluster,
      travelDays: Math.round(distFactoryCluster / 1.8),
    };
  }, [selectedCluster]);

  const tools: { id: Tool; icon: typeof MousePointer2; label: string }[] = [
    { id: "select", icon: MousePointer2, label: "Select" },
    { id: "rectangle", icon: Square, label: "Rectangle" },
    { id: "polygon", icon: Hexagon, label: "Polygon" },
    { id: "marker", icon: MapPin, label: "Marker" },
    { id: "distance", icon: Ruler, label: "Distance" },
    { id: "area", icon: Compass, label: "Area" },
    { id: "reset", icon: RotateCcw, label: "Reset" },
  ];

  return (
    <div className="relative w-full h-[calc(100vh-6rem)] rounded-2xl overflow-hidden glass border border-white/10">
      <MapContainer
        center={[13.05, 80.28]}
        zoom={10}
        className="w-full h-full"
        zoomControl={false}
        doubleClickZoom={false}
      >
        <MapController />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Esri" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Terrain">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}" attribution="Esri" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Ocean">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}" attribution="Esri" />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay name="Labels">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
          </LayersControl.Overlay>
          <LayersControl.Overlay checked name="Heatmap">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}" opacity={0.4} />
          </LayersControl.Overlay>
        </LayersControl>

        <DrawHandler
          tool={tool}
          onRectComplete={(b) => { setRegion({ type: "rect", points: b }); setTool("select"); }}
          onPolygonComplete={(pts) => { setRegion({ type: "poly", points: pts }); setTool("select"); }}
          onMarker={(p) => setMarkers((m) => [...m, p])}
          onMeasureDistance={(pts) => {
            const line = turf.lineString(pts.map((p) => [p.lng, p.lat]));
            setMeasure({ kind: "distance", value: turf.length(line, { units: "kilometers" }), pts });
            setTool("select");
          }}
          onMeasureArea={(pts) => {
            const coords = pts.map((p) => [p.lng, p.lat]); coords.push(coords[0]);
            const poly = turf.polygon([coords]);
            setMeasure({ kind: "area", value: turf.area(poly) / 1e6, pts });
            setTool("select");
          }}
          onMouseMove={setMouse}
          onZoom={setZoom}
        />

        {/* Selected region */}
        {region?.type === "rect" && (
          <Rectangle
            bounds={[[region.points[0].lat, region.points[0].lng], [region.points[1].lat, region.points[1].lng]]}
            pathOptions={{ color: "#38bdf8", weight: 2, fillOpacity: 0.08 }}
          />
        )}
        {region?.type === "poly" && (
          <Polygon positions={region.points.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#38bdf8", weight: 2, fillOpacity: 0.08 }} />
        )}

        {/* Markers */}
        {markers.map((m, i) => (<Marker key={i} position={[m.lat, m.lng]} />))}

        {/* Measurement */}
        {measure && (
          <Polyline positions={measure.pts.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#f59e0b", weight: 3 }} />
        )}

        {/* Factories */}
        {factories.map((f) => (
          <Marker key={f.id} position={[f.lat, f.lng]} icon={L.divIcon({
            className: "",
            html: `<div style="width:22px;height:22px;border-radius:6px;background:#7c3aed;border:2px solid white;display:grid;place-items:center;color:white;font-size:12px">🏭</div>`,
            iconSize: [22, 22], iconAnchor: [11, 11],
          })}>
            <Popup>{f.name}</Popup>
          </Marker>
        ))}

        {/* Cluster hotspots */}
        {driftedClusters.map((c) => (
          <Circle
            key={c.id}
            center={[c.lat, c.lng]}
            radius={Math.sqrt(c.areaM2) * 6}
            pathOptions={{
              color: densityColor[c.density], fillColor: densityColor[c.density],
              fillOpacity: 0.55, weight: 1.5,
            }}
            eventHandlers={{ click: () => setSelectedCluster(c) }}
          />
        ))}

        {/* Attribution path */}
        {attributionPath && (
          <>
            <Polyline
              positions={attributionPath.points.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color: "#38bdf8", weight: 3, dashArray: "8 6" }}
            />
            {attributionPath.points.map((p: {lat:number;lng:number}, i: number) => (
              <Circle key={i} center={[p.lat, p.lng]} radius={200} pathOptions={{ color: "#38bdf8", fillOpacity: 0.9 }} />
            ))}
          </>
        )}
      </MapContainer>

      {/* GIS Toolbar (left) */}
      <div className="absolute top-4 left-4 z-[500] flex flex-col gap-1 p-1.5 glass rounded-xl border border-white/10 backdrop-blur">
        {tools.map((t) => {
          const active = tool === t.id && t.id !== "reset";
          return (
            <button
              key={t.id}
              title={t.label}
              onClick={() => (t.id === "reset" ? reset() : setTool(t.id))}
              className={`h-10 w-10 grid place-items-center rounded-lg transition ${
                active ? "bg-gradient-primary text-white shadow-lg" : "text-muted-foreground hover:bg-white/10 hover:text-white"
              }`}
            >
              <t.icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      {/* Tool hint */}
      {tool !== "select" && (
        <div className="absolute top-4 left-20 z-[500] glass rounded-lg px-3 py-2 text-xs border border-white/10">
          {tool === "rectangle" && "Click two corners to draw a rectangle"}
          {tool === "polygon" && "Click to add vertices · double-click to finish"}
          {tool === "marker" && "Click to drop a marker"}
          {tool === "distance" && "Click points · double-click to measure"}
          {tool === "area" && "Click 3+ points · double-click to measure area"}
        </div>
      )}

      {/* Mini stats (top-right) */}
      <div className="absolute top-4 right-16 z-[500] hidden md:grid grid-cols-2 gap-2 max-w-[260px]">
        {[
          { k: "Plastic Clusters", v: clusters.length || "—", tone: "text-primary" },
          { k: "Detection Accuracy", v: clusters.length ? "96%" : "—", tone: "text-secondary" },
          { k: "Processing Time", v: analysisComplete ? "3.2 s" : "—", tone: "text-white" },
          { k: "High Risk", v: clusters.filter((c) => c.risk === "High").length || "—", tone: "text-danger" },
        ].map((s) => (
          <div key={s.k} className="glass rounded-lg px-3 py-2 border border-white/10 min-w-[120px]">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{s.k}</div>
            <div className={`text-lg font-bold ${s.tone}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Region info card (bottom-left) */}
      <AnimatePresence>
        {regionStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-24 left-4 z-[500] glass rounded-xl border border-white/10 p-4 w-[300px] backdrop-blur"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-widest text-secondary flex items-center gap-2">
                <Layers className="h-3 w-3" /> Selected Region
              </div>
              <button onClick={() => setRegion(null)} className="text-muted-foreground hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat k="Area" v={`${regionStats.area.toFixed(2)} km²`} />
              <Stat k="Perimeter" v={`${regionStats.perimeter.toFixed(2)} km`} />
              <Stat k="Width" v={`${regionStats.width.toFixed(2)} km`} />
              <Stat k="Height" v={`${regionStats.height.toFixed(2)} km`} />
            </div>
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Center</div>
              <div className="font-mono text-xs">{regionStats.center.lat.toFixed(4)}, {regionStats.center.lng.toFixed(4)}</div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-[10px]">
              <div><span className="text-muted-foreground">N </span><span className="font-mono">{regionStats.bbox.north.toFixed(3)}</span></div>
              <div><span className="text-muted-foreground">S </span><span className="font-mono">{regionStats.bbox.south.toFixed(3)}</span></div>
              <div><span className="text-muted-foreground">E </span><span className="font-mono">{regionStats.bbox.east.toFixed(3)}</span></div>
              <div><span className="text-muted-foreground">W </span><span className="font-mono">{regionStats.bbox.west.toFixed(3)}</span></div>
            </div>
            <Button
              onClick={runAnalysis}
              disabled={!!analyzing}
              className="mt-4 w-full bg-gradient-primary text-white border-0 hover:opacity-90"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              Analyze Selected Region
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Measurement result */}
      {measure && (
        <div className="absolute bottom-24 left-[330px] z-[500] glass rounded-lg px-3 py-2 border border-white/10 text-xs">
          <div className="text-[9px] uppercase tracking-widest text-secondary">{measure.kind}</div>
          <div className="font-mono font-semibold">
            {measure.kind === "distance" ? `${measure.value.toFixed(2)} km` : `${measure.value.toFixed(2)} km²`}
          </div>
        </div>
      )}

      {/* AI summary panel (right) */}
      <AnimatePresence>
        {summary && (
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="absolute top-40 right-4 z-[500] glass rounded-xl border border-white/10 p-4 w-[260px] backdrop-blur"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-secondary mb-3">
              <Sparkles className="h-3.5 w-3.5" /> AI Summary
            </div>
            <div className="space-y-2 text-xs">
              <Row k="Clusters" v={summary.clusters} />
              <Row k="Dominant Polymer" v={summary.dominant} />
              <Row k="Estimated Waste" v={`${summary.tons} tons`} />
              <Row k="Likely Source" v={summary.likelySource} />
              <Row k="Cleanup Priority" v={<Badge className={`border-0 text-[10px] ${summary.priority === "HIGH" ? "bg-danger/30 text-danger" : summary.priority === "MEDIUM" ? "bg-warning/30 text-warning" : "bg-success/30 text-success"}`}>{summary.priority}</Badge>} />
            </div>
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>Environmental Risk</span><span className="text-danger font-bold">{summary.risk}%</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-warning to-danger" style={{ width: `${summary.risk}%` }} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cluster info panel */}
      <AnimatePresence>
        {selectedCluster && (
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="absolute top-40 left-20 z-[500] glass rounded-xl border border-white/10 p-4 w-[280px] backdrop-blur"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 grid place-items-center rounded-lg" style={{ background: densityColor[selectedCluster.density] }}>
                  <Radar className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Cluster</div>
                  <div className="font-semibold">#{selectedCluster.id}</div>
                </div>
              </div>
              <button onClick={() => setSelectedCluster(null)} className="text-muted-foreground hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat k="Latitude" v={selectedCluster.lat.toFixed(4)} mono />
              <Stat k="Longitude" v={selectedCluster.lng.toFixed(4)} mono />
              <Stat k="Polymer" v={selectedCluster.polymer} />
              <Stat k="Confidence" v={`${selectedCluster.confidence}%`} />
              <Stat k="Est. Area" v={`${selectedCluster.areaM2} m²`} />
              <Stat k="Est. Age" v={`${selectedCluster.ageDays} d`} />
              <Stat k="Quantity" v={`${selectedCluster.quantityKg} kg`} />
              <Stat k="Risk" v={<Badge className={`border-0 text-[10px] ${selectedCluster.risk === "High" ? "bg-danger/30 text-danger" : selectedCluster.risk === "Medium" ? "bg-warning/30 text-warning" : "bg-success/30 text-success"}`}>{selectedCluster.risk}</Badge>} />
            </div>
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Likely Source</div>
              <div className="text-sm font-medium flex items-center gap-1.5"><Factory className="h-3.5 w-3.5 text-secondary" /> {selectedCluster.sourceFactory}</div>
            </div>
            {attributionPath && (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5 text-[11px]">
                <div className="text-[10px] uppercase tracking-widest text-secondary mb-1">Source Path</div>
                {[
                  { icon: Factory, label: "Factory" },
                  { icon: Waves, label: "River" },
                  { icon: Wind, label: "Ocean Current" },
                  { icon: Radar, label: "Cluster" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <s.icon className="h-3 w-3 text-secondary" />
                    <span>{s.label}</span>
                    {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />}
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-white/10 grid grid-cols-2 gap-2">
                  <Stat k="Distance" v={`${attributionPath.distance.toFixed(1)} km`} />
                  <Stat k="Travel Time" v={`${attributionPath.travelDays} d`} />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis overlay */}
      <AnimatePresence>
        {analyzing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[600] bg-background/70 backdrop-blur-sm grid place-items-center"
          >
            <div className="glass rounded-2xl border border-white/10 p-8 max-w-md w-[92%]">
              <div className="flex items-center gap-3 mb-6">
                <Loader2 className="h-6 w-6 animate-spin text-secondary" />
                <div>
                  <div className="text-xs uppercase tracking-widest text-secondary">AI Pipeline</div>
                  <div className="font-semibold">Analyzing Region</div>
                </div>
              </div>
              <ul className="space-y-2">
                {analysisSteps.map((s) => {
                  const idx = analysisSteps.indexOf(s);
                  const currentIdx = analysisSteps.indexOf(analyzing);
                  const done = idx < currentIdx;
                  const active = idx === currentIdx;
                  return (
                    <li key={s} className={`flex items-center gap-2 text-sm ${done ? "text-success" : active ? "text-white" : "text-muted-foreground"}`}>
                      <div className={`h-2 w-2 rounded-full ${done ? "bg-success" : active ? "bg-secondary animate-pulse" : "bg-white/20"}`} />
                      {s}
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live coordinate panel (bottom-left tiny) */}
      <div className="absolute bottom-4 left-4 z-[500] glass rounded-lg px-3 py-2 border border-white/10 text-[11px] font-mono flex gap-4">
        <div><span className="text-muted-foreground">LAT </span>{mouse.lat.toFixed(4)}</div>
        <div><span className="text-muted-foreground">LNG </span>{mouse.lng.toFixed(4)}</div>
        <div><span className="text-muted-foreground">ZOOM </span>{zoom}</div>
        <div className="hidden sm:block"><span className="text-muted-foreground">SCALE </span>1:{Math.round(150000000 / Math.pow(2, zoom)).toLocaleString()}</div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-16 right-4 z-[500] glass rounded-lg px-3 py-2 border border-white/10 text-[10px] space-y-1">
        <div className="uppercase tracking-widest text-secondary mb-1">Density</div>
        {(["high", "medium", "low", "clean"] as const).map((d) => (
          <div key={d} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: densityColor[d] }} />
            <span className="capitalize">{d}</span>
          </div>
        ))}
      </div>

      {/* Timeline (bottom center) */}
      {clusters.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] glass rounded-xl border border-white/10 p-3 w-[420px] max-w-[90vw]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs">
              <Activity className="h-3.5 w-3.5 text-secondary" />
              <span className="uppercase tracking-widest text-secondary">Drift Timeline</span>
            </div>
            <span className="text-xs font-mono">+{timeline} days</span>
          </div>
          <input
            type="range" min={0} max={60} value={timeline}
            onChange={(e) => setTimeline(Number(e.target.value))}
            className="w-full accent-[oklch(0.72_0.15_190)]"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            {[0, 7, 14, 30, 60].map((d) => (
              <button key={d} onClick={() => setTimeline(d)} className={`hover:text-white ${timeline === d ? "text-white font-semibold" : ""}`}>
                {d === 0 ? "Today" : `${d}d`}
              </button>
            ))}
          </div>
        </div>
      )}

      {clusters.some((c) => c.risk === "High") && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] glass rounded-lg px-3 py-1.5 border border-danger/40 bg-danger/10 text-xs flex items-center gap-2 animate-pulse">
          <AlertTriangle className="h-3.5 w-3.5 text-danger" />
          <span>{clusters.filter((c) => c.risk === "High").length} high-risk clusters detected</span>
        </div>
      )}
    </div>
  );
}

function Stat({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="glass rounded-md px-2 py-1.5 border border-white/5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div>
      <div className={`text-xs font-semibold ${mono ? "font-mono" : ""}`}>{v}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
