import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectedRegion } from '@/types';
import { RegionCalculationResult } from '@/services/apiService';
import { Sparkles, MapPin, Compass, ShieldAlert, Crosshair, ChevronRight } from 'lucide-react';

interface RegionInfoCardProps {
  region: SelectedRegion | null;
  stats: RegionCalculationResult | null;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  onClose?: () => void;
}

export const RegionInfoCard: React.FC<RegionInfoCardProps> = ({
  region,
  stats,
  onAnalyze,
  isAnalyzing,
}) => {
  if (!region || !stats) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="absolute left-20 bottom-8 z-[1000] w-96 bg-[#07172A]/95 border border-[#0A84FF]/40 backdrop-blur-2xl p-5 rounded-2xl shadow-2xl text-white font-sans overflow-hidden"
      >
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0A84FF] via-cyan-400 to-[#00F5D4]" />

        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-[#0A84FF]/20 rounded-lg text-cyan-400">
              <Crosshair className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white tracking-wide">Selected Region</h3>
              <p className="text-[11px] text-cyan-400/80 font-mono capitalize">
                {region.type} Geodesic Area
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-[10px] font-mono">
            Active Spatial Target
          </span>
        </div>

        {/* Primary Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4 bg-white/5 p-3 rounded-xl border border-white/5">
          <div className="text-center">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-mono">Area</span>
            <span className="text-base font-extrabold text-cyan-300 font-mono">
              {stats.areaKm2} <span className="text-[10px] text-gray-400">km²</span>
            </span>
          </div>
          <div className="text-center border-x border-white/10">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-mono">Width</span>
            <span className="text-base font-extrabold text-white font-mono">
              {stats.widthKm} <span className="text-[10px] text-gray-400">km</span>
            </span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-mono">Height</span>
            <span className="text-base font-extrabold text-white font-mono">
              {stats.heightKm} <span className="text-[10px] text-gray-400">km</span>
            </span>
          </div>
        </div>

        {/* Center & Bounding Details */}
        <div className="space-y-2 text-xs font-mono mb-4">
          <div className="flex justify-between items-center bg-white/5 px-3 py-1.5 rounded-lg">
            <span className="text-gray-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Center Lat/Lng:
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

          {/* Bounding Box Grid */}
          <div className="bg-white/5 p-2.5 rounded-lg space-y-1.5 border border-white/5">
            <div className="text-[10px] text-gray-400 uppercase font-mono tracking-wider font-semibold border-b border-white/5 pb-1 flex justify-between">
              <span>Bounding Coordinates</span>
              <span className="text-cyan-400">WGS84</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
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

          {/* Corner Coordinates Collapsible Info */}
          <div className="text-[10px] text-gray-400 bg-black/20 p-2 rounded-lg space-y-0.5">
            <div className="font-semibold text-gray-300 mb-1">Corner Lat/Lng:</div>
            <div className="flex justify-between">
              <span>NW:</span> <span className="text-gray-300">{stats.corners.northWest.latitude.toFixed(3)}, {stats.corners.northWest.longitude.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span>NE:</span> <span className="text-gray-300">{stats.corners.northEast.latitude.toFixed(3)}, {stats.corners.northEast.longitude.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span>SE:</span> <span className="text-gray-300">{stats.corners.southEast.latitude.toFixed(3)}, {stats.corners.southEast.longitude.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span>SW:</span> <span className="text-gray-300">{stats.corners.southWest.latitude.toFixed(3)}, {stats.corners.southWest.longitude.toFixed(3)}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <motion.button
          onClick={onAnalyze}
          disabled={isAnalyzing}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 px-4 bg-gradient-to-r from-[#0A84FF] via-cyan-500 to-[#00F5D4] hover:from-[#0066CC] hover:to-cyan-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-[0_0_25px_rgba(10,132,255,0.5)] transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-slate-950 fill-current" />
          <span>Analyze Selected Region</span>
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
};
