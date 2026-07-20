import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboard } from '@/context/DashboardContext';
import {
  Layers,
  Activity,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Trash2,
  ChevronDown,
  Eye,
  EyeOff,
} from 'lucide-react';

interface TopStatsHeaderProps {
  clusterCount?: number;
  accuracy?: number;
  processingTime?: number;
  highRiskCount?: number;
  estimatedWaste?: number;
}

export const TopStatsHeader: React.FC<TopStatsHeaderProps> = ({
  clusterCount = 47,
  accuracy = 96,
  processingTime = 3.2,
  highRiskCount = 12,
  estimatedWaste = 2.4,
}) => {
  const { mapLayers, toggleLayer } = useDashboard();
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  return (
    <div className="absolute right-6 top-6 z-[1000] flex items-center space-x-3">
      {/* Layer Control Dropdown Toggle */}
      <div className="relative">
        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className="flex items-center space-x-2 bg-[#07172A]/90 border border-[#0A84FF]/40 backdrop-blur-xl px-3.5 py-2 rounded-xl text-white font-mono text-xs shadow-xl hover:bg-[#0A84FF]/20 transition-all cursor-pointer"
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold">Layers ({mapLayers.filter((l) => l.visible).length})</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showLayerMenu ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showLayerMenu && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 top-12 w-64 bg-[#07172A]/95 border border-[#0A84FF]/40 backdrop-blur-2xl p-3 rounded-2xl shadow-2xl z-[1100] text-white"
            >
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider border-b border-white/10 pb-1.5 mb-2 font-bold flex justify-between">
                <span>Map Layer Overlays</span>
                <span>Toggle</span>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {mapLayers.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => toggleLayer(layer.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                      layer.visible
                        ? 'bg-[#0A84FF]/20 text-cyan-300 border border-[#0A84FF]/40'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                  >
                    <span>{layer.name}</span>
                    {layer.visible ? (
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-gray-500" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mini Statistics Panel */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center bg-[#07172A]/90 border border-[#0A84FF]/30 backdrop-blur-xl px-4 py-2 rounded-xl shadow-xl space-x-5 text-white font-mono text-xs"
      >
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <div>
            <span className="text-[10px] text-gray-400 block uppercase">Clusters</span>
            <span className="font-extrabold text-cyan-300">{clusterCount}</span>
          </div>
        </div>

        <div className="h-6 w-px bg-white/10" />

        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="text-[10px] text-gray-400 block uppercase">Accuracy</span>
            <span className="font-extrabold text-emerald-400">{accuracy}%</span>
          </div>
        </div>

        <div className="h-6 w-px bg-white/10" />

        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <div>
            <span className="text-[10px] text-gray-400 block uppercase">Proc Time</span>
            <span className="font-extrabold text-white">{processingTime}s</span>
          </div>
        </div>

        <div className="h-6 w-px bg-white/10" />

        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <div>
            <span className="text-[10px] text-gray-400 block uppercase">High Risk</span>
            <span className="font-extrabold text-red-400">{highRiskCount}</span>
          </div>
        </div>

        <div className="h-6 w-px bg-white/10" />

        <div className="flex items-center space-x-2">
          <Trash2 className="w-4 h-4 text-amber-400" />
          <div>
            <span className="text-[10px] text-gray-400 block uppercase">Est. Waste</span>
            <span className="font-extrabold text-amber-300">{estimatedWaste} Tons</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
