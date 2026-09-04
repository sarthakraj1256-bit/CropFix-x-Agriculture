/**
 * CropFix - Guidance & Action Management Component (Phase 7)
 * Bento Grid design theme with strict agricultural safety adherence
 */

import React, { useState, useEffect } from 'react';
import type { GuidanceRecord, ActionItem, ActionItemStatus, Observation, RiskAssessmentRecord } from '../types/index.js';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  Plus, 
  Check, 
  ListTodo, 
  BookOpen, 
  Calendar,
  Sparkles,
  Loader2
} from 'lucide-react';

interface GuidanceActionPanelProps {
  observation: Observation;
  riskAssessment?: RiskAssessmentRecord;
  token: string;
  onFollowUpScheduled?: () => void;
}

export const GuidanceActionPanel: React.FC<GuidanceActionPanelProps> = ({
  observation,
  riskAssessment,
  token,
}) => {
  const [guidance, setGuidance] = useState<GuidanceRecord[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom action form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Load existing guidance & actions
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [guidRes, actRes] = await Promise.all([
        fetch(`/api/observations/${observation.id}/guidance`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/observations/${observation.id}/actions`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const guidJson = await guidRes.json();
      const actJson = await actRes.json();

      if (guidJson.success && guidJson.data.length > 0) {
        setGuidance(guidJson.data);
      }
      if (actJson.success) {
        setActions(actJson.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load guidance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [observation.id]);

  // Generate guidance if none exists
  const handleGenerateGuidance = async () => {
    try {
      setGenerating(true);
      setError(null);

      const res = await fetch(`/api/observations/${observation.id}/guidance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to generate guidance');

      setGuidance(json.data.guidanceRecords);
      setActions(json.data.actionPlan);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate guidance');
    } finally {
      setGenerating(false);
    }
  };

  // Toggle action completion status
  const handleToggleAction = async (action: ActionItem) => {
    const nextStatus: ActionItemStatus = action.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    
    // Optimistic UI update
    setActions(prev => prev.map(a => a.id === action.id ? { 
      ...a, 
      status: nextStatus, 
      completedAt: nextStatus === 'COMPLETED' ? new Date().toISOString() : undefined 
    } : a));

    try {
      const res = await fetch(`/api/actions/${action.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to update action');
    } catch {
      // Revert on failure
      setActions(prev => prev.map(a => a.id === action.id ? action : a));
    }
  };

  // Create custom action
  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    try {
      setSubmittingAction(true);
      const res = await fetch(`/api/observations/${observation.id}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim(),
          category: 'FARMER_TASK',
          priority: newPriority,
          dueDate: newDueDate || undefined,
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create action');

      setActions(prev => [...prev, json.data]);
      setNewTitle('');
      setNewDesc('');
      setNewDueDate('');
      setShowAddForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add action');
    } finally {
      setSubmittingAction(false);
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'URGENT':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-red-100 text-red-800 border border-red-200">URGENT</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-amber-100 text-amber-800 border border-amber-200">HIGH</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-stone-100 text-stone-700 border border-stone-200">LOW</span>;
      case 'NORMAL':
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">NORMAL</span>;
    }
  };

  const formatCategory = (cat: string) => {
    return cat.replace(/_/g, ' ');
  };

  return (
    <div className="space-y-6">
      {/* Guidance Header Bento Cell */}
      <div className="bg-white rounded-xl border border-[#E0E0E0] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0E0E0] pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#1B3022]/10 text-[#1B3022]">
              <ShieldCheck className="w-5 h-5 text-[#2D5A27]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1B3022]">Evidence-Aware Guidance & Action Plan</h3>
              <p className="text-xs text-[#555555]">Integrated Pest Management (IPM), field scouting, and preventive cultural practices</p>
            </div>
          </div>

          {guidance.length === 0 && !loading && (
            <button
              id="btn-generate-guidance"
              onClick={handleGenerateGuidance}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#1B3022] hover:bg-[#2D5A27] rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Generate Safe Guidance</span>
            </button>
          )}
        </div>

        {/* Absolute Safety Banner */}
        <div className="mt-4 p-3 bg-[#F4F6F4] rounded-lg border border-[#E0E0E0] flex items-start gap-2.5">
          <BookOpen className="w-4 h-4 text-[#2D5A27] shrink-0 mt-0.5" />
          <p className="text-xs text-[#444444] leading-relaxed">
            <strong className="text-[#1B3022]">Agricultural Safety Standard:</strong> CropFix promotes responsible monitoring, sanitation, and official extension consultation. Specific pesticide dosages and tank mixtures must always be verified with your local Krishi Vigyan Kendra (KVK) or registered agronomist.
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-[#E0E0E0]">
          <div className="flex items-center gap-2 text-sm text-[#666666]">
            <Loader2 className="w-4 h-4 animate-spin text-[#2D5A27]" />
            <span>Loading guidance and action checklist...</span>
          </div>
        </div>
      ) : guidance.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-dashed border-[#CCCCCC]">
          <ListTodo className="w-8 h-8 text-[#999999] mx-auto mb-2" />
          <p className="text-sm font-medium text-[#333333]">No guidance records generated yet</p>
          <p className="text-xs text-[#777777] mt-1 max-w-md mx-auto">
            Generate an evidence-aware decision support package to obtain prioritized cultural recommendations and an actionable farmer checklist.
          </p>
          <button
            onClick={handleGenerateGuidance}
            disabled={generating}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B3022] hover:bg-[#2D5A27] rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Generate Actionable Guidance</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Guidance Recommendations */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-[#1B3022] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2D5A27]" />
              <span>Recommended Practices ({guidance.length})</span>
            </h4>

            {guidance.map((g) => (
              <div 
                key={g.id} 
                className="bg-white rounded-xl border border-[#E0E0E0] p-4 shadow-xs space-y-3 hover:border-[#2D5A27]/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-[#F4F6F4] text-[#1B3022] border border-[#E0E0E0]">
                    {formatCategory(g.category)}
                  </span>
                  {getPriorityBadge(g.priority)}
                </div>

                <p className="text-sm font-medium text-[#1B3022] leading-snug">
                  {g.recommendation}
                </p>

                <div className="text-xs text-[#555555] bg-[#F4F6F4] p-2.5 rounded-lg border border-[#E0E0E0]/60 space-y-1">
                  <div>
                    <strong className="text-[#333333]">Rationale: </strong>
                    <span>{g.rationale}</span>
                  </div>
                  {g.sourceReference && (
                    <div className="text-[11px] text-[#666666] pt-0.5">
                      <strong>Source: </strong> {g.sourceReference}
                    </div>
                  )}
                </div>

                {g.safetyNote && (
                  <div className="text-xs text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200/80 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>{g.safetyNote}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Column 2: Farmer Action Checklist */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#1B3022] flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-[#2D5A27]" />
                <span>Action Plan Tasks ({actions.filter(a => a.status === 'COMPLETED').length}/{actions.length})</span>
              </h4>

              <button
                id="btn-add-action"
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2D5A27] hover:text-[#1B3022] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddForm ? 'Cancel' : 'Add Custom Task'}</span>
              </button>
            </div>

            {/* Custom Action Form */}
            {showAddForm && (
              <form onSubmit={handleCreateAction} className="bg-[#F4F6F4] p-4 rounded-xl border border-[#2D5A27]/30 space-y-3">
                <h5 className="text-xs font-semibold text-[#1B3022]">Add New Field Task</h5>
                <div>
                  <input
                    type="text"
                    placeholder="Task title (e.g. Disinfect pruning shears)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-[#CCCCCC] focus:outline-hidden focus:border-[#2D5A27]"
                  />
                </div>
                <div>
                  <textarea
                    placeholder="Description or specific instructions..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={2}
                    required
                    className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-[#CCCCCC] focus:outline-hidden focus:border-[#2D5A27]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#666666] block mb-0.5">Due Date</label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 bg-white rounded-lg border border-[#CCCCCC] focus:outline-hidden focus:border-[#2D5A27]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#666666] block mb-0.5">Priority</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as any)}
                      className="w-full text-xs px-2.5 py-1.5 bg-white rounded-lg border border-[#CCCCCC] focus:outline-hidden focus:border-[#2D5A27]"
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-3 py-1.5 bg-[#1B3022] hover:bg-[#2D5A27] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {submittingAction ? 'Adding...' : 'Save Task'}
                  </button>
                </div>
              </form>
            )}

            {/* Actions List */}
            <div className="space-y-2.5">
              {actions.map((act) => {
                const isCompleted = act.status === 'COMPLETED';
                return (
                  <div
                    key={act.id}
                    className={`bg-white rounded-xl border p-3.5 transition-all flex items-start gap-3 shadow-xs ${
                      isCompleted 
                        ? 'border-emerald-200 bg-emerald-50/30 opacity-80' 
                        : 'border-[#E0E0E0] hover:border-[#2D5A27]/40'
                    }`}
                  >
                    <button
                      id={`toggle-action-${act.id}`}
                      onClick={() => handleToggleAction(act)}
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                        isCompleted
                          ? 'bg-[#2D5A27] border-[#2D5A27] text-white'
                          : 'border-[#CCCCCC] bg-white hover:border-[#2D5A27]'
                      }`}
                      title={isCompleted ? 'Mark as pending' : 'Mark as completed'}
                    >
                      {isCompleted && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-semibold ${isCompleted ? 'line-through text-[#777777]' : 'text-[#1B3022]'}`}>
                          {act.title}
                        </p>
                        {getPriorityBadge(act.priority)}
                      </div>

                      <p className={`text-xs mt-1 leading-relaxed ${isCompleted ? 'text-[#888888]' : 'text-[#555555]'}`}>
                        {act.description}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-[11px] text-[#777777]">
                        {act.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#2D5A27]" />
                            <span>Due: {act.dueDate}</span>
                          </span>
                        )}
                        {isCompleted && act.completedAt && (
                          <span className="flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Done {new Date(act.completedAt).toLocaleDateString()}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
