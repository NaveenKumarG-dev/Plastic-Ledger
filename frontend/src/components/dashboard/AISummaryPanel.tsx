import React from 'react';
import { motion } from 'framer-motion';
import { EnvironmentalReport } from '@/types';
import { Sparkles, AlertTriangle, ShieldCheck, Factory, Layers, Waves } from 'lucide-react';

interface AISummaryPanelProps {
  summary: EnvironmentalReport | null;
}

export const AISummaryPanel: React.FC<AISummaryPanelProps> = ({ summary }) => {
  if (!summary) return null;

  const priorityColor =
    summary.cleanupPriority === 'high' || summary.cleanupPriority === 'critical'
      ? 'bg-red-500/20 text-red-400 border-red-500/40'
      : summary.cleanupPriority === 'medium'
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#07172A]/90 border border-[#0A84FF]/30 backdrop-blur-xl p-4 rounded-2xl shadow-xl text-white font-sans overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-[#0A84FF]/20 text-cyan-400 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="font-extrabold text-sm text-white font-mono tracking-wide">AI Environmental Summary</h3>
        </div>
        <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
          Neural Scan Output
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
        <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex items-center justify-between">
          <span className="text-gray-400">Selected Region:</span>
          <span className="text-cyan-300 font-bold">{summary.selectedRegion.area} km²</span>
        </div>

        <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex items-center justify-between">
          <span className="text-gray-400">Plastic Clusters:</span>
          <span className="text-white font-bold">{summary.plasticClusters}</span>
        </div>

        <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex items-center justify-between">
          <span className="text-gray-400">Dominant Polymer:</span>
          <span className="text-cyan-400 font-bold">{summary.dominantPolymer}</span>
        </div>

        <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex items-center justify-between">
          <span className="text-gray-400">Estimated Plastic:</span>
          <span className="text-amber-300 font-bold">{summary.estimatedPlasticWaste} Tons</span>
        </div>
      </div>

      <div className="space-y-1.5 text-xs font-mono">
        <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex items-center justify-between">
          <span className="text-gray-400 flex items-center gap-1">
            <Factory className="w-3.5 h-3.5 text-indigo-400" /> Likely Source:
          </span>
          <span className="text-gray-200 font-semibold truncate max-w-[150px]" title={summary.likelySource}>
            {summary.likelySource}
          </span>
        </div>

        <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5">
          <span className="text-gray-400">Cleanup Priority:</span>
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border uppercase ${priorityColor}`}>
            {summary.cleanupPriority}
          </span>
        </div>

        <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5">
          <span className="text-gray-400">Environmental Risk:</span>
          <span className="text-red-400 font-bold text-sm">{summary.riskScore}%</span>
        </div>
      </div>
    </motion.div>
  );
};
