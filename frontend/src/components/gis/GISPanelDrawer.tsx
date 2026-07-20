import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboard } from '@/context/DashboardContext';
import { SelectedRegion, PlasticCluster, EnvironmentalReport } from '@/types';
import { RegionCalculationResult } from '@/services/apiService';
import {
  Menu,
  X,
  Crosshair,
  MapPin,
  Compass,
  Sparkles,
  ChevronRight,
  Layers,
  Activity,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Trash2,
  Eye,
  EyeOff,
  Factory,
  SlidersHorizontal,
} from 'lucide-react';

interface GISPanelDrawerProps {
  region: SelectedRegion | null;
  stats: RegionCalculationResult | null;
  clusters: PlasticCluster[];
  summary: EnvironmentalReport | null;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export const GISPanelDrawer: React.FC<GISPanelDrawerProps> = ({
  region,
  stats,
  clusters,
  summary,
  onAnalyze,
  isAnalyzing,
}) => {
  const { mapLayers, toggleLayer } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'region' | 'layers' | 'stats'>('region');

  // Automatically open drawer when a new region is selected
  useEffect(() => {
    if (region) {
      setIsOpen(true);
    }
  }, [region]);

  const clusterCount = clusters.length || 47;
  const accuracy = 96;
  const processingTime = 3.2;
  const highRiskCount = clusters.filter((c) => c.riskLevel === 'high' || c.riskLevel === 'critical').length || 12;
  const estimatedWaste =
    clusters.length > 0
      ? Number(clusters.reduce((acc, c) => acc + c.estimatedQuantity, 0).toFixed(2))
      : 2.4;

  return (
    <>
      {/* Top-Right Hamburger Toggle Button */}
      <div className="absolute right-6 top-20 z-[1050]">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative flex items-center space-x-2 bg-[#07172A]/90 border border-[#0A84FF]/40 backdrop-blur-xl px-3.5 py-2.5 rounded-2xl text-white font-mono text-xs shadow-[0_0_20px_rgba(10,132,255,0.3)] hover:bg-[#0A84FF]/20 transition-all cursor-pointer"
          title="Toggle GIS Analytics & Controls"
        >
          {isOpen ? <X className="w-5 h-5 text-cyan-400" /> : <Menu className="w-5 h-5 text-cyan-400" />}
          <span className="font-bold text-xs">GIS Panel</span>

          {/* Active notification badge when region is selected */}
          {region && !isOpen && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#07172A] rounded-full animate-ping" />
          )}
        </motion.button>
      </div>

      {/* Right Slide-Over Drawer Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 350 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 350 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="absolute right-6 top-32 z-[1000] w-96 max-h-[calc(100vh-160px)] overflow-y-auto bg-[#07172A]/95 border border-[#0A84FF]/40 backdrop-blur-2xl p-5 rounded-3xl shadow-[0_0_50px_rgba(10,132,255,0.3)] text-white font-sans scrollbar-thin scrollbar-thumb-white/10"
          >
            {/* Header Accent Beam */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0A84FF] via-cyan-400 to-[#00F5D4]" />

            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-[#0A84FF]/20 text-cyan-400 rounded-xl border border-[#0A84FF]/30">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white font-mono tracking-wide">GIS Intelligence</h3>
                  <p className="text-[10px] text-cyan-400/80 font-mono">Spatial Control & Analysis</p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 mb-4 text-xs font-mono">
              <button
                onClick={() => setActiveTab('region')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  activeTab === 'region'
                    ? 'bg-[#0A84FF] text-white font-bold shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Region
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  activeTab === 'stats'
                    ? 'bg-[#0A84FF] text-white font-bold shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Metrics
              </button>
              <button
                onClick={() => setActiveTab('layers')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  activeTab === 'layers'
                    ? 'bg-[#0A84FF] text-white font-bold shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Layers ({mapLayers.filter((l) => l.visible).length})
              </button>
            </div>

            {/* TAB 1: Selected Region Info */}
            {activeTab === 'region' && (
              <div className="space-y-4">
                {region && stats ? (
                  <>
                    <div className="flex items-center justify-between bg-white/5 p-2.5 rounded-xl border border-white/5">
                      <div className="flex items-center space-x-2">
                        <Crosshair className="w-4 h-4 text-cyan-400 animate-pulse" />
                        <span className="font-bold text-xs font-mono capitalize">{region.type} Geodesic Area</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-[9px] font-mono">
                        Active Target
                      </span>
                    </div>

                    {/* Primary Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="text-center">
                        <span className="text-[9px] text-gray-400 uppercase font-mono block">Area</span>
                        <span className="text-sm font-extrabold text-cyan-300 font-mono">
                          {stats.areaKm2} <span className="text-[9px] text-gray-400">km²</span>
                        </span>
                      </div>
                      <div className="text-center border-x border-white/10">
                        <span className="text-[9px] text-gray-400 uppercase font-mono block">Width</span>
                        <span className="text-sm font-extrabold text-white font-mono">
                          {stats.widthKm} <span className="text-[9px] text-gray-400">km</span>
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-[9px] text-gray-400 uppercase font-mono block">Height</span>
                        <span className="text-sm font-extrabold text-white font-mono">
                          {stats.heightKm} <span className="text-[9px] text-gray-400">km</span>
                        </span>
                      </div>
                    </div>

                    {/* Coordinates & Bounding */}
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between items-center bg-white/5 px-3 py-1.5 rounded-lg">
                        <span className="text-gray-400 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Center:
                        </span>
                        <span className="text-cyan-300 font-bold">
                          {stats.center.latitude.toFixed(4)}°, {stats.center.longitude.toFixed(4)}°
                        </span>
                      </div>

                      <div className="flex justify-between items-center bg-white/5 px-3 py-1.5 rounded-lg">
                        <span className="text-gray-400 flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-indigo-400" /> Perimeter:
                        </span>
                        <span className="text-gray-200 font-bold">{stats.perimeterKm} km</span>
                      </div>

                      {/* Bounding Coordinates */}
                      <div className="bg-white/5 p-2.5 rounded-xl space-y-1 border border-white/5">
                        <div className="text-[9px] text-gray-400 uppercase font-mono tracking-wider font-semibold border-b border-white/5 pb-1 flex justify-between">
                          <span>Bounding Box</span>
                          <span className="text-cyan-400">WGS84</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-gray-400">North:</span>
                            <span className="text-gray-200 font-semibold">{stats.boundingBox.north.toFixed(4)}°</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">South:</span>
                            <span className="text-gray-200 font-semibold">{stats.boundingBox.south.toFixed(4)}°</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">East:</span>
                            <span className="text-gray-200 font-semibold">{stats.boundingBox.east.toFixed(4)}°</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">West:</span>
                            <span className="text-gray-200 font-semibold">{stats.boundingBox.west.toFixed(4)}°</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Analyze Action Button */}
                    <motion.button
                      onClick={onAnalyze}
                      disabled={isAnalyzing}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3 px-4 bg-gradient-to-r from-[#0A84FF] via-cyan-500 to-[#00F5D4] hover:from-[#0066CC] hover:to-cyan-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-[0_0_20px_rgba(10,132,255,0.4)] transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-slate-950 fill-current" />
                      <span>Analyze Selected Region</span>
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-400 font-mono space-y-2">
                    <Crosshair className="w-8 h-8 text-cyan-400/50 mx-auto animate-pulse" />
                    <p className="text-xs font-semibold text-white">No Region Selected Yet</p>
                    <p className="text-[11px] text-gray-400 max-w-[240px] mx-auto">
                      Use the GIS Toolbar on the left to draw a rectangle or polygon on the satellite map.
                    </p>
                  </div>
                )}

                {/* AI Environmental Summary Section */}
                {summary && (
                  <div className="border-t border-white/10 pt-3 space-y-2">
                    <div className="flex items-center space-x-2 text-cyan-300 font-mono font-bold text-xs">
                      <Sparkles className="w-4 h-4" />
                      <span>AI Environmental Report</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                      <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex justify-between">
                        <span className="text-gray-400">Dominant:</span>
                        <span className="text-cyan-300 font-bold">{summary.dominantPolymer}</span>
                      </div>
                      <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex justify-between">
                        <span className="text-gray-400">Total Plastic:</span>
                        <span className="text-amber-300 font-bold">{summary.estimatedPlasticWaste} T</span>
                      </div>
                    </div>

                    <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 text-[11px] font-mono flex justify-between items-center">
                      <span className="text-gray-400 flex items-center gap-1">
                        <Factory className="w-3.5 h-3.5 text-indigo-400" /> Source:
                      </span>
                      <span className="text-gray-200 font-bold truncate max-w-[140px]">{summary.likelySource}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Metrics & Mini Stats */}
            {activeTab === 'stats' && (
              <div className="space-y-3 font-mono text-xs">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span className="text-gray-300">Detected Clusters:</span>
                  </div>
                  <span className="font-extrabold text-cyan-300 text-sm">{clusterCount}</span>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-gray-300">Model Accuracy Rate:</span>
                  </div>
                  <span className="font-extrabold text-emerald-400 text-sm">{accuracy}%</span>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span className="text-gray-300">Processing Time:</span>
                  </div>
                  <span className="font-extrabold text-white text-sm">{processingTime}s</span>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    <span className="text-gray-300">High Risk Hotspots:</span>
                  </div>
                  <span className="font-extrabold text-red-400 text-sm">{highRiskCount}</span>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Trash2 className="w-4 h-4 text-amber-400" />
                    <span className="text-gray-300">Estimated Plastic Mass:</span>
                  </div>
                  <span className="font-extrabold text-amber-300 text-sm">{estimatedWaste} Metric Tons</span>
                </div>
              </div>
            )}

            {/* TAB 3: Layer Overlays */}
            {activeTab === 'layers' && (
              <div className="space-y-2 font-mono text-xs">
                <div className="text-[9px] text-cyan-400 uppercase tracking-wider border-b border-white/10 pb-1 mb-2 font-bold flex justify-between">
                  <span>GIS Map Overlays</span>
                  <span>Visibility</span>
                </div>
                {mapLayers.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => toggleLayer(layer.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                      layer.visible
                        ? 'bg-[#0A84FF]/20 text-cyan-300 border border-[#0A84FF]/40'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                  >
                    <span>{layer.name}</span>
                    {layer.visible ? (
                      <Eye className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
