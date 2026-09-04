/**
 * CropFix - Institutional Surveillance & Aggregated Analytics (Bento Grid Theme)
 * SIH26131: Early detection and management of crop diseases and pest infestations
 * Phase 11 Implementation
 * 
 * STRICT PRIVACY DIRECTIVE:
 * Displays aggregated epidemiological crop-health intelligence only.
 * Never leaks individual farmer identities, telephone numbers, private notes, GPS, or crop photos.
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  AlertTriangle, 
  BarChart3, 
  ShieldAlert,
  Activity,
  Calendar,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  Lock,
  Sparkles,
  Award,
  Layers
} from 'lucide-react';
import type { User, InstitutionalAnalytics, TimeframeFilter, RiskLevel } from '../types/index.js';

interface InstitutionalDashboardProps {
  currentUser: User;
  token?: string;
}

export const InstitutionalDashboard: React.FC<InstitutionalDashboardProps> = ({
  currentUser,
  token = '',
}) => {
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('30d');
  const [analytics, setAnalytics] = useState<InstitutionalAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/institutional/analytics?timeframe=${timeframe}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (err) {
      console.error('Failed to load institutional analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const highRiskCount = analytics ? (analytics.riskDistribution.HIGH || 0) + (analytics.riskDistribution.CRITICAL || 0) : 0;
  const totalCompletedFollowUps = analytics?.followUpStats.completed || 0;
  const improvementRate = totalCompletedFollowUps > 0 
    ? Math.round((analytics!.followUpStats.improved / totalCompletedFollowUps) * 100) 
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Top Government / Institutional Banner */}
      <div className="bg-[#1B3022] rounded-xl p-6 text-white shadow-sm border-b-4 border-[#2D5A27] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">District Crop-Health Surveillance</h1>
            <span className="bg-[#2D5A27] text-white text-xs px-2.5 py-0.5 rounded-full border border-emerald-400/30 font-medium">
              {currentUser.name} • Institutional Officer
            </span>
          </div>
          <p className="text-xs text-emerald-200/90 mt-1 max-w-xl">
            District-wide aggregate surveillance, early outbreak risk containment, and agricultural extension coordination.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Timeframe Selector */}
          <div className="bg-[#142419] p-1 rounded-lg border border-[#2D5A27] flex items-center gap-1">
            {[
              { key: 'today', label: 'Today' },
              { key: '7d', label: '7 Days' },
              { key: '30d', label: '30 Days' },
              { key: 'all', label: 'All Time' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTimeframe(t.key as TimeframeFilter)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  timeframe === t.key
                    ? 'bg-[#4CAF50] text-[#1B3022] font-bold shadow-xs'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="bg-[#142419] px-3.5 py-1.5 rounded-lg border border-[#2D5A27] text-right">
            <div className="text-[10px] text-emerald-300 uppercase font-medium">Surveillance Scope</div>
            <div className="text-xs font-bold text-white">
              {currentUser.district || 'Pune'} District, {currentUser.state || 'Maharashtra'}
            </div>
          </div>
        </div>
      </div>

      {/* Strict Privacy Compliance Notice */}
      <div className="bg-[#F8F9FA] border border-[#E0E0E0] rounded-xl p-3.5 flex items-center gap-3 text-xs text-[#555]">
        <div className="p-1.5 bg-[#E8F5E9] text-[#2E7D32] rounded-lg shrink-0">
          <Lock className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-bold text-[#1B3022]">Farmer Privacy Protection Enforced: </span>
          <span>
            Institutional reporting is strictly aggregated. Individual farmer identities, telephone numbers, GPS parcels, private notes, and field photos are strictly withheld to safeguard producer confidentiality.
          </span>
        </div>
      </div>

      {loading && (
        <div className="p-16 text-center text-xs text-[#888]">
          Aggregating district crop-health telemetry...
        </div>
      )}

      {!loading && !analytics?.hasSufficientData && (
        <div className="p-16 text-center bg-white rounded-xl border border-[#E0E0E0] space-y-2">
          <Activity className="w-10 h-10 text-[#888] mx-auto opacity-70" />
          <div className="font-bold text-sm text-[#1B3022]">No crop-health surveillance data available for this timeframe</div>
          <p className="text-xs text-[#888] max-w-sm mx-auto">
            Switch timeframe to &quot;All Time&quot; or &quot;30 Days&quot; to inspect historical crop disease and pest incidence records.
          </p>
        </div>
      )}

      {!loading && analytics?.hasSufficientData && (
        <>
          {/* BENTO STATS ROW */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Total Observations</span>
              <div className="text-2xl font-bold font-mono text-[#1B3022] mt-2">
                {analytics.totalObservations}
              </div>
              <div className="text-[11px] text-[#888] mt-0.5">District cluster reports</div>
            </div>

            <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs border-l-4 border-l-[#F27D26]">
              <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Active Monitoring Cases</span>
              <div className="text-2xl font-bold font-mono text-[#F27D26] mt-2">
                {analytics.activeCases}
              </div>
              <div className="text-[11px] text-[#888] mt-0.5">Open longitudinal cases</div>
            </div>

            <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs border-l-4 border-l-red-500">
              <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Elevated Risk Clusters</span>
              <div className="text-2xl font-bold font-mono text-red-600 mt-2">
                {highRiskCount}
              </div>
              <div className="text-[11px] text-[#888] mt-0.5">High & critical risk states</div>
            </div>

            <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs border-l-4 border-l-[#4CAF50]">
              <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Monitored Commodities</span>
              <div className="text-2xl font-bold font-mono text-[#2E7D32] mt-2">
                {analytics.cropDistribution.length}
              </div>
              <div className="text-[11px] text-[#888] mt-0.5">Active agricultural crops</div>
            </div>
          </div>

          {/* MAIN 2-COLUMN BENTO GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Contextual Risk Distribution (6 Cols) */}
            <div className="lg:col-span-6 bg-white rounded-xl shadow-xs border border-[#E0E0E0] p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-3 mb-3">
                  <div>
                    <h2 className="text-xs font-bold text-[#1B3022] uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-[#F27D26]" />
                      Contextual Crop-Health Risk Distribution
                    </h2>
                    <p className="text-[11px] text-[#888] mt-0.5 italic">
                      Contextual crop-health risk, not confirmed disease cases
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {[
                    { level: 'LOW', label: 'Low Risk', count: analytics.riskDistribution.LOW || 0, color: 'bg-[#4CAF50]' },
                    { level: 'MODERATE', label: 'Moderate Risk', count: analytics.riskDistribution.MODERATE || 0, color: 'bg-[#F27D26]' },
                    { level: 'HIGH', label: 'High Risk', count: analytics.riskDistribution.HIGH || 0, color: 'bg-red-500' },
                    { level: 'CRITICAL', label: 'Critical Outbreak Risk', count: analytics.riskDistribution.CRITICAL || 0, color: 'bg-red-700' },
                    { level: 'UNCERTAIN', label: 'Uncertain / Ambiguous', count: analytics.riskDistribution.UNCERTAIN || 0, color: 'bg-purple-600' },
                  ].map((r) => {
                    const pct = analytics.totalObservations > 0 
                      ? Math.round((r.count / analytics.totalObservations) * 100) 
                      : 0;
                    return (
                      <div key={r.level} className="space-y-1 text-xs">
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-700">{r.label}</span>
                          <span className="font-mono text-[#1B3022] font-bold">{r.count} ({pct}%)</span>
                        </div>
                        <div className="h-2 w-full bg-[#F0F0F0] rounded-full overflow-hidden">
                          <div className={`h-full ${r.color}`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#F0F0F0] text-[11px] text-[#777]">
                Evaluated by CropFix Multimodal Risk Pipeline factoring plant phenology and canopy vulnerability.
              </div>
            </div>

            {/* Follow-up & Treatment Recovery Stats (6 Cols) */}
            <div className="lg:col-span-6 bg-white rounded-xl shadow-xs border border-[#E0E0E0] p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-3 mb-3">
                  <h2 className="text-xs font-bold text-[#1B3022] uppercase tracking-widest flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-[#2E7D32]" />
                    Follow-Up Treatment Outcomes & Recovery
                  </h2>
                  <span className="text-[10px] font-mono text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded font-bold">
                    {improvementRate}% IMPROVEMENT
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 my-3">
                  <div className="p-3 bg-[#E8F5E9] rounded-xl border border-[#C5E1A5] text-center">
                    <div className="flex items-center justify-center gap-1 text-[#2E7D32] mb-1">
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase">Improved</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-[#2E7D32]">
                      {analytics.followUpStats.improved}
                    </div>
                    <div className="text-[10px] text-[#558B2F]">Stabilized canopy</div>
                  </div>

                  <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0] text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-600 mb-1">
                      <Minus className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase">Unchanged</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-700">
                      {analytics.followUpStats.unchanged}
                    </div>
                    <div className="text-[10px] text-[#888]">Monitoring</div>
                  </div>

                  <div className="p-3 bg-[#FFEBEE] rounded-xl border border-red-200 text-center">
                    <div className="flex items-center justify-center gap-1 text-red-700 mb-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase">Worsened</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-red-700">
                      {analytics.followUpStats.worsened}
                    </div>
                    <div className="text-[10px] text-red-600">Escalated</div>
                  </div>
                </div>

                {/* Agronomist Review Rate */}
                <div className="p-3.5 bg-[#F1F8E9]/60 rounded-xl border border-[#C5E1A5] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-[#1B3022]">
                    <span className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-[#4CAF50]" />
                      Agronomist Human Validation Rate:
                    </span>
                    <span className="font-mono text-[#2E7D32]">
                      {analytics.expertReviewStats.agreementRate}% AI Concordance
                    </span>
                  </div>
                  <p className="text-[11px] text-[#555]">
                    {analytics.expertReviewStats.completed} field validations completed • {analytics.expertReviewStats.agreeCount} confirmed • {analytics.expertReviewStats.disagreeCount} revised by specialists
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#F0F0F0] text-[11px] text-[#777]">
                Total follow-up field audits: {analytics.followUpStats.total} ({analytics.followUpStats.completed} completed)
              </div>
            </div>

            {/* Monitored Crops Distribution (6 Cols) */}
            <div className="lg:col-span-6 bg-white rounded-xl shadow-xs border border-[#E0E0E0] p-5">
              <h2 className="text-xs font-bold text-[#1B3022] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-[#4CAF50]" />
                Incidence by Monitored Agricultural Commodity
              </h2>
              <div className="space-y-2">
                {analytics.cropDistribution.map((crop) => (
                  <div key={crop.crop} className="p-2.5 bg-[#F8F9FA] rounded-lg border border-[#E0E0E0] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#1B3022]">{crop.crop}</span>
                      <span className="text-[11px] text-[#777] ml-2">({crop.cases} active longitudinal cases)</span>
                    </div>
                    <span className="font-mono font-bold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded">
                      {crop.observations} reports
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coarse Regional Hotspots & Emerging Symptoms (6 Cols) */}
            <div className="lg:col-span-6 space-y-5">
              {/* Coarse District Hotspots */}
              <div className="bg-white rounded-xl shadow-xs border border-[#E0E0E0] p-5">
                <h2 className="text-xs font-bold text-[#1B3022] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#F27D26]" />
                  District-Level Surveillance Clusters (Coarse Aggregates)
                </h2>
                <div className="space-y-2">
                  {analytics.coarseHotspots.map((spot) => (
                    <div key={spot.district} className="p-2.5 bg-[#F8F9FA] rounded-lg border border-[#E0E0E0] flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-[#1B3022]">{spot.district}</span>
                        {spot.highRiskCount > 0 && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 ml-2">
                            {spot.highRiskCount} HIGH RISK
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-slate-700 font-semibold">
                        {spot.count} incidents
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Emerging Symptoms Breakdown */}
              {analytics.emergingSymptoms.length > 0 && (
                <div className="bg-white rounded-xl shadow-xs border border-[#E0E0E0] p-5">
                  <h2 className="text-xs font-bold text-[#1B3022] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#4CAF50]" />
                    Emerging Foliar Symptom Clusters
                  </h2>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {analytics.emergingSymptoms.map((sym) => (
                      <span
                        key={sym.symptom}
                        className="px-2.5 py-1 bg-[#F8F9FA] border border-[#E0E0E0] rounded-md text-xs text-slate-700 flex items-center gap-1.5 font-medium"
                      >
                        <span className="capitalize">{sym.symptom}</span>
                        <span className="text-[10px] font-mono font-bold bg-[#E8F5E9] text-[#2E7D32] px-1 rounded">
                          {sym.count}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
