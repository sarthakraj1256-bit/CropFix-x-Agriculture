/**
 * CropFix - Follow-Up Management & Outcome Tracking Modal (Phase 8)
 * Bento Grid design theme with Side-by-Side Photo Comparison & Adaptive Guidance
 */

import React, { useState } from 'react';
import type { FollowUpRecord, SymptomTrend, Observation } from '../types/index.js';
import { 
  Calendar, 
  Clock, 
  Upload, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ArrowRight, 
  Sparkles, 
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Loader2,
  ShieldAlert
} from 'lucide-react';

interface FollowUpModalProps {
  observation: Observation;
  followUpToComplete?: FollowUpRecord | null;
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onSuccess: (updatedFollowUp: FollowUpRecord) => void;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({
  observation,
  followUpToComplete,
  isOpen,
  token,
  onClose,
  onSuccess,
}) => {
  const isCompleting = Boolean(followUpToComplete);

  // Schedule state
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [scheduleNotes, setScheduleNotes] = useState('');

  // Complete state
  const [symptomTrend, setSymptomTrend] = useState<SymptomTrend>('IMPROVED');
  const [farmerNotes, setFarmerNotes] = useState('');
  const [actionEffectiveness, setActionEffectiveness] = useState('');
  const [followupImagePreview, setFollowupImagePreview] = useState<string | null>(null);

  // Status & error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Quick Date Selection
  const setQuickDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setScheduledDate(d.toISOString().split('T')[0]);
  };

  // Image upload handling
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size exceeds 5MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFollowupImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Schedule Follow-Up
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDate) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/observations/${observation.id}/follow-ups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          scheduledDate,
          notes: scheduleNotes.trim() || undefined,
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to schedule follow-up');

      onSuccess(json.data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setLoading(false);
    }
  };

  // Submit Complete Follow-Up
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpToComplete) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/follow-ups/${followUpToComplete.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          symptomTrend,
          farmerNotes: farmerNotes.trim() || undefined,
          actionEffectiveness: actionEffectiveness.trim() || undefined,
          followupImageData: followupImagePreview || undefined,
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to complete follow-up');

      onSuccess(json.data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-xl max-w-2xl w-full my-8 overflow-hidden">
        {/* Header */}
        <div className="bg-[#1B3022] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-white/10 text-white">
              <Calendar className="w-5 h-5 text-[#4CAF50]" />
            </div>
            <div>
              <h3 className="text-base font-semibold">
                {isCompleting ? 'Complete Field Inspection Follow-Up' : 'Schedule Crop Health Follow-Up'}
              </h3>
              <p className="text-xs text-white/70">
                {observation.cropName} • Plot observation {observation.id.slice(0, 10)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isCompleting ? (
            /* SCHEDULE FORM */
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B3022] mb-1.5">
                  Inspection Target Date
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full text-xs px-3.5 py-2.5 bg-[#F4F6F4] rounded-lg border border-[#CCCCCC] focus:outline-hidden focus:border-[#2D5A27]"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={() => setQuickDate(2)}
                    className="px-2.5 py-1 text-xs bg-[#F4F6F4] hover:bg-[#E0E0E0] text-[#1B3022] rounded-md border border-[#CCCCCC] transition-colors cursor-pointer"
                  >
                    +2 days (Check spread)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate(3)}
                    className="px-2.5 py-1 text-xs bg-[#F4F6F4] hover:bg-[#E0E0E0] text-[#1B3022] rounded-md border border-[#CCCCCC] transition-colors cursor-pointer"
                  >
                    +3 days (Evaluate IPM action)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate(7)}
                    className="px-2.5 py-1 text-xs bg-[#F4F6F4] hover:bg-[#E0E0E0] text-[#1B3022] rounded-md border border-[#CCCCCC] transition-colors cursor-pointer"
                  >
                    +7 days (Weekly check)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B3022] mb-1.5">
                  Inspection Objective / Field Notes
                </label>
                <textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="e.g. Inspect lower leaves to see if spots have dried after aeration and sanitation..."
                  rows={3}
                  className="w-full text-xs p-3 bg-[#F4F6F4] rounded-lg border border-[#CCCCCC] focus:outline-hidden focus:border-[#2D5A27]"
                />
              </div>

              <div className="p-3 bg-[#F4F6F4] rounded-lg border border-[#E0E0E0] text-xs text-[#555555] flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#2D5A27] shrink-0 mt-0.5" />
                <span>
                  CropFix tracks your case longitudinally. Scheduled inspections ensure timely field verification without leaving disease spread unnoticed.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E0E0E0]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#555555] hover:bg-[#F4F6F4] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#1B3022] hover:bg-[#2D5A27] rounded-lg shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Schedule Follow-Up</span>
                </button>
              </div>
            </form>
          ) : (
            /* COMPLETE FOLLOW-UP FORM */
            <form onSubmit={handleCompleteSubmit} className="space-y-5">
              {/* Symptom Trend Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#1B3022] mb-2">
                  What has changed since the last observation?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-colors ${
                      symptomTrend === 'IMPROVED'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : 'border-[#E0E0E0] hover:bg-[#F4F6F4]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="symptomTrend"
                      value="IMPROVED"
                      checked={symptomTrend === 'IMPROVED'}
                      onChange={() => setSymptomTrend('IMPROVED')}
                      className="mt-0.5 text-[#2D5A27]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                        <span>IMPROVED</span>
                      </div>
                      <p className="text-[11px] text-[#555555] mt-0.5">
                        Lesions dried or contained; healthy new shoot/leaf growth.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-colors ${
                      symptomTrend === 'UNCHANGED'
                        ? 'border-stone-500 bg-stone-50 text-stone-900'
                        : 'border-[#E0E0E0] hover:bg-[#F4F6F4]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="symptomTrend"
                      value="UNCHANGED"
                      checked={symptomTrend === 'UNCHANGED'}
                      onChange={() => setSymptomTrend('UNCHANGED')}
                      className="mt-0.5 text-[#2D5A27]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <Minus className="w-3.5 h-3.5 text-stone-600" />
                        <span>UNCHANGED</span>
                      </div>
                      <p className="text-[11px] text-[#555555] mt-0.5">
                        Symptoms stabilized; no spread observed, but not yet cleared.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-colors ${
                      symptomTrend === 'WORSENED'
                        ? 'border-red-500 bg-red-50 text-red-900'
                        : 'border-[#E0E0E0] hover:bg-[#F4F6F4]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="symptomTrend"
                      value="WORSENED"
                      checked={symptomTrend === 'WORSENED'}
                      onChange={() => setSymptomTrend('WORSENED')}
                      className="mt-0.5 text-[#2D5A27]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <TrendingUp className="w-3.5 h-3.5 text-red-600" />
                        <span>WORSENED</span>
                      </div>
                      <p className="text-[11px] text-[#555555] mt-0.5">
                        Spots enlarged, yellowing spread to upper foliage, or defoliation.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-colors ${
                      symptomTrend === 'NEW_SYMPTOMS'
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : 'border-[#E0E0E0] hover:bg-[#F4F6F4]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="symptomTrend"
                      value="NEW_SYMPTOMS"
                      checked={symptomTrend === 'NEW_SYMPTOMS'}
                      onChange={() => setSymptomTrend('NEW_SYMPTOMS')}
                      className="mt-0.5 text-[#2D5A27]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>NEW SYMPTOMS</span>
                      </div>
                      <p className="text-[11px] text-[#555555] mt-0.5">
                        Secondary pests, wilting, or distinct new lesions noticed.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Side-by-Side Visual Comparison Container */}
              <div className="bg-[#F4F6F4] p-4 rounded-xl border border-[#E0E0E0] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[#1B3022] flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-[#2D5A27]" />
                    <span>Visual Progress Comparison (Before vs Today)</span>
                  </h4>
                  <span className="text-[11px] text-[#777777]">Optional Photo Evidence</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Before (Initial Observation) */}
                  <div className="bg-white rounded-lg border border-[#CCCCCC] p-2 flex flex-col items-center">
                    <span className="text-[10px] font-semibold text-[#555555] mb-1.5">
                      INITIAL OBSERVATION ({new Date(observation.createdAt).toLocaleDateString()})
                    </span>
                    <div className="w-full h-36 rounded-md overflow-hidden bg-[#E0E0E0] flex items-center justify-center">
                      {observation.imageId ? (
                        <img
                          src={`/api/observations/${observation.id}/image`}
                          alt="Initial symptom"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-[#888888]">No photo recorded</span>
                      )}
                    </div>
                  </div>

                  {/* After (Today's Follow-up) */}
                  <div className="bg-white rounded-lg border border-[#CCCCCC] p-2 flex flex-col items-center">
                    <span className="text-[10px] font-semibold text-[#555555] mb-1.5">
                      TODAY'S FOLLOW-UP PHOTO
                    </span>
                    <div className="w-full h-36 rounded-md overflow-hidden bg-[#E0E0E0] relative flex items-center justify-center border border-dashed border-[#AAAAAA]">
                      {followupImagePreview ? (
                        <>
                          <img
                            src={followupImagePreview}
                            alt="Followup symptom"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setFollowupImagePreview(null)}
                            className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black text-white rounded-full cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-3 cursor-pointer text-center">
                          <Upload className="w-5 h-5 text-[#2D5A27] mb-1" />
                          <span className="text-xs font-semibold text-[#1B3022]">Upload Field Photo</span>
                          <span className="text-[10px] text-[#777777]">Tap to snap or select image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Safety Disclaimer */}
                <div className="text-[11px] text-[#666666] bg-white p-2 rounded-md border border-[#E0E0E0] flex items-start gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#2D5A27] shrink-0 mt-0.5" />
                  <span>
                    Side-by-side photographic review documents symptom evolution. Visual comparison assists monitoring and does not replace certified agronomic laboratory testing.
                  </span>
                </div>
              </div>

              {/* Farmer Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#1B3022] mb-1">
                  Field Observations & Action Effectiveness
                </label>
                <textarea
                  value={farmerNotes}
                  onChange={(e) => setFarmerNotes(e.target.value)}
                  placeholder="Describe current crop appearance, leaf color, whether pruning or irrigation adjustments helped..."
                  rows={3}
                  required
                  className="w-full text-xs p-3 bg-[#F4F6F4] rounded-lg border border-[#CCCCCC] focus:outline-hidden focus:border-[#2D5A27]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E0E0E0]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#555555] hover:bg-[#F4F6F4] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#1B3022] hover:bg-[#2D5A27] rounded-lg shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Inspection Outcome</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
