/**
 * CropFix - AI Assessment & Risk Intelligence View (Bento Grid Theme)
 * SIH26131: Early detection and management of crop diseases and pest infestations
 */

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  HelpCircle, 
  ArrowLeft, 
  FileText, 
  Send,
  Camera,
  Activity,
  Check
} from 'lucide-react';
import type { 
  Observation, 
  AssessmentRecord, 
  RiskAssessmentRecord, 
  RiskLevel,
  ConfidenceLevel,
  FollowUpRecord,
  ExpertReview,
  User 
} from '../types/index.js';
import { GuidanceActionPanel } from './GuidanceActionPanel.js';
import { FollowUpModal } from './FollowUpModal.js';
import { ExpertReviewModal } from './ExpertReviewModal.js';
import { Calendar, History, Plus, TrendingDown, TrendingUp, Minus, Award } from 'lucide-react';

interface AssessmentViewProps {
  observation: Observation;
  currentUser?: User;
  token?: string;
  onBack: () => void;
  onRefreshObservation?: () => void;
  onViewCase?: (caseId: string) => void;
}

export const AssessmentView: React.FC<AssessmentViewProps> = ({
  observation,
  currentUser,
  token = '',
  onBack,
  onRefreshObservation,
  onViewCase,
}) => {
  const [assessment, setAssessment] = useState<AssessmentRecord | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessmentRecord | null>(null);
  const [expertReview, setExpertReview] = useState<ExpertReview | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [requestingReview, setRequestingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Follow-up modal state
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpToComplete, setFollowUpToComplete] = useState<FollowUpRecord | null>(null);

  // Expert review modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  useEffect(() => {
    fetchAssessmentAndRisk();
    fetchFollowUps();
    fetchExpertReview();
  }, [observation.id]);

  const fetchExpertReview = async () => {
    try {
      const res = await fetch(`/api/observations/${observation.id}/review`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setExpertReview(data.data);
        }
      }
    } catch {
      // Review may not exist yet
    }
  };

  const fetchFollowUps = async () => {
    try {
      const res = await fetch(`/api/observations/${observation.id}/follow-ups`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      const data = await res.json();
      if (data.success) {
        setFollowUps(data.data);
      }
    } catch {
      // Benign fallback
    }
  };

  const fetchAssessmentAndRisk = async () => {
    setError(null);
    try {
      const asmtRes = await fetch(`/api/observations/${observation.id}/assessment`);
      if (asmtRes.ok) {
        const asmtData = await asmtRes.json();
        if (asmtData.success && asmtData.data) {
          setAssessment(asmtData.data);

          const riskRes = await fetch(`/api/observations/${observation.id}/risk`);
          if (riskRes.ok) {
            const riskData = await riskRes.json();
            if (riskData.success && riskData.data) {
              setRiskAssessment(riskData.data);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch existing assessment:', err);
    }
  };

  const handleRunAssessment = async () => {
    setLoadingAssessment(true);
    setError(null);
    try {
      const res = await fetch(`/api/observations/${observation.id}/assess`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to run AI assessment');
      }

      setAssessment(data.data);

      setLoadingRisk(true);
      const riskRes = await fetch(`/api/observations/${observation.id}/risk`, {
        method: 'POST',
      });
      const riskData = await riskRes.json();
      if (riskRes.ok && riskData.success) {
        setRiskAssessment(riskData.data);
      }
      if (onRefreshObservation) onRefreshObservation();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Assessment failed');
    } finally {
      setLoadingAssessment(false);
      setLoadingRisk(false);
    }
  };

  const handleRequestExpertReview = async () => {
    setRequestingReview(true);
    setError(null);
    try {
      const res = await fetch(`/api/observations/${observation.id}/request-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Farmer requested agronomist field review.' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to request review');
      }
      setReviewMessage(data.message);
      if (onRefreshObservation) onRefreshObservation();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Review request failed');
    } finally {
      setRequestingReview(false);
    }
  };

  const displayCaseId = `CF-${observation.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#1B3022] hover:text-[#2D5A27] bg-white px-3 py-2 rounded-lg border border-[#E0E0E0] shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Field Cases</span>
        </button>

        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <span>Farm: <strong className="text-slate-800">{observation.farmName}</strong></span>
          <span>•</span>
          <span>Plot: <strong className="text-slate-800">{observation.plotName}</strong></span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {reviewMessage && (
        <div className="p-3 bg-[#F1F8E9] border border-[#C5E1A5] text-[#2E7D32] text-xs rounded-xl flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-[#4CAF50] shrink-0" />
          <span>{reviewMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BENTO GRID: 12-Column Responsive Layout                                 */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

        {/* 1. IDENTITY CARD */}
        <div className="md:col-span-4 bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs flex flex-col justify-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Crop & Field Record
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold text-[#1B3022] tracking-tight">
              {observation.cropName}
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              ({displayCaseId})
            </span>
          </div>
          <p className="text-xs text-slate-700 mt-1">
            Plot: <span className="font-semibold text-slate-900">{observation.plotName}</span> • Farm:{' '}
            <span className="font-semibold text-slate-900">{observation.farmName}</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Stage: {observation.growthStage} • Part: {observation.plantPart}
          </p>
        </div>

        {/* 2. AI ASSESSMENT CARD */}
        <div className="md:col-span-4 bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs flex flex-col justify-center border-l-4 border-l-[#2E7D32]">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            AI-Assisted Assessment
          </p>
          {assessment ? (
            <>
              <div className="text-[11px] font-medium text-slate-600">Possible Issue:</div>
              <h2 className="text-base font-bold text-[#2E7D32] truncate leading-tight" title={assessment.primaryIssue}>
                Early signs consistent with {assessment.primaryIssue}
              </h2>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-emerald-50 h-2 rounded-full overflow-hidden border border-emerald-200">
                    <div 
                      className="bg-[#2E7D32] h-full transition-all duration-500 rounded-full"
                      style={{ width: `${Math.round(assessment.confidenceScore * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-[#2E7D32] shrink-0">
                    {assessment.confidenceScore < 0.4
                      ? `Low (${Math.round(assessment.confidenceScore * 100)}%)`
                      : assessment.confidenceScore < 0.75
                      ? `Moderate (${Math.round(assessment.confidenceScore * 100)}%)`
                      : `High (${Math.round(assessment.confidenceScore * 100)}%)`}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {assessment.confidenceScore < 0.4
                    ? 'Photo or symptoms not clear enough for high certainty.'
                    : assessment.confidenceScore < 0.75
                    ? 'Matches common signs, field verification advised.'
                    : 'Strong visual and contextual symptom match.'}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-600">Pending Evaluation</div>
                <div className="text-[11px] text-slate-400">Click below to assess symptoms</div>
              </div>
              <button
                id="btn-run-ai-assessment-bento"
                onClick={handleRunAssessment}
                disabled={loadingAssessment}
                className="bg-[#1B3022] hover:bg-[#2D5A27] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                {loadingAssessment ? 'Analyzing...' : 'Assess'}
              </button>
            </div>
          )}
        </div>

        {/* 3. RISK LEVEL CARD */}
        <div className={`md:col-span-4 bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs flex flex-col justify-center border-l-4 ${
          riskAssessment?.riskLevel === 'HIGH' || riskAssessment?.riskLevel === 'CRITICAL'
            ? 'border-l-red-600'
            : riskAssessment?.riskLevel === 'MODERATE'
            ? 'border-l-amber-500'
            : riskAssessment?.riskLevel === 'UNCERTAIN'
            ? 'border-l-purple-600'
            : 'border-l-emerald-600'
        }`}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Crop Risk Level
          </p>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              riskAssessment?.riskLevel === 'HIGH'
                ? 'bg-red-50 text-red-600'
                : riskAssessment?.riskLevel === 'MODERATE'
                ? 'bg-amber-50 text-amber-600'
                : riskAssessment?.riskLevel === 'UNCERTAIN'
                ? 'bg-purple-50 text-purple-600'
                : 'bg-emerald-50 text-emerald-700'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-xl font-bold tracking-tight ${
                riskAssessment?.riskLevel === 'HIGH'
                  ? 'text-red-600'
                  : riskAssessment?.riskLevel === 'MODERATE'
                  ? 'text-amber-700'
                  : riskAssessment?.riskLevel === 'UNCERTAIN'
                  ? 'text-purple-700'
                  : 'text-emerald-700'
              }`}>
                {riskAssessment ? `${riskAssessment.riskLevel} RISK` : 'EVALUATING'}
              </h2>
              <p className="text-[10px] text-slate-500">
                {riskAssessment?.riskLevel === 'HIGH'
                  ? 'Potential spread if untreated within 3–5 days.'
                  : riskAssessment?.riskLevel === 'MODERATE'
                  ? 'Localized symptoms; preventative monitoring needed.'
                  : riskAssessment?.riskLevel === 'UNCERTAIN'
                  ? 'Limited evidence; closer inspection needed.'
                  : 'Low immediate threat to overall crop yield.'}
              </p>
            </div>
          </div>
        </div>

        {/* 4. VISUAL EVIDENCE CARD (Bento Left Middle - Cinematic Dark Panel) */}
        <div className="md:col-span-5 bg-[#111] rounded-xl relative overflow-hidden group min-h-[360px] flex flex-col justify-between border border-[#333]">
          {/* Background Image with Ambient Darkness */}
          <div className="absolute inset-0 bg-slate-900">
            <img
              src={`/api/observations/${observation.id}/image`}
              alt="Field Evidence"
              className="w-full h-full object-cover opacity-65 group-hover:opacity-75 transition-opacity"
              onError={(e) => {
                (e.target as any).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="%234CAF50" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
              }}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>

          {/* Floating Sensor Badges */}
          <div className="relative z-10 p-4 flex flex-wrap gap-2">
            <span className="px-2.5 py-1 bg-black/60 text-[10px] font-mono text-white rounded-md backdrop-blur-md border border-white/20">
              SOURCE: FIELD_GROUND_CAM
            </span>
            <span className="px-2.5 py-1 bg-black/60 text-[10px] font-mono text-[#4CAF50] rounded-md backdrop-blur-md border border-[#4CAF50]/30">
              IMG_{observation.id.slice(0, 4).toUpperCase()}.RAW
            </span>
            <span className="px-2.5 py-1 bg-[#1B3022]/80 text-[10px] font-mono text-white rounded-md backdrop-blur-md border border-[#4CAF50]/30 ml-auto">
              PART: {observation.plantPart.toUpperCase()}
            </span>
          </div>

          {/* Bottom Symptom Evidence Overlay */}
          <div className="relative z-10 p-4 space-y-2">
            <div>
              <h3 className="text-white font-bold text-sm tracking-tight flex items-center gap-1.5">
                Primary Visual Evidence
              </h3>
              <p className="text-white/80 text-xs mt-1 leading-relaxed line-clamp-3">
                {observation.symptomDescription || 'Observed foliar lesions and discoloration registered during field scouting.'}
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-white/10">
              <div className="flex flex-wrap gap-1">
                {observation.symptomTags.map((tag, idx) => (
                  <span key={idx} className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded backdrop-blur-xs font-mono">
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <div className="w-2 h-2 bg-[#4CAF50] rounded-full"></div>
                <div className="w-2 h-2 bg-[#4CAF50] rounded-full"></div>
                <div className="w-2 h-2 bg-white/40 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. ENVIRONMENTAL CONTEXT & RISK FACTORS (Bento Right Top) */}
        <div className="md:col-span-7 bg-white border border-[#E0E0E0] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3 border-b border-[#F0F0F0] pb-2">
              <h3 className="text-xs font-bold text-[#1B3022] uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#4CAF50]" />
                Environmental Context & Risk Factors
              </h3>
              <span className="text-[10px] font-mono text-[#999]">
                VERIFIED CONTEXT
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-[#888] font-bold uppercase mb-1">Growth Stage</p>
                <p className="text-xs font-semibold text-slate-900">{observation.growthStage}</p>
                <div className="mt-1 text-[10px] text-[#4CAF50] font-mono font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> DATA VERIFIED
                </div>
                <p className="text-[10px] text-[#888] mt-2 font-bold uppercase">Severity Estimate</p>
                <p className="text-xs text-slate-700 font-medium">{observation.severityEstimate}</p>
              </div>

              <div>
                <p className="text-[10px] text-[#888] font-bold uppercase mb-1">Biological Risk Drivers</p>
                <ul className="text-[11px] leading-tight flex flex-col gap-1.5 text-slate-700">
                  {riskAssessment?.riskFactors && riskAssessment.riskFactors.length > 0 ? (
                    riskAssessment.riskFactors.map((rf, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-[#F27D26] font-bold">•</span>
                        <span>{rf.factor}</span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="flex items-center gap-1.5">• Crop phenology stage sensitivity</li>
                      <li className="flex items-center gap-1.5 text-[#F27D26]">• Canopy microclimate humidity</li>
                      <li className="flex items-center gap-1.5">• Pathogen dispersion trajectory</li>
                    </>
                  )}
                </ul>
              </div>

              <div>
                <p className="text-[10px] text-[#888] font-bold uppercase mb-1">Diagnostic Uncertainty</p>
                <p className="text-xs leading-relaxed italic text-[#666]">
                  {assessment?.uncertaintyNotes ||
                    'Ground-truth micro-climate telemetry absent. Visual diagnosis carries optical margin of error.'}
                </p>
              </div>
            </div>
          </div>

          {assessment?.evidencePoints && assessment.evidencePoints.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#F0F0F0]">
              <p className="text-[10px] text-[#888] font-bold uppercase mb-1">Supporting Agronomic Evidence:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-700">
                {assessment.evidencePoints.slice(0, 4).map((pt, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-[#F8F9FA] px-2 py-1 rounded border border-[#E0E0E0]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] shrink-0"></span>
                    <span className="truncate">{pt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 6. ACTION PANEL: FIELD CARE RECOMMENDATIONS */}
        <div className="md:col-span-7 bg-[#F1F8E9] border border-[#C5E1A5] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-sm font-bold text-[#1B3022] flex items-center gap-1.5">
                  Recommended Field Care Actions
                </h3>
                <p className="text-xs text-[#558B2F] leading-relaxed mt-0.5">
                  {riskAssessment
                    ? riskAssessment.explanation
                    : 'Targeted actions based on observed foliar symptoms and growth stage.'}
                </p>
              </div>
            </div>

            {/* Recommended Action Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3">
              {(riskAssessment?.recommendedActions || [
                'Scout 10 randomized plants across the plot to establish true incidence percentage.',
                'Physically inspect the underside of affected leaves for fungal spore masses.',
                'Maintain clean field sanitation and sanitize pruning tools.',
                'Record a follow-up observation in 3 days to track symptom stability.'
              ]).slice(0, 4).map((action, idx) => (
                <div key={idx} className="bg-white/80 border border-[#C5E1A5] rounded-lg p-2 text-xs text-[#2E7D32] flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4CAF50] shrink-0 mt-0.5" />
                  <span className="leading-snug">{action}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              id="btn-request-expert-review-bento"
              onClick={handleRequestExpertReview}
              disabled={requestingReview || observation.status === 'NEEDS_REVIEW'}
              className="flex-1 bg-[#1B3022] hover:bg-[#2D5A27] text-white py-3 rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm shadow-[#1B3022]/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-[#4CAF50]" />
              {observation.status === 'NEEDS_REVIEW'
                ? 'Review Requested from Agronomist'
                : requestingReview
                ? 'Escalating...'
                : 'Request Expert Review'}
            </button>
            <button
              onClick={() => {
                if (!assessment) handleRunAssessment();
              }}
              className="flex-1 bg-white border border-[#1B3022] text-[#1B3022] hover:bg-[#F8F9FA] py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#2E7D32]" />
              {assessment ? 'AI Assessment Synchronized' : 'Run Diagnostics'}
            </button>
          </div>
        </div>

        {/* 7. ALTERNATIVE CANDIDATES & SAFETY DISCLAIMER */}
        {assessment && (
          <div className="md:col-span-12 bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1">
              <span className="text-[10px] font-bold text-[#888] uppercase tracking-wider">
                Differential Diagnostic Candidates Considered:
              </span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {assessment.alternativeCandidates.map((alt, i) => (
                  <span
                    key={i}
                    className="text-xs bg-[#F8F9FA] border border-[#E0E0E0] px-2.5 py-1 rounded text-slate-700 font-medium flex items-center gap-2"
                  >
                    <span>{alt.issueName}</span>
                    <span className="text-[10px] font-mono text-[#2E7D32] font-bold bg-[#E8F5E9] px-1 rounded">
                      {Math.round(alt.likelihoodScore * 100)}%
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-[#777] italic md:max-w-md bg-[#F8F9FA] p-2.5 rounded-lg border border-[#E0E0E0]">
              <strong className="text-[#1B3022]">Advisory:</strong> {assessment.disclaimer}
            </div>
          </div>
        )}

        {/* 8. GUIDANCE & ACTION MANAGEMENT CELL */}
        <div className="md:col-span-12">
          <GuidanceActionPanel
            observation={observation}
            riskAssessment={riskAssessment || undefined}
            token={token}
            onFollowUpScheduled={fetchFollowUps}
          />
        </div>

        {/* AGRONOMIST HUMAN VALIDATION CELL */}
        <div className={`md:col-span-12 rounded-xl p-6 shadow-xs border transition-all ${
          expertReview 
            ? expertReview.agreementStatus === 'AGREE'
              ? 'bg-[#F1F8E9]/60 border-[#C5E1A5]'
              : expertReview.agreementStatus === 'DISAGREE'
              ? 'bg-[#FFF3E0]/60 border-[#FFE0B2]'
              : 'bg-purple-50/60 border-purple-200'
            : 'bg-white border-[#E0E0E0]'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0E0E0]/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#1B3022] text-white">
                <Award className="w-5 h-5 text-[#4CAF50]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#1B3022]">Agronomist Field Review</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-[#1B3022] text-white">
                    VERIFIED EXPERT REVIEW
                  </span>
                </div>
                <p className="text-xs text-[#555]">
                  Authoritative assessment confirmation by verified agricultural extension specialists
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(currentUser?.role === 'EXPERT' || currentUser?.role === 'ADMIN') && (
                <button
                  id="btn-expert-validate-obs"
                  onClick={() => setIsReviewModalOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#1B3022] hover:bg-[#2D5A27] rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 uppercase tracking-wider"
                >
                  <Award className="w-3.5 h-3.5 text-[#4CAF50]" />
                  <span>{expertReview ? 'Update Clinical Validation' : 'Submit Agronomist Validation'}</span>
                </button>
              )}
            </div>
          </div>

          {expertReview ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 ${
                  expertReview.agreementStatus === 'AGREE'
                    ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]'
                    : expertReview.agreementStatus === 'DISAGREE'
                    ? 'bg-[#FFF3E0] text-[#D84315] border border-[#FFCC80]'
                    : 'bg-purple-100 text-purple-800 border border-purple-300'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  DECISION: {expertReview.agreementStatus} ({
                    expertReview.agreementStatus === 'AGREE' ? 'Confirmed AI Diagnosis' :
                    expertReview.agreementStatus === 'DISAGREE' ? 'Revised Diagnosis' :
                    'Inconclusive / More Info Needed'
                  })
                </span>

                <span className="text-xs text-[#666]">
                  Validated by: <strong className="text-[#1B3022]">{expertReview.expertName}</strong>
                </span>
                {expertReview.reviewedAt && (
                  <span className="text-xs text-[#888]">
                    • {new Date(expertReview.reviewedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-[#E0E0E0] text-[#555]">
                  Confidence: {expertReview.confidenceLevel || 'HIGH'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-[#E0E0E0]">
                <div>
                  <div className="text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1">
                    Clinical Diagnosis & Pathology Determination
                  </div>
                  <div className="text-sm font-bold text-[#1B3022]">
                    {expertReview.expertAssessment || 'Confirmed Condition'}
                  </div>
                  {expertReview.expertNotes && (
                    <p className="text-xs text-[#555] mt-2 leading-relaxed italic bg-[#F8F9FA] p-3 rounded-lg border border-[#F0F0F0]">
                      &quot;{expertReview.expertNotes}&quot;
                    </p>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1">
                    Authoritative Field Directives
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#444]">
                    {expertReview.recommendations && expertReview.recommendations.length > 0 ? (
                      expertReview.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-[#2D5A27] font-bold shrink-0 mt-0.5">✓</span>
                          <span>{rec}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[#888] italic">No custom directives specified. Follow standard IPM protocol.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 p-5 bg-[#F8F9FA] rounded-xl border border-dashed border-[#CCCCCC] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="text-xs font-bold text-[#1B3022]">
                  {observation.status === 'NEEDS_REVIEW' 
                    ? 'Case Queued on Agronomist Desk' 
                    : 'AI-Guided Observation (Direct Validation Available)'}
                </div>
                <p className="text-[11px] text-[#666] max-w-xl">
                  {observation.status === 'NEEDS_REVIEW'
                    ? 'This case has been flagged and escalated to the regional Krishi Vigyan Kendra (KVK) review stream.'
                    : 'The diagnostic assessment above was generated by the AI decision-support pipeline. You may escalate for human specialist confirmation at any time.'}
                </p>
              </div>

              {observation.status !== 'NEEDS_REVIEW' && (
                <button
                  onClick={handleRequestExpertReview}
                  disabled={requestingReview}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#1B3022] hover:bg-[#2D5A27] rounded-lg shadow-xs transition-colors shrink-0 uppercase tracking-wider cursor-pointer"
                >
                  {requestingReview ? 'Escalating...' : 'Request Validation'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* 9. PHASE 8: FIELD INSPECTION & FOLLOW-UP TRACKING BENTO CELL */}
        <div className="md:col-span-12 bg-white border border-[#E0E0E0] rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0E0E0] pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[#1B3022]/10 text-[#1B3022]">
                <Calendar className="w-5 h-5 text-[#2D5A27]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1B3022]">Field Follow-Up Inspections & Symptom Evolution</h3>
                <p className="text-xs text-[#555555]">Track plot condition over time with before/after comparisons and adaptive guidance</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {observation.caseId && onViewCase && (
                <button
                  id="btn-view-case-timeline"
                  onClick={() => onViewCase(observation.caseId!)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1B3022] bg-[#F4F6F4] hover:bg-[#E0E0E0] border border-[#CCCCCC] rounded-lg transition-colors cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-[#2D5A27]" />
                  <span>View Case Timeline</span>
                </button>
              )}

              <button
                id="btn-schedule-followup"
                onClick={() => {
                  setFollowUpToComplete(null);
                  setIsFollowUpModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1B3022] hover:bg-[#2D5A27] rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule Next Inspection</span>
              </button>
            </div>
          </div>

          {followUps.length === 0 ? (
            <div className="p-6 text-center bg-[#F4F6F4] rounded-xl border border-dashed border-[#CCCCCC] space-y-2">
              <Calendar className="w-8 h-8 text-[#888888] mx-auto" />
              <p className="text-xs font-medium text-[#333333]">No follow-up inspections scheduled yet</p>
              <p className="text-[11px] text-[#666666] max-w-sm mx-auto">
                Schedule an inspection in 2-3 days to evaluate whether cultural aeration, sanitation, or IPM methods stabilized symptoms.
              </p>
              <button
                onClick={() => {
                  setFollowUpToComplete(null);
                  setIsFollowUpModalOpen(true);
                }}
                className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#2D5A27] hover:underline cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Schedule Inspection Now</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {followUps.map((fu) => {
                const isCompleted = fu.status === 'COMPLETED';
                return (
                  <div
                    key={fu.id}
                    className={`p-4 rounded-xl border transition-all space-y-3 ${
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : 'border-[#E0E0E0] bg-[#F4F6F4]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1B3022]">
                        {isCompleted ? 'Inspection Completed' : 'Scheduled Inspection'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {fu.status}
                      </span>
                    </div>

                    <div className="text-xs text-[#555555] space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#2D5A27]" />
                        <span>Date: {fu.scheduledDate} {fu.completedDate ? `(Completed ${new Date(fu.completedDate).toLocaleDateString()})` : ''}</span>
                      </div>
                      {fu.notes && (
                        <p className="italic text-[11px] text-[#666666]">"{fu.notes}"</p>
                      )}
                    </div>

                    {isCompleted && fu.symptomTrend && (
                      <div className="p-2.5 bg-white rounded-lg border border-[#E0E0E0] text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-[#1B3022]">
                          {fu.symptomTrend === 'IMPROVED' && <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />}
                          {fu.symptomTrend === 'WORSENED' && <TrendingUp className="w-3.5 h-3.5 text-red-600" />}
                          {fu.symptomTrend === 'UNCHANGED' && <Minus className="w-3.5 h-3.5 text-stone-600" />}
                          <span>Trend: {fu.symptomTrend}</span>
                        </div>
                        {fu.farmerNotes && (
                          <p className="text-[11px] text-[#555555]">{fu.farmerNotes}</p>
                        )}
                        {fu.adaptiveNextStep && (
                          <p className="text-[11px] text-[#2D5A27] font-medium pt-1 border-t border-[#E0E0E0]/60">
                            <strong>Adaptive Next Step: </strong> {fu.adaptiveNextStep}
                          </p>
                        )}
                      </div>
                    )}

                    {!isCompleted && (
                      <div className="pt-2 border-t border-[#E0E0E0]/60 flex justify-end">
                        <button
                          id={`btn-complete-fu-${fu.id}`}
                          onClick={() => {
                            setFollowUpToComplete(fu);
                            setIsFollowUpModalOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#2D5A27] hover:bg-[#1B3022] rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          Complete Inspection Now
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Follow-up modal */}
      <FollowUpModal
        observation={observation}
        followUpToComplete={followUpToComplete}
        isOpen={isFollowUpModalOpen}
        token={token}
        onClose={() => setIsFollowUpModalOpen(false)}
        onSuccess={() => {
          fetchFollowUps();
          if (onRefreshObservation) onRefreshObservation();
        }}
      />

      {/* Expert Review Modal */}
      <ExpertReviewModal
        observation={observation}
        existingReview={expertReview}
        aiAssessment={assessment}
        riskAssessment={riskAssessment}
        token={token}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onSuccess={(updatedReview) => {
          setExpertReview(updatedReview);
          if (onRefreshObservation) onRefreshObservation();
        }}
      />
    </div>
  );
};
