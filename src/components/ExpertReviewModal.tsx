/**
 * CropFix - Expert Agronomist Human Validation Modal
 * SIH26131: Early detection and management of crop diseases and pest infestations
 * Phase 10 Implementation
 */

import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Send, 
  Check, 
  Sparkles,
  HelpCircle,
  FileText
} from 'lucide-react';
import type { 
  Observation, 
  AssessmentRecord, 
  RiskAssessmentRecord, 
  ExpertAgreement, 
  ConfidenceLevel, 
  ExpertReview 
} from '../types/index.js';

interface ExpertReviewModalProps {
  observation: Observation;
  existingReview?: ExpertReview | null;
  aiAssessment?: AssessmentRecord | null;
  riskAssessment?: RiskAssessmentRecord | null;
  token?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (review: ExpertReview) => void;
}

export const ExpertReviewModal: React.FC<ExpertReviewModalProps> = ({
  observation,
  existingReview,
  aiAssessment,
  riskAssessment,
  token = '',
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [agreementStatus, setAgreementStatus] = useState<ExpertAgreement>(
    existingReview?.agreementStatus || 'AGREE'
  );
  const [expertAssessment, setExpertAssessment] = useState(
    existingReview?.expertAssessment || aiAssessment?.primaryIssue || ''
  );
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel>(
    existingReview?.confidenceLevel || 'HIGH'
  );
  const [expertNotes, setExpertNotes] = useState(
    existingReview?.expertNotes || ''
  );
  const [recommendationsText, setRecommendationsText] = useState(
    existingReview?.recommendations?.join('\n') || 
    'Implement strict field sanitation and clean pruning tools between rows.\nScout 10 randomized plants across the plot to establish foliar incidence percentage.\nEnsure adequate spacing and aeration in crop canopy to limit humidity.'
  );
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>(
    existingReview?.priority || 'NORMAL'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const recommendations = recommendationsText
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean);

      const res = await fetch(`/api/observations/${observation.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          agreementStatus,
          expertAssessment: expertAssessment.trim(),
          confidenceLevel,
          expertNotes: expertNotes.trim(),
          recommendations,
          priority,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit agronomic validation');
      }

      onSuccess(data.data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E0E0E0] overflow-hidden animate-scaleUp my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#1B3022] text-white p-5 flex items-center justify-between border-b-4 border-[#2D5A27]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight">Agronomist Clinical Validation</h2>
              <span className="bg-[#2D5A27] text-white font-mono text-[10px] px-2 py-0.5 rounded border border-[#4CAF50]/30 font-bold uppercase">
                HUMAN-IN-THE-LOOP
              </span>
            </div>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              Review observation CF-{observation.id.slice(0, 8).toUpperCase()} • {observation.cropName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-200 hover:text-white rounded-lg hover:bg-[#2D5A27] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Diagnostic Context Split */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F8F9FA] p-4 rounded-xl border border-[#E0E0E0]">
            <div className="space-y-1 text-xs">
              <div className="text-[10px] font-bold text-[#888] uppercase tracking-wider">Field Observation</div>
              <div className="font-semibold text-[#1B3022]">{observation.cropName} ({observation.growthStage})</div>
              <div className="text-[#666]">Farm: {observation.farmName || 'Demo Farm'} • Plot: {observation.plotName || 'Plot 1'}</div>
              <div className="text-[#666]">Severity: <span className="font-medium text-[#1B3022]">{observation.severityEstimate}</span></div>
              <div className="text-[#555] italic pt-1">
                "{observation.symptomDescription || 'Foliar lesions noted by farmer'}"
              </div>
            </div>

            <div className="space-y-1 text-xs border-t sm:border-t-0 sm:border-l sm:pl-4 border-[#E0E0E0]">
              <div className="text-[10px] font-bold text-[#888] uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#4CAF50]" />
                AI Initial Assessment
              </div>
              <div className="font-bold text-[#2E7D32]">
                {aiAssessment?.primaryIssue || 'Evaluation Pending'}
              </div>
              {aiAssessment && (
                <div className="text-[#666] font-mono text-[11px]">
                  Confidence: {Math.round(aiAssessment.confidenceScore * 100)}% ({aiAssessment.confidenceLevel})
                </div>
              )}
              {riskAssessment && (
                <div className="text-[#666] font-mono text-[11px]">
                  Biological Risk: <span className="font-bold text-[#F27D26]">{riskAssessment.overallRiskLevel}</span>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Agreement Decision */}
            <div>
              <label className="block text-xs font-bold text-[#1B3022] uppercase tracking-wider mb-2">
                Agronomist Decision & AI Agreement
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'AGREE', label: 'Agree (Confirm AI)', desc: 'Validates AI finding', color: 'border-[#4CAF50] text-[#2E7D32] bg-[#F1F8E9]' },
                  { key: 'DISAGREE', label: 'Disagree (Revise)', desc: 'Revises diagnosis', color: 'border-[#F27D26] text-[#D84315] bg-[#FFF3E0]' },
                  { key: 'INSUFFICIENT_EVIDENCE', label: 'Inconclusive', desc: 'Ambiguous symptoms', color: 'border-purple-400 text-purple-700 bg-purple-50' },
                  { key: 'NEEDS_MORE_INFORMATION', label: 'Needs Info', desc: 'Request field data', color: 'border-blue-400 text-blue-700 bg-blue-50' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setAgreementStatus(item.key as ExpertAgreement);
                      if (item.key === 'AGREE' && aiAssessment?.primaryIssue) {
                        setExpertAssessment(aiAssessment.primaryIssue);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      agreementStatus === item.key
                        ? `${item.color} shadow-xs font-bold`
                        : 'border-[#E0E0E0] bg-white hover:bg-[#F8F9FA] text-[#555]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{item.label}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Expert Assessment Condition */}
            <div>
              <label className="block text-xs font-bold text-[#1B3022] uppercase tracking-wider mb-1">
                Expert Diagnostic Assessment / Condition
              </label>
              <input
                type="text"
                required
                value={expertAssessment}
                onChange={(e) => setExpertAssessment(e.target.value)}
                placeholder="e.g. Early Blight (Alternaria solani), Nitrogen Deficiency, etc."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#CCCCCC] focus:border-[#2D5A27] focus:ring-1 focus:ring-[#2D5A27] outline-none"
              />
              <p className="text-[10px] text-[#777] mt-0.5">
                Clearly state the validated disorder, pathogen, or abiotic factor.
              </p>
            </div>

            {/* Confidence & Priority Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#1B3022] uppercase tracking-wider mb-1">
                  Expert Confidence Level
                </label>
                <select
                  value={confidenceLevel}
                  onChange={(e) => setConfidenceLevel(e.target.value as ConfidenceLevel)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#CCCCCC] focus:border-[#2D5A27] outline-none bg-white"
                >
                  <option value="HIGH">High (Clear symptoms confirmed)</option>
                  <option value="MEDIUM">Medium (Probable diagnosis)</option>
                  <option value="LOW">Low (Preliminary suspicion)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B3022] uppercase tracking-wider mb-1">
                  Validation Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#CCCCCC] focus:border-[#2D5A27] outline-none bg-white"
                >
                  <option value="NORMAL">Normal Priority</option>
                  <option value="HIGH">High Priority</option>
                  <option value="URGENT">Urgent Outbreak Alert</option>
                </select>
              </div>
            </div>

            {/* Clinical Notes */}
            <div>
              <label className="block text-xs font-bold text-[#1B3022] uppercase tracking-wider mb-1">
                Agronomic Clinical Notes & Pathology Rationale
              </label>
              <textarea
                rows={3}
                value={expertNotes}
                onChange={(e) => setExpertNotes(e.target.value)}
                placeholder="Explain the foliar characteristics (concentric rings, chlorotic halos, vein banding) and rationale for this determination..."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#CCCCCC] focus:border-[#2D5A27] outline-none"
              />
            </div>

            {/* Field Recommendations */}
            <div>
              <label className="block text-xs font-bold text-[#1B3022] uppercase tracking-wider mb-1">
                Recommended Farmer Field Actions (One per line)
              </label>
              <textarea
                rows={3}
                value={recommendationsText}
                onChange={(e) => setRecommendationsText(e.target.value)}
                placeholder="List practical, non-chemical, IPM, sanitation, or scouting instructions..."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#CCCCCC] focus:border-[#2D5A27] outline-none font-mono text-[11px]"
              />
              <p className="text-[10px] text-[#777] mt-0.5">
                Only supply safe, verifiable cultural, preventive, and sanitation measures.
              </p>
            </div>

            {/* Submit Controls */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E0E0E0]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[#666] hover:text-[#1B3022] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !expertAssessment.trim()}
                className="bg-[#1B3022] hover:bg-[#2D5A27] text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-[#4CAF50]" />
                <span>{submitting ? 'Submitting...' : 'Submit Expert Validation'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
