import React, { useState, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { ProfessionalGISMap } from '@/components/gis/ProfessionalGISMap';
import { FloatingGISToolbar } from '@/components/gis/FloatingGISToolbar';
import { RegionInfoCard } from '@/components/gis/RegionInfoCard';
import { AIProcessingModal } from '@/components/dashboard/AIProcessingModal';
import { ClusterDetailPanel } from '@/components/gis/ClusterDetailPanel';
import { AISummaryPanel } from '@/components/dashboard/AISummaryPanel';
import { TopStatsHeader } from '@/components/dashboard/TopStatsHeader';
import { TimelineSlider } from '@/components/dashboard/TimelineSlider';
import { mockApiService, RegionCalculationResult } from '@/services/apiService';
import { SelectedRegion, PlasticCluster, EnvironmentalReport } from '@/types';
import { useDashboard } from '@/context/DashboardContext';

const DashboardPage: React.FC = () => {
  const { setSelectedRegion, setGisToolbar } = useDashboard();

  // Local GIS state
  const [currentRegion, setCurrentRegion] = useState<SelectedRegion | null>(null);
  const [currentStats, setCurrentStats] = useState<RegionCalculationResult | null>(null);
  const [clusters, setClusters] = useState<PlasticCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<PlasticCluster | null>(null);
  const [summary, setSummary] = useState<EnvironmentalReport | null>(null);

  // AI Workflow modal state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  // Timeline drift state
  const [driftDays, setDriftDays] = useState(0);

  // Callback when a region is drawn on map
  const handleRegionSelected = useCallback(
    (coords: Array<[number, number]>, stats: RegionCalculationResult) => {
      const region: SelectedRegion = {
        id: `reg-${Date.now()}`,
        type: 'polygon',
        coordinates: coords.map(([lat, lng]) => ({ latitude: lat, longitude: lng })),
        boundingBox: stats.boundingBox,
        area: stats.areaKm2,
        width: stats.widthKm,
        height: stats.heightKm,
        perimeter: stats.perimeterKm,
        center: stats.center,
        timestamp: new Date(),
      };

      setCurrentRegion(region);
      setCurrentStats(stats);
      setSelectedRegion(region);
    },
    [setSelectedRegion]
  );

  // Trigger AI Analysis pipeline
  const handleStartAnalysis = useCallback(() => {
    if (!currentRegion) return;
    setIsAnalyzing(true);
    setShowAIModal(true);
  }, [currentRegion]);

  // When 6-step AI workflow completes
  const handleAnalysisComplete = useCallback(async () => {
    setShowAIModal(false);
    setIsAnalyzing(false);

    if (currentRegion) {
      const detected = await mockApiService.detectPlastics(currentRegion);
      setClusters(detected);
      const sum = await mockApiService.getRegionSummary(detected, currentRegion.area);
      setSummary(sum);
    }
  }, [currentRegion]);

  // Reset tool handler
  const handleResetSelection = useCallback(() => {
    setCurrentRegion(null);
    setCurrentStats(null);
    setClusters([]);
    setSelectedCluster(null);
    setSummary(null);
    setSelectedRegion(null);
    setGisToolbar({ activeTool: null, isDrawing: false, isVisible: true });
  }, [setSelectedRegion, setGisToolbar]);

  return (
    <div className="w-full h-screen bg-[#07172A] relative overflow-hidden flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Full-screen Interactive GIS Workspace */}
      <div className="flex-1 relative w-full h-full pt-14">
        {/* Leaflet Satellite Map & Layers */}
        <ProfessionalGISMap
          clusters={clusters}
          onClusterClick={(c) => setSelectedCluster(c)}
          onRegionSelected={handleRegionSelected}
          driftDays={driftDays}
        />

        {/* Floating Left GIS Toolbar */}
        <FloatingGISToolbar onReset={handleResetSelection} />

        {/* Top-Right Mini Stats & Layer Control */}
        <TopStatsHeader
          clusterCount={clusters.length || 47}
          accuracy={96}
          processingTime={3.2}
          highRiskCount={clusters.filter((c) => c.riskLevel === 'high' || c.riskLevel === 'critical').length || 12}
          estimatedWaste={
            clusters.length > 0
              ? Number(clusters.reduce((acc, c) => acc + c.estimatedQuantity, 0).toFixed(2))
              : 2.4
          }
        />

        {/* Selected Region Info Card (Top-Left, beside Toolbar) */}
        <RegionInfoCard
          region={currentRegion}
          stats={currentStats}
          onAnalyze={handleStartAnalysis}
          isAnalyzing={isAnalyzing}
        />

        {/* Clickable Cluster Inspection Detail Panel (Right Side) */}
        <ClusterDetailPanel
          cluster={selectedCluster}
          onClose={() => setSelectedCluster(null)}
        />

        {/* AI Summary Panel (Right Side, when no cluster selected) */}
        {summary && !selectedCluster && (
          <div className="absolute right-6 top-32 z-[990] w-88">
            <AISummaryPanel summary={summary} />
          </div>
        )}

        {/* Bottom Interactive Timeline Slider (Centered) */}
        <TimelineSlider
          selectedDays={driftDays}
          onTimeChange={(days) => setDriftDays(days)}
        />

        {/* 6-Step AI Processing Animation Modal */}
        <AIProcessingModal
          isOpen={showAIModal}
          onComplete={handleAnalysisComplete}
        />
      </div>
    </div>
  );
};

export default DashboardPage;
