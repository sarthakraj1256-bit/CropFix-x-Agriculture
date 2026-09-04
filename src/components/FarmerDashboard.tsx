/**
 * CropFix - Farmer Dashboard (Bento Grid Theme)
 * SIH26131: Early detection and management of crop diseases and pest infestations
 * Supports Multi-Tab views: Farms & Plots, Observations, Case History, Actions, Follow-ups
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Sprout, 
  Plus, 
  Camera, 
  ChevronRight, 
  Sparkles, 
  AlertTriangle,
  MapPin,
  Check,
  Layers,
  Activity,
  History,
  Calendar,
  CheckSquare,
  Clock,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  ExternalLink,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  HelpCircle,
  Eye
} from 'lucide-react';
import type { 
  Farm, 
  Plot, 
  Observation, 
  User, 
  CropCase, 
  ActionItemRecord, 
  FollowUpRecord,
  ActionStatus 
} from '../types/index.js';
import { FarmModal } from './FarmModal.js';
import { PlotModal } from './PlotModal.js';
import { ObservationModal } from './ObservationModal.js';

interface FarmerDashboardProps {
  currentUser: User;
  activeTab?: string;
  token?: string;
  onSelectObservation: (obs: Observation) => void;
  onSelectCase?: (caseId: string) => void;
}

export const FarmerDashboard: React.FC<FarmerDashboardProps> = ({
  currentUser,
  activeTab = 'farms',
  token = '',
  onSelectObservation,
  onSelectCase,
}) => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [cases, setCases] = useState<CropCase[]>([]);
  const [actions, setActions] = useState<ActionItemRecord[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [caseStatusFilter, setCaseStatusFilter] = useState<string>('ALL');
  
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
  const [isPlotModalOpen, setIsPlotModalOpen] = useState(false);
  const [isObsModalOpen, setIsObsModalOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [currentUser.id]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const [farmsRes, obsRes, casesRes, actionsRes, fuRes] = await Promise.all([
        fetch('/api/farms', { headers }),
        fetch('/api/observations', { headers }),
        fetch('/api/cases', { headers }),
        fetch('/api/actions', { headers }),
        fetch('/api/follow-ups', { headers }),
      ]);

      const farmsData = await farmsRes.json();
      if (farmsData.success) {
        setFarms(farmsData.data);
        if (farmsData.data.length > 0 && !selectedFarmId) {
          setSelectedFarmId(farmsData.data[0].id);
          loadPlots(farmsData.data[0].id);
        }
      }

      const obsData = await obsRes.json();
      if (obsData.success) setObservations(obsData.data);

      const casesData = await casesRes.json();
      if (casesData.success) setCases(casesData.data);

      const actionsData = await actionsRes.json();
      if (actionsData.success) setActions(actionsData.data);

      const fuData = await fuRes.json();
      if (fuData.success) setFollowUps(fuData.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPlots = async (farmId: string) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/farms/${farmId}/plots`, { headers });
      const data = await res.json();
      if (data.success) {
        setPlots(data.data);
      }
    } catch (err) {
      console.error('Failed to load plots:', err);
    }
  };

  const handleSelectFarm = (farmId: string) => {
    setSelectedFarmId(farmId);
    loadPlots(farmId);
  };

  const handleFarmCreated = (farm: Farm) => {
    setFarms([farm, ...farms]);
    handleSelectFarm(farm.id);
  };

  const handlePlotCreated = (plot: Plot) => {
    setPlots([plot, ...plots]);
  };

  const handleObservationCreated = (obs: Observation) => {
    setObservations([obs, ...observations]);
    loadDashboardData();
    onSelectObservation(obs);
  };

  const handleToggleActionStatus = async (actionId: string, currentStatus: ActionStatus) => {
    const newStatus: ActionStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    
    // Optimistic update
    setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: newStatus } : a));

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/actions/${actionId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!data.success) {
        // Revert on failure
        setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: currentStatus } : a));
      }
    } catch {
      // Revert on failure
      setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: currentStatus } : a));
    }
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/follow-ups/${followUpId}/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          symptomTrend: 'IMPROVED',
          farmerNotes: 'Field inspection completed. Symptoms monitored and crop is stabilizing.',
          adaptiveNextStep: 'Continue regular field scouting and maintain recommended watering schedule.',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFollowUps(prev => prev.map(fu => fu.id === followUpId ? data.data : fu));
      }
    } catch (err) {
      console.error('Failed to complete follow-up inspection:', err);
    }
  };

  const activeFarm = farms.find(f => f.id === selectedFarmId);

  const filteredCases = cases.filter(c => {
    if (caseStatusFilter === 'ALL') return true;
    return c.status === caseStatusFilter;
  });

  const filteredActions = actions.filter(a => {
    if (actionFilter === 'ALL') return true;
    return a.status === actionFilter;
  });

  const completedActionsCount = actions.filter(a => a.status === 'COMPLETED').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner: Crop Health Dashboard Header */}
      <div className="bg-[#1B3022] rounded-xl p-6 text-white shadow-sm border-b-4 border-[#2D5A27] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight">Crop Health Dashboard</h1>
            <span className="bg-[#2D5A27] text-white text-xs px-2.5 py-0.5 rounded-full border border-emerald-400/30 font-medium">
              {currentUser.name}
            </span>
          </div>
          <p className="text-xs text-emerald-200/90 mt-1 max-w-xl leading-relaxed">
            Monitor your crops, understand health risks, and take the right next step.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-new-observation"
            onClick={() => setIsObsModalOpen(true)}
            disabled={farms.length === 0 || plots.length === 0}
            className="bg-[#2E7D32] hover:bg-[#256629] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            <span>Record Crop Observation</span>
          </button>
          <button
            id="btn-add-farm"
            onClick={() => setIsFarmModalOpen(true)}
            className="bg-[#142419] hover:bg-[#243f2c] text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors border border-emerald-500/30 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Farm</span>
          </button>
        </div>
      </div>

      {/* YOUR NEXT STEP: Action-First Guidance Area */}
      <div className="bg-white rounded-xl border border-emerald-200 p-4 sm:p-5 shadow-xs bg-gradient-to-r from-emerald-50/70 via-white to-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-[#1B3022] text-white shrink-0 mt-0.5">
              <CheckSquare className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/60 px-2 py-0.5 rounded">
                YOUR NEXT STEP
              </span>
              <h3 className="text-sm font-bold text-[#1B3022] mt-1">
                {actions.some(a => a.status === 'PENDING')
                  ? `Action Pending: ${actions.find(a => a.status === 'PENDING')?.title}`
                  : followUps.some(f => f.status === 'SCHEDULED')
                  ? `Scheduled Follow-up: Inspection on ${followUps.find(f => f.status === 'SCHEDULED')?.scheduledDate}`
                  : cases.some(c => c.status === 'OPEN' || c.status === 'MONITORING')
                  ? `Monitor ${cases.find(c => c.status === 'OPEN' || c.status === 'MONITORING')?.cropName} for symptom changes`
                  : observations.length === 0
                  ? 'Record your first crop photo to check crop health'
                  : 'All current health checks complete. Monitor crops during regular field inspection.'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {actions.some(a => a.status === 'PENDING')
                  ? actions.find(a => a.status === 'PENDING')?.description
                  : followUps.some(f => f.status === 'SCHEDULED')
                  ? 'Check the affected plot to see if symptoms are improving or need agronomist advice.'
                  : cases.length > 0
                  ? 'Keep observing crop canopy and re-inspect if lesions or discoloration spread.'
                  : 'Take a clear photo of any leaves showing spotting, wilting, or discoloration.'}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {actions.some(a => a.status === 'PENDING') ? (
              <button
                onClick={() => {
                  const pendingAction = actions.find(a => a.status === 'PENDING');
                  if (pendingAction) handleToggleActionStatus(pendingAction.id, 'PENDING');
                }}
                className="bg-[#2E7D32] hover:bg-[#256629] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Mark Task Completed
              </button>
            ) : followUps.some(f => f.status === 'SCHEDULED') ? (
              <button
                onClick={() => {
                  const scheduledFu = followUps.find(f => f.status === 'SCHEDULED');
                  if (scheduledFu) handleCompleteFollowUp(scheduledFu.id);
                }}
                className="bg-[#2E7D32] hover:bg-[#256629] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Record Inspection Result
              </button>
            ) : (
              <button
                onClick={() => setIsObsModalOpen(true)}
                disabled={farms.length === 0 || plots.length === 0}
                className="bg-[#1B3022] hover:bg-[#2D5A27] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Check Crop Health
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DASHBOARD CARDS: 4 Clean Semantic Metric Boxes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Farms */}
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">My Farms</span>
            <div className="w-7 h-7 bg-emerald-50 rounded-md flex items-center justify-center text-[#2E7D32]">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#1B3022]">{farms.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {farms.length === 1 ? '1 farm registered' : `${farms.length} farms registered`}
            </div>
          </div>
        </div>

        {/* Metric 2: Plots */}
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">My Plots</span>
            <div className="w-7 h-7 bg-emerald-50 rounded-md flex items-center justify-center text-[#2E7D32]">
              <Sprout className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#1B3022]">{plots.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {plots.length === 1 ? '1 active crop plot' : `${plots.length} active crop plots`}
            </div>
          </div>
        </div>

        {/* Metric 3: Health Cases */}
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs flex flex-col justify-between border-l-4 border-l-[#2E7D32]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Crop Health Cases</span>
            <div className="w-7 h-7 bg-emerald-50 rounded-md flex items-center justify-center text-[#2E7D32]">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#2E7D32]">{cases.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {cases.length === 1 ? '1 case being monitored' : `${cases.length} cases being monitored`}
            </div>
          </div>
        </div>

        {/* Metric 4: Tasks */}
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs flex flex-col justify-between border-l-4 border-l-[#1B3022]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tasks to Complete</span>
            <div className="w-7 h-7 bg-emerald-50 rounded-md flex items-center justify-center text-[#2D5A27]">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#1B3022]">
              {completedActionsCount} / {actions.length}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {actions.length === 0 ? 'No pending tasks' : `${completedActionsCount} of ${actions.length} tasks completed`}
            </div>
          </div>
        </div>
      </div>

      {/* VIEW CONDITIONAL RENDERING BASED ON ACTIVE TAB */}

      {/* 1. CASE HISTORY & TIMELINE VIEW (PHASE 9) */}
      {activeTab === 'cases' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#1B3022] flex items-center gap-2">
                <History className="w-5 h-5 text-[#2D5A27]" />
                <span>Crop Health Cases & Longitudinal History</span>
              </h2>
              <p className="text-xs text-[#555555]">
                Track diseases and pests over time, monitor recovery trajectory, and evaluate intervention effectiveness.
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-[#F4F6F4] p-1 rounded-lg border border-[#E0E0E0] text-xs">
              {['ALL', 'OPEN', 'MONITORING', 'IMPROVING', 'RESOLVED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setCaseStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs font-medium ${
                    caseStatusFilter === status
                      ? 'bg-white text-[#1B3022] shadow-xs font-semibold'
                      : 'text-[#666666] hover:text-[#1B3022]'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {filteredCases.length === 0 ? (
            <div className="bg-white border border-[#E0E0E0] rounded-xl p-12 text-center space-y-3">
              <History className="w-10 h-10 text-[#888888] mx-auto" />
              <h3 className="text-sm font-semibold text-[#1B3022]">No Health Cases in this category</h3>
              <p className="text-xs text-[#666666] max-w-md mx-auto">
                CropFix automatically creates and links longitudinal health cases when you submit foliar observations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCases.map((c) => (
                <div
                  key={c.id}
                  className="bg-white border border-[#E0E0E0] hover:border-[#2D5A27] rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all space-y-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-[#777777]">{c.id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.status === 'IMPROVING'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'WORSENING'
                          ? 'bg-rose-100 text-rose-800'
                          : c.status === 'RESOLVED'
                          ? 'bg-stone-100 text-stone-700'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {c.status}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-[#1B3022] group-hover:text-[#2D5A27] transition-colors">
                      {c.title}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-[#555555]">
                      <Sprout className="w-3.5 h-3.5 text-[#2D5A27]" />
                      <span>{c.cropName}</span>
                      <span>•</span>
                      <span>{c.plotName || 'Plot'}</span>
                    </div>

                    <div className="p-2.5 bg-[#F4F6F4] rounded-lg border border-[#E0E0E0] text-xs space-y-1">
                      <div className="flex justify-between text-[11px] text-[#666666]">
                        <span>Observations: <strong>{c.observationCount || 1}</strong></span>
                        <span>Risk: <strong>{c.riskSummary || 'Assessed'}</strong></span>
                      </div>
                      <div className="text-[10px] text-[#777777]">
                        Updated {new Date(c.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectCase && onSelectCase(c.id)}
                    className="w-full bg-[#1B3022] hover:bg-[#2D5A27] text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <History className="w-3.5 h-3.5 text-[#4CAF50]" />
                    <span>Open Case History & Timeline</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. CONSOLIDATED ACTION PLAN VIEW (PHASE 7) */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#1B3022] flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-[#2D5A27]" />
                <span>Farm Task & Action Plan Checklist</span>
              </h2>
              <p className="text-xs text-[#555555]">
                Agronomic tasks derived from evidence-backed guidance (sanitation, scouting, IPM, cultural controls).
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-[#F4F6F4] p-1 rounded-lg border border-[#E0E0E0] text-xs">
              {(['ALL', 'PENDING', 'COMPLETED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActionFilter(filter)}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer text-xs font-medium ${
                    actionFilter === filter
                      ? 'bg-white text-[#1B3022] shadow-xs font-semibold'
                      : 'text-[#666666] hover:text-[#1B3022]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {filteredActions.length === 0 ? (
            <div className="bg-white border border-[#E0E0E0] rounded-xl p-12 text-center space-y-3">
              <CheckSquare className="w-10 h-10 text-[#888888] mx-auto" />
              <h3 className="text-sm font-semibold text-[#1B3022]">No tasks in this category</h3>
              <p className="text-xs text-[#666666] max-w-md mx-auto">
                Generate guidance on any field observation to automatically populate tailored agronomic action items.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#E0E0E0] rounded-xl shadow-xs divide-y divide-[#E0E0E0]">
              {filteredActions.map((action) => {
                const isCompleted = action.status === 'COMPLETED';
                return (
                  <div
                    key={action.id}
                    className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                      isCompleted ? 'bg-emerald-50/20' : 'hover:bg-[#F4F6F4]/50'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        onClick={() => handleToggleActionStatus(action.id, action.status)}
                        className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 border ${
                          isCompleted
                            ? 'bg-[#2D5A27] border-[#2D5A27] text-white'
                            : 'border-[#CCCCCC] hover:border-[#2D5A27] bg-white'
                        }`}
                      >
                        {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-xs font-semibold ${isCompleted ? 'line-through text-[#777777]' : 'text-[#1B3022]'}`}>
                            {action.title}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F4F6F4] text-[#555555] border border-[#E0E0E0]">
                            {action.category}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            action.priority === 'HIGH'
                              ? 'bg-red-100 text-red-700'
                              : action.priority === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {action.priority} PRIORITY
                          </span>
                        </div>
                        <p className={`text-xs leading-relaxed ${isCompleted ? 'text-[#888888]' : 'text-[#555555]'}`}>
                          {action.description}
                        </p>
                        {action.dueDate && (
                          <div className="flex items-center gap-1 text-[11px] text-[#777777]">
                            <Calendar className="w-3 h-3 text-[#2D5A27]" />
                            <span>Due: {action.dueDate}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleActionStatus(action.id, action.status)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
                        isCompleted
                          ? 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          : 'bg-[#1B3022] hover:bg-[#2D5A27] text-white'
                      }`}
                    >
                      {isCompleted ? 'Completed' : 'Mark Done'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. FOLLOW-UPS & OUTCOMES VIEW */}
      {activeTab === 'followups' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#1B3022] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#2D5A27]" />
                <span>Field Follow-Up Inspections</span>
              </h2>
              <p className="text-xs text-slate-600">
                Track how plant symptoms change after taking action: Initial Observation → Field Follow-up → Next Scheduled Inspection.
              </p>
            </div>
          </div>

          {followUps.length === 0 ? (
            <div className="bg-white border border-[#E0E0E0] rounded-xl p-12 text-center space-y-3">
              <Calendar className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-semibold text-[#1B3022]">No follow-up inspections scheduled</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Open any crop health case or observation to schedule a field check date and track recovery progress.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {followUps.map((fu) => {
                const isCompleted = fu.status === 'COMPLETED';
                const formattedDate = new Date(fu.scheduledDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const statusLabel = isCompleted
                  ? fu.symptomTrend === 'IMPROVED'
                    ? 'Improving'
                    : fu.symptomTrend === 'WORSENED'
                    ? 'Needs Attention'
                    : 'Monitoring'
                  : 'Scheduled Check';

                return (
                  <div
                    key={fu.id}
                    className={`bg-white rounded-xl border p-4 sm:p-5 shadow-xs transition-all ${
                      isCompleted ? 'border-emerald-200' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#1B3022] flex items-center gap-2">
                            <span>Inspection: {formattedDate}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              statusLabel === 'Improving'
                                ? 'bg-emerald-100 text-emerald-800'
                                : statusLabel === 'Needs Attention'
                                ? 'bg-red-100 text-red-700'
                                : statusLabel === 'Monitoring'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Sequence: Initial Observation → Field Follow-up {isCompleted ? '→ Completed' : '→ Scheduled'}
                          </div>
                        </div>
                      </div>

                      {!isCompleted && (
                        <button
                          onClick={() => handleCompleteFollowUp(fu.id)}
                          className="bg-[#2E7D32] hover:bg-[#256629] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
                        >
                          Complete Inspection
                        </button>
                      )}
                    </div>

                    {fu.notes && (
                      <p className="text-xs text-slate-600 mt-3 italic">
                        Guidance: "{fu.notes}"
                      </p>
                    )}

                    {isCompleted && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 border border-slate-200/60">
                        <div className="flex items-center gap-2 font-semibold text-[#1B3022]">
                          {fu.symptomTrend === 'IMPROVED' && <TrendingDown className="w-4 h-4 text-emerald-600" />}
                          {fu.symptomTrend === 'WORSENED' && <TrendingUp className="w-4 h-4 text-red-600" />}
                          {fu.symptomTrend === 'UNCHANGED' && <Minus className="w-4 h-4 text-slate-600" />}
                          <span>Observed Outcome: {fu.symptomTrend}</span>
                        </div>
                        {fu.farmerNotes && <p className="text-slate-600">{fu.farmerNotes}</p>}
                        {fu.adaptiveNextStep && (
                          <p className="text-emerald-800 font-medium pt-1.5 border-t border-slate-200">
                            <strong>Recommended Next Step:</strong> {fu.adaptiveNextStep}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. DEFAULT VIEW: FARMS & PLOTS + OBSERVATIONS */}
      {(activeTab === 'farms' || activeTab === 'overview' || activeTab === 'observations') && (
        <div className="space-y-6">
          {/* Bento Grid: Farm & Plot Structural Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Farms Bento Column */}
            <div className="md:col-span-4 bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F0F0] mb-3">
                <div>
                  <h3 className="text-xs font-bold text-[#1B3022] uppercase tracking-widest">
                    Farm Holdings ({farms.length})
                  </h3>
                  <p className="text-[11px] text-[#888]">Select to inspect associated plots</p>
                </div>
                <button
                  onClick={() => setIsFarmModalOpen(true)}
                  className="text-[10px] font-bold uppercase tracking-wider text-[#2E7D32] hover:text-[#1B3022] bg-[#F1F8E9] border border-[#C5E1A5] px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> New
                </button>
              </div>

              <div className="space-y-2 flex-1">
                {farms.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No farms registered yet. Click &quot;New&quot; to configure.
                  </div>
                ) : (
                  farms.map((farm) => {
                    const isSelected = farm.id === selectedFarmId;
                    return (
                      <button
                        key={farm.id}
                        onClick={() => handleSelectFarm(farm.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-l-4 border-l-[#4CAF50] border-[#E0E0E0] bg-[#F1F8E9]/50 shadow-xs'
                            : 'border-[#E0E0E0] hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[#1B3022] truncate">{farm.name}</span>
                          <span className="text-[10px] font-mono bg-white border border-[#E0E0E0] px-1.5 py-0.5 rounded text-slate-600">
                            {farm.totalAcreage} acres
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 text-[11px] text-[#666] mt-1">
                          <MapPin className="w-3 h-3 text-[#4CAF50] shrink-0" />
                          <span className="truncate">{farm.taluka}, {farm.district}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Plots Bento Column */}
            <div className="md:col-span-8 bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F0F0] mb-3">
                <div>
                  <h3 className="text-xs font-bold text-[#1B3022] uppercase tracking-widest">
                    Plots & Crop Context: {activeFarm?.name || 'No Farm Selected'}
                  </h3>
                  <p className="text-[11px] text-[#888]">
                    {plots.length} active plot(s) registered for this farm holding
                  </p>
                </div>
                {activeFarm && (
                  <button
                    onClick={() => setIsPlotModalOpen(true)}
                    className="text-[10px] font-bold uppercase tracking-wider text-[#2E7D32] hover:text-[#1B3022] bg-[#F1F8E9] border border-[#C5E1A5] px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Plot
                  </button>
                )}
              </div>

              {plots.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-10 h-10 bg-[#F1F8E9] text-[#4CAF50] rounded-full flex items-center justify-center mb-2">
                    <Sprout className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-[#1B3022]">No plots defined in this farm</h4>
                  <p className="text-[11px] text-[#888] max-w-sm mt-1">
                    Add a plot with crop type, sowing date, and irrigation method to begin optical crop health surveillance.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                  {plots.map((plot) => (
                    <div
                      key={plot.id}
                      className="border border-[#E0E0E0] rounded-lg p-3 bg-[#F8F9FA] hover:bg-white hover:border-[#4CAF50]/50 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[#1B3022] truncate">{plot.name}</span>
                          <span className="text-[10px] font-mono font-bold bg-[#E8F5E9] text-[#2E7D32] px-2 py-0.5 rounded border border-[#C5E1A5]">
                            {plot.currentCrop}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-[11px] text-[#555]">
                          <div className="flex justify-between">
                            <span>Variety:</span>
                            <span className="font-medium text-slate-700">{plot.cropVariety || 'Standard'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Sown:</span>
                            <span className="font-medium text-slate-700">{plot.sowingDate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Irrigation:</span>
                            <span className="font-medium text-slate-700">{plot.irrigationType}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setIsObsModalOpen(true);
                        }}
                        className="mt-3 w-full bg-white hover:bg-[#F1F8E9] border border-[#C5E1A5] text-[#2E7D32] text-[11px] font-bold py-1.5 px-2 rounded transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Inspect Foliage</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Field Observations Bento Grid */}
          <div className="bg-white border border-[#E0E0E0] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F0F0]">
              <div>
                <h3 className="text-xs font-bold text-[#1B3022] uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#4CAF50]" />
                  <span>Recent Field Observations ({observations.length})</span>
                </h3>
                <p className="text-[11px] text-[#888]">
                  Optical health captures and AI-assisted decision records
                </p>
              </div>
            </div>

            {observations.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <Camera className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">No field observations recorded yet</p>
                <p className="text-[11px] text-slate-500">Record a photograph of your crop foliage to trigger AI diagnostics and risk evaluation.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E0E0E0]">
                {observations.map((obs) => (
                  <div
                    key={obs.id}
                    onClick={() => onSelectObservation(obs)}
                    className="py-3 flex items-center justify-between gap-4 hover:bg-[#F8F9FA] px-2 rounded-lg transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden border border-[#E0E0E0] shrink-0">
                        <img
                          src={obs.imageUrl || `/api/observations/${obs.id}/image`}
                          alt="Crop foliage"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            (e.target as any).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%234CAF50" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10H12V2z"/></svg>';
                          }}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-[#1B3022] truncate">
                            CF-{obs.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="text-xs font-semibold text-slate-700 truncate">
                            • {obs.cropName} ({obs.plotName})
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            obs.status === 'ASSESSED'
                              ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C5E1A5]'
                              : obs.status === 'NEEDS_REVIEW'
                              ? 'bg-[#FFF3E0] text-[#F27D26] border border-[#FFE0B2]'
                              : 'bg-[#F8F9FA] text-[#666] border border-[#E0E0E0]'
                          }`}>
                            {obs.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-[#666] mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span>{obs.growthStage}</span>
                          <span>•</span>
                          <span>{obs.plantPart}</span>
                          <span>•</span>
                          <span className="text-slate-700 font-medium">{obs.severityEstimate}</span>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-1">
                          {obs.symptomTags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="text-[10px] font-mono bg-white border border-[#E0E0E0] text-[#555] px-1.5 py-0.2 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg group-hover:bg-emerald-100 transition-colors">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>View Assessment</span>
                      </span>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#1B3022] transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <FarmModal
        isOpen={isFarmModalOpen}
        onClose={() => setIsFarmModalOpen(false)}
        onFarmCreated={handleFarmCreated}
      />

      {activeFarm && (
        <PlotModal
          isOpen={isPlotModalOpen}
          onClose={() => setIsPlotModalOpen(false)}
          farms={farms}
          selectedFarmId={activeFarm.id}
          onPlotCreated={handlePlotCreated}
        />
      )}

      {farms.length > 0 && plots.length > 0 && (
        <ObservationModal
          isOpen={isObsModalOpen}
          onClose={() => setIsObsModalOpen(false)}
          farms={farms}
          plots={plots}
          onObservationCreated={handleObservationCreated}
        />
      )}
    </div>
  );
};
