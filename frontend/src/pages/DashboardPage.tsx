import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, MapPin, Zap } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { useLocalStorage } from '@/hooks/useAnimations';
import { KPIGrid } from '@/components/dashboard/KPICard';
import { GISToolbar } from '@/components/gis/GISToolbar';
import { GISMap } from '@/components/gis/GISMap';
import { ClusterPopup } from '@/components/gis/ClusterPopup';
import { RegionInfoPanel } from '@/components/gis/RegionInfoPanel';
import { AIWorkflow } from '@/components/dashboard/AIWorkflow';
import { dashboardStatsAPI, plasticsDetectionAPI } from '@/lib/api/mockAPI';
import { DashboardStats, PlasticCluster, SelectedRegion } from '@/types';
import { generateTrajectoryPoints } from '@/lib/utils/geoUtils';

const DashboardPage: React.FC = () => {
  const {
    selectedRegion,
    setSelectedRegion,
    detectionResult,
    setDetectionResult,
    isAnalyzing,
    setIsAnalyzing,
    analysisProgress,
    setAnalysisProgress,
    selectedCluster,
    setSelectedCluster,
  } = useDashboard();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnalysisPopup, setShowAnalysisPopup] = useState(false);

  // Load dashboard stats
  useEffect(() => {
    const loadStats = async () => {
      const data = await dashboardStatsAPI();
      setStats(data);
      setLoading(false);
    };
    loadStats();
  }, []);

  // Handle region selection
  const handleRegionSelect = (region: SelectedRegion) => {
    setSelectedRegion(region);
    setShowAnalysisPopup(true);
  };

  // Simulate region drawing
  const handleDrawRectangle = () => {
    const mockRegion: SelectedRegion = {
      id: `region_${Date.now()}`,
      name: 'Bay of Bengal',
      type: 'rectangle',
      coordinates: [
        { latitude: 20.0, longitude: 80.0 },
        { latitude: 20.5, longitude: 82.0 },
      ],
      boundingBox: {
        north: 20.5,
        south: 20.0,
        east: 82.0,
        west: 80.0,
      },
      area: 12.84,
      width: 4.2,
      height: 3.1,
      perimeter: 14.4,
      center: { latitude: 20.25, longitude: 81.0 },
      timestamp: new Date(),
    };
    handleRegionSelect(mockRegion);
  };

  // Analyze selected region
  const handleAnalyzeRegion = async () => {
    if (!selectedRegion) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setShowAnalysisPopup(false);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 25;
      });
    }, 500);

    try {
      const result = await plasticsDetectionAPI(selectedRegion.id, selectedRegion);
      setDetectionResult(result);
      setAnalysisProgress(100);
    } finally {
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisProgress(0);
      }, 1000);
    }
  };

  const kpiStats = stats
    ? [
        {
          title: 'Total Plastic Clusters',
          value: stats.totalClusters,
          unit: 'clusters',
          icon: <AlertTriangle size={20} />,
          trend: 12,
          trendLabel: 'vs last week',
          status: 'alert' as const,
          showMiniChart: true,
        },
        {
          title: 'Detection Accuracy',
          value: stats.detectionAccuracy * 100,
          unit: '%',
          icon: <Activity size={20} />,
          trend: 5,
          trendLabel: 'improvement',
          status: 'good' as const,
          showMiniChart: true,
        },
        {
          title: 'Active Monitoring Regions',
          value: stats.activeRegions,
          unit: 'regions',
          icon: <MapPin size={20} />,
          trend: 8,
          trendLabel: 'new regions',
          status: 'good' as const,
          showMiniChart: false,
        },
        {
          title: 'Estimated Plastic Waste',
          value: stats.estimatedPlasticWaste / 1000,
          unit: '1000 MT',
          icon: <Zap size={20} />,
          trend: -3,
          trendLabel: 'declining',
          status: 'good' as const,
          showMiniChart: true,
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#071A2E] pt-20 pb-10">
      {/* KPI Cards */}
      <div className="px-6 py-8">
        <motion.h1
          className="text-3xl font-bold text-white mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Live Environmental Monitoring
        </motion.h1>

        {!loading ? <KPIGrid stats={kpiStats} /> : <div>Loading stats...</div>}
      </div>

      {/* Main GIS Workspace */}
      <div className="px-6 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">GIS Explorer</h2>
          <motion.button
            className="px-4 py-2 bg-gradient-to-r from-[#0A84FF] to-[#4CC9F0] text-white rounded-lg font-semibold hover:shadow-lg transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDrawRectangle}
          >
            Draw Region
          </motion.button>
        </div>

        <motion.div
          className="h-96 md:h-[500px] rounded-xl overflow-hidden border border-[#0A84FF]/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GISMap
            clusters={detectionResult?.clusters}
            onClusterClick={(cluster) => setSelectedCluster(cluster)}
            onRegionDraw={handleRegionSelect}
          />
          <GISToolbar />
        </motion.div>
      </div>

      {/* Analyze Button */}
      {selectedRegion && !detectionResult && (
        <motion.div
          className="flex justify-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.button
            className="px-8 py-4 bg-gradient-to-r from-[#0A84FF] to-[#00C2A8] text-white font-bold rounded-xl hover:shadow-2xl transition-all text-lg"
            whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(10, 132, 255, 0.5)' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAnalyzeRegion}
          >
            🚀 Analyze Selected Region
          </motion.button>
        </motion.div>
      )}

      {/* Detection Results */}
      {detectionResult && (
        <motion.div
          className="px-6 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <h3 className="text-xl font-bold text-white mb-4">Detection Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {detectionResult.clusters.slice(0, 6).map((cluster, idx) => (
              <motion.div
                key={cluster.id}
                className="bg-gradient-to-br from-[#0F2D4A] to-[#071A2E] border border-[#0A84FF]/20 rounded-lg p-4 cursor-pointer hover:border-[#0A84FF]/50 transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -5 }}
                onClick={() => setSelectedCluster(cluster)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-white">{cluster.polymerType}</p>
                    <p className="text-xs text-gray-400">{cluster.id}</p>
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-1 rounded"
                    style={{
                      backgroundColor:
                        cluster.riskLevel === 'critical'
                          ? 'rgba(239, 68, 68, 0.2)'
                          : cluster.riskLevel === 'high'
                            ? 'rgba(249, 115, 22, 0.2)'
                            : 'rgba(34, 197, 94, 0.2)',
                      color:
                        cluster.riskLevel === 'critical'
                          ? '#EF4444'
                          : cluster.riskLevel === 'high'
                            ? '#F97316'
                            : '#22C55E',
                    }}
                  >
                    {cluster.riskLevel}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-300">
                    Area: <span className="font-semibold">{cluster.estimatedArea.toFixed(2)} km²</span>
                  </p>
                  <p className="text-gray-300">
                    Confidence: <span className="font-semibold">{(cluster.confidence * 100).toFixed(0)}%</span>
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Panels */}
      {selectedRegion && <RegionInfoPanel region={selectedRegion} onClose={() => setSelectedRegion(null)} />}
      {selectedCluster && (
        <ClusterPopup cluster={selectedCluster} onClose={() => setSelectedCluster(null)} onAnalyze={() => {}} />
      )}

      {/* AI Workflow */}
      <AIWorkflow isActive={isAnalyzing} progress={analysisProgress} />
    </div>
  );
};

export default DashboardPage;
