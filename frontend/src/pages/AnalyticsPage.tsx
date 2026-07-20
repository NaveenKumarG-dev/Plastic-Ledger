import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { analyticsAPI } from '@/lib/api/mockAPI';
import { AnalyticsData } from '@/types';

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const analyticsData = await analyticsAPI();
      setData(analyticsData);
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) return <div className="min-h-screen bg-[#071A2E] pt-20 text-white">Loading...</div>;
  if (!data) return null;

  const COLORS = ['#0A84FF', '#00C2A8', '#F59E0B', '#EF4444', '#22C55E', '#4CC9F0'];

  const ChartCard: React.FC<{
    title: string;
    children: React.ReactNode;
    delay?: number;
  }> = ({ title, children, delay = 0 }) => (
    <motion.div
      className="bg-gradient-to-br from-[#0F2D4A] to-[#071A2E] border border-[#0A84FF]/20 rounded-xl p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
      {children}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#071A2E] pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        <motion.h1
          className="text-4xl font-bold text-white mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Analytics & Insights
        </motion.h1>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Monthly Trend */}
          <ChartCard title="Monthly Pollution Trend">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0A84FF20" />
                <XAxis dataKey="month" stroke="#999" />
                <YAxis stroke="#999" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F2D4A',
                    border: '1px solid #0A84FF40',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="clusters" stroke="#0A84FF" strokeWidth={2} />
                <Line type="monotone" dataKey="weight" stroke="#00C2A8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Polymer Distribution */}
          <ChartCard title="Polymer Type Distribution" delay={0.1}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.polymerDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ polymer, percentage }) => `${polymer}: ${percentage.toFixed(1)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="percentage"
                >
                  {data.polymerDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* High Risk Regions */}
          <ChartCard title="High Risk Regions" delay={0.2}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.highRiskRegions}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0A84FF20" />
                <XAxis dataKey="region" stroke="#999" angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="#999" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F2D4A',
                    border: '1px solid #0A84FF40',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="riskScore" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Detection Accuracy Trend */}
          <ChartCard title="Detection Accuracy Trend" delay={0.3}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.detectionAccuracyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0A84FF20" />
                <XAxis dataKey="date" stroke="#999" tick={{ fontSize: 12 }} />
                <YAxis stroke="#999" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F2D4A',
                    border: '1px solid #0A84FF40',
                    borderRadius: '8px',
                  }}
                />
                <Line type="monotone" dataKey="accuracy" stroke="#22C55E" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Source Ranking and Cleanup Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Industrial Source Ranking */}
          <ChartCard title="Industrial Source Ranking" delay={0.4}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.sourceRanking}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#0A84FF20" />
                <XAxis type="number" stroke="#999" />
                <YAxis dataKey="source" type="category" stroke="#999" width={200} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F2D4A',
                    border: '1px solid #0A84FF40',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="contribution" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Cleanup Progress */}
          <ChartCard title="Cleanup Progress" delay={0.5}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.cleanupProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0A84FF20" />
                <XAxis dataKey="month" stroke="#999" />
                <YAxis stroke="#999" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F2D4A',
                    border: '1px solid #0A84FF40',
                    borderRadius: '8px',
                  }}
                />
                <Line type="monotone" dataKey="progress" stroke="#4CC9F0" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
