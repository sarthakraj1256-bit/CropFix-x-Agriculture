/**
 * CropFix - Case History & Longitudinal Tracking View (Phase 9)
 * Bento Grid design theme with chronological event timeline and evidence-based insights
 */

import React, { useState, useEffect } from 'react';
import type { CropCase, CaseTimelineEvent, CaseInsights, CaseStatus } from '../types/index.js';
import { 
  History, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft, 
  Sparkles, 
  Camera, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  HelpCircle,
  ListTodo,
  Check,
  RefreshCw,
  Eye,
  Loader2,
  FolderOpen
} from 'lucide-react';

interface CaseDetailViewProps {
  caseId: string;
  token: string;
  onBack: () => void;
  onSelectObservation?: (obsId: string) => void;
}

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({
  caseId,
  token,
  onBack,
  onSelectObservation,
}) => {
  const [cropCase, setCropCase] = useState<CropCase | null>(null);
  const [timeline, setTimeline] = useState<CaseTimelineEvent[]>([]);
  const [insights, setInsights] = useState<CaseInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolution modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  // Event filter state
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');

  const fetchCaseData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [caseRes, timeRes, insRes] = await Promise.all([
        fetch(`/api/cases/${caseId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/cases/${caseId}/timeline`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/cases/${caseId}/insights`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const caseJson = await caseRes.json();
      const timeJson = await timeRes.json();
      const insJson = await insRes.json();

      if (!caseJson.success) throw new Error(caseJson.error || 'Failed to load case');
      setCropCase(caseJson.data);

      if (timeJson.success) setTimeline(timeJson.data);
      if (insJson.success) setInsights(insJson.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching case history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaseData();
  }, [caseId]);

  const handleResolveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setResolving(true);
      const res = await fetch(`/api/cases/${caseId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: resolveNotes.trim() }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to resolve case');

      setCropCase(json.data);
      setShowResolveModal(false);
      setResolveNotes('');
      fetchCaseData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resolve case');
    } finally {
      setResolving(false);
    }
  };

  const handleReopenCase = async () => {
    try {
      setResolving(true);
      const res = await fetch(`/api/cases/${caseId}/reopen`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to reopen case');

      setCropCase(json.data);
      fetchCaseData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reopen case');
    } finally {
      setResolving(false);
    }
  };

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-100 text-blue-800 border border-blue-200">OPEN</span>;
      case 'MONITORING':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-100 text-amber-800 border border-amber-200">MONITORING</span>;
      case 'IMPROVING':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">IMPROVING</span>;
      case 'WORSENING':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-100 text-rose-800 border border-rose-200">WORSENING</span>;
      case 'RESOLVED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-stone-100 text-stone-700 border border-stone-300">RESOLVED</span>;
      case 'NEEDS_REVIEW':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-purple-100 text-purple-800 border border-purple-200">EXPERT REVIEW QUEUED</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'OBSERVATION':
        return <Camera className="w-4 h-4 text-[#2D5A27]" />;
      case 'ASSESSMENT':
        return <Sparkles className="w-4 h-4 text-emerald-600" />;
      case 'RISK_EVALUATION':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'GUIDANCE_GENERATED':
        return <ShieldCheck className="w-4 h-4 text-blue-600" />;
      case 'ACTION_COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'FOLLOWUP_SCHEDULED':
        return <Calendar className="w-4 h-4 text-purple-600" />;
      case 'FOLLOWUP_COMPLETED':
        return <TrendingUp className="w-4 h-4 text-emerald-600" />;
      case 'CASE_RESOLVED':
        return <Check className="w-4 h-4 text-stone-600" />;
      default:
        return <Clock className="w-4 h-4 text-[#555555]" />;
    }
  };

  const filteredTimeline = timeline.filter(evt => {
    if (eventTypeFilter === 'ALL') return true;
    if (eventTypeFilter === 'OBSERVATIONS') return evt.type === 'OBSERVATION';
    if (eventTypeFilter === 'ACTIONS') return evt.type === 'ACTION_COMPLETED' || evt.type === 'GUIDANCE_GENERATED';
    if (eventTypeFilter === 'FOLLOWUPS') return evt.type === 'FOLLOWUP_SCHEDULED' || evt.type === 'FOLLOWUP_COMPLETED';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-[#E0E0E0]">
        <div className="flex items-center gap-2 text-sm text-[#555555]">
          <Loader2 className="w-5 h-5 animate-spin text-[#2D5A27]" />
          <span>Loading case timeline and longitudinal insights...</span>
        </div>
      </div>
    );
  }

  if (error || !cropCase) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-[#E0E0E0] space-y-4">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
        <h3 className="text-base font-semibold text-[#1B3022]">Unable to Load Case</h3>
        <p className="text-xs text-[#666666] max-w-md mx-auto">{error || 'Case record not found'}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B3022] hover:bg-[#2D5A27] rounded-lg cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B3022] hover:text-[#2D5A27] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Field Cases</span>
        </button>

        <div className="flex items-center gap-2">
          {cropCase.status === 'RESOLVED' ? (
            <button
              onClick={handleReopenCase}
              disabled={resolving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1B3022] bg-[#F4F6F4] hover:bg-[#E0E0E0] border border-[#CCCCCC] rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reopen Case</span>
            </button>
          ) : (
            <button
              onClick={() => setShowResolveModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#2D5A27] hover:bg-[#1B3022] rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark Case as Resolved</span>
            </button>
          )}
        </div>
      </div>

      {/* Case Header Bento Cell */}
      <div className="bg-white rounded-xl border border-[#E0E0E0] p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-xs font-mono text-[#777777]">{cropCase.id}</span>
              {getStatusBadge(cropCase.status)}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#F4F6F4] text-[#1B3022] border border-[#E0E0E0]">
                {cropCase.cropName}
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#1B3022]">{cropCase.title}</h2>
            <p className="text-xs text-[#555555] mt-1">
              Started {new Date(cropCase.createdAt).toLocaleDateString()} • Last activity {new Date(cropCase.updatedAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#F4F6F4] p-3 rounded-lg border border-[#E0E0E0] self-start lg:self-center">
            <div>
              <p className="text-[10px] text-[#777777] uppercase font-semibold">Status / Risk</p>
              <p className="text-xs font-bold text-[#1B3022]">{cropCase.riskSummary || cropCase.status}</p>
            </div>
            <div className="h-6 w-px bg-[#CCCCCC]" />
            <div>
              <p className="text-[10px] text-[#777777] uppercase font-semibold">Total Observations</p>
              <p className="text-xs font-bold text-[#1B3022]">{cropCase.observationCount || 1}</p>
            </div>
          </div>
        </div>

        {cropCase.resolutionNotes && (
          <div className="mt-4 p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800">
            <strong className="text-stone-900">Resolution Notes: </strong>
            <span>{cropCase.resolutionNotes}</span>
          </div>
        )}
      </div>

      {/* Bento Grid: Insights & Next Action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Longitudinal Intelligence Cell (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E0E0E0] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E0E0E0] pb-3">
            <h3 className="text-sm font-semibold text-[#1B3022] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2D5A27]" />
              <span>Longitudinal Trajectory & Insights</span>
            </h3>
            <span className="text-[11px] text-[#777777]">
              {insights?.daysActive || 1} day(s) monitoring period
            </span>
          </div>

          {!insights || !insights.hasSufficientData ? (
            /* Insufficient Data State */
            <div className="p-6 text-center bg-[#F4F6F4] rounded-lg border border-dashed border-[#CCCCCC] space-y-2">
              <History className="w-8 h-8 text-[#888888] mx-auto" />
              <h4 className="text-xs font-semibold text-[#1B3022]">Not Enough History Yet</h4>
              <p className="text-xs text-[#666666] max-w-md mx-auto">
                CropFix requires at least 2 distinct observations or 1 completed follow-up to mathematically calculate symptom trajectory and treatment effectiveness.
              </p>
              <div className="pt-2 text-xs font-medium text-[#2D5A27]">
                Next Step: Follow the scheduled action plan and record your field inspection.
              </div>
            </div>
          ) : (
            /* Computed Insights */
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#F4F6F4] rounded-lg border border-[#E0E0E0]">
                  <span className="text-[10px] text-[#777777] uppercase font-semibold">Active Days</span>
                  <p className="text-base font-bold text-[#1B3022] mt-0.5">{insights.daysActive}</p>
                </div>
                <div className="p-3 bg-[#F4F6F4] rounded-lg border border-[#E0E0E0]">
                  <span className="text-[10px] text-[#777777] uppercase font-semibold">Field Inspections</span>
                  <p className="text-base font-bold text-[#1B3022] mt-0.5">{insights.totalObservations}</p>
                </div>
                <div className="p-3 bg-[#F4F6F4] rounded-lg border border-[#E0E0E0]">
                  <span className="text-[10px] text-[#777777] uppercase font-semibold">Actions Done</span>
                  <p className="text-base font-bold text-emerald-700 mt-0.5">{insights.completedActionsCount}</p>
                </div>
                <div className="p-3 bg-[#F4F6F4] rounded-lg border border-[#E0E0E0]">
                  <span className="text-[10px] text-[#777777] uppercase font-semibold">Trajectory</span>
                  <p className="text-xs font-bold text-[#1B3022] mt-1">{insights.latestSymptomTrend || 'STABLE'}</p>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-1">
                <p className="text-xs font-semibold text-[#1B3022]">Field Assessment Summary</p>
                <p className="text-xs text-[#444444] leading-relaxed">{insights.trendSummary}</p>
              </div>

              <div className="p-3 bg-[#F4F6F4] border border-[#E0E0E0] rounded-lg space-y-1">
                <p className="text-xs font-semibold text-[#1B3022]">Suggested Agronomic Action</p>
                <p className="text-xs text-[#555555] leading-relaxed">{insights.suggestedNextStep}</p>
              </div>
            </div>
          )}
        </div>

        {/* Immediate Next Step Bento Cell (1 Col) */}
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="border-b border-[#E0E0E0] pb-3 mb-4">
              <h3 className="text-sm font-semibold text-[#1B3022] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#2D5A27]" />
                <span>Next Immediate Action</span>
              </h3>
            </div>

            <div className="space-y-3">
              {cropCase.status === 'RESOLVED' ? (
                <div className="p-4 bg-stone-50 rounded-lg text-center space-y-1.5">
                  <CheckCircle2 className="w-6 h-6 text-stone-600 mx-auto" />
                  <p className="text-xs font-semibold text-stone-800">Case is Closed</p>
                  <p className="text-[11px] text-stone-500">
                    No active actions pending. If symptoms re-emerge, reopen the case or submit a new observation.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-[#F4F6F4] rounded-lg border border-[#2D5A27]/20 space-y-2">
                  <span className="text-[10px] font-bold text-[#2D5A27] uppercase tracking-wide">
                    Action Plan Priority
                  </span>
                  <h4 className="text-xs font-semibold text-[#1B3022]">
                    Field Scouting & Sanitization Check
                  </h4>
                  <p className="text-[11px] text-[#555555] leading-relaxed">
                    Check if infected leaves have been buried or discarded away from irrigation channels to prevent spore spread.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#E0E0E0]">
            <p className="text-[11px] text-[#777777] text-center">
              CropFix Case Engine • SIH26131 Longitudinal Tracking
            </p>
          </div>
        </div>
      </div>

      {/* Chronological Timeline Bento Cell */}
      <div className="bg-white rounded-xl border border-[#E0E0E0] p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0E0E0] pb-4">
          <div>
            <h3 className="text-base font-semibold text-[#1B3022] flex items-center gap-2">
              <History className="w-5 h-5 text-[#2D5A27]" />
              <span>Chronological Field Event Timeline</span>
            </h3>
            <p className="text-xs text-[#555555]">
              Unified record of observations, AI assessments, actions, and follow-ups ({filteredTimeline.length} events)
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 bg-[#F4F6F4] p-1 rounded-lg border border-[#E0E0E0] text-xs">
            {['ALL', 'OBSERVATIONS', 'ACTIONS', 'FOLLOWUPS'].map((tab) => (
              <button
                key={tab}
                onClick={() => setEventTypeFilter(tab)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs font-medium ${
                  eventTypeFilter === tab
                    ? 'bg-white text-[#1B3022] shadow-xs font-semibold'
                    : 'text-[#666666] hover:text-[#1B3022]'
                }`}
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline Events List */}
        <div className="relative border-l-2 border-[#E0E0E0] ml-4 space-y-6 py-2">
          {filteredTimeline.map((evt) => (
            <div key={evt.id} className="relative pl-6 group">
              {/* Event Marker Node */}
              <div className="absolute -left-[17px] top-1 w-8 h-8 rounded-full bg-white border-2 border-[#2D5A27] flex items-center justify-center shadow-xs">
                {getEventIcon(evt.type)}
              </div>

              {/* Event Card */}
              <div className="bg-[#F4F6F4] p-4 rounded-xl border border-[#E0E0E0] hover:border-[#2D5A27]/40 transition-colors space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#1B3022]">{evt.title}</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white text-[#555555] border border-[#CCCCCC]">
                      {evt.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#777777]">
                    {new Date(evt.timestamp).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-[#555555] leading-relaxed">
                  {evt.description}
                </p>

                {/* Event-specific payload links */}
                {evt.type === 'OBSERVATION' && onSelectObservation && (
                  <button
                    onClick={() => onSelectObservation(evt.referenceId)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#2D5A27] hover:underline cursor-pointer pt-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Full Observation & AI Assessment</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Case Resolution Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-[#E0E0E0] shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-semibold text-[#1B3022]">Mark Case as Resolved</h3>
            <p className="text-xs text-[#555555]">
              Document why this crop health issue is considered resolved (e.g. plot cleared, lesions stopped, or harvest completed).
            </p>

            <form onSubmit={handleResolveCase} className="space-y-3">
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                placeholder="Resolution notes / final field observations..."
                rows={3}
                required
                className="w-full text-xs p-3 bg-[#F4F6F4] rounded-lg border border-[#CCCCCC] focus:outline-hidden focus:border-[#2D5A27]"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-3 py-1.5 text-xs text-[#555555] hover:bg-[#F4F6F4] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1B3022] hover:bg-[#2D5A27] rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {resolving ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
