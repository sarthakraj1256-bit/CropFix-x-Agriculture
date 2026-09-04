/**
 * CropFix - Expert Agronomist Dashboard (Bento Grid Theme)
 * SIH26131: Early detection and management of crop diseases and pest infestations
 * Phase 10 Implementation
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles,
  ShieldAlert,
  Clock,
  Filter,
  Check,
  FileText
} from 'lucide-react';
import type { Observation, User, ExpertReview } from '../types/index.js';
import type { ExpertQueueItem } from '../server/expertService.js';
import { ExpertReviewModal } from './ExpertReviewModal.js';

interface ExpertDashboardProps {
  currentUser: User;
  token?: string;
  onSelectObservation: (obs: Observation) => void;
}

export const ExpertDashboard: React.FC<ExpertDashboardProps> = ({
  currentUser,
  token = '',
  onSelectObservation,
}) => {
  const [queueItems, setQueueItems] = useState<ExpertQueueItem[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'HIGH_RISK' | 'VALIDATED'>('ALL');
  
  // Review modal state
  const [selectedQueueItem, setSelectedQueueItem] = useState<ExpertQueueItem | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [queueRes, obsRes] = await Promise.all([
        fetch('/api/expert/queue', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }),
        fetch('/api/observations', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
      ]);

      const queueData = await queueRes.json();
      if (queueData.success) {
        setQueueItems(queueData.data);
      }

      const obsData = await obsRes.json();
      if (obsData.success) {
        setObservations(obsData.data);
      }
    } catch (err) {
      console.error('Failed to load expert review queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const pendingItems = queueItems.filter((q) => q.status === 'NEEDS_REVIEW' || !q.review);
  const validatedItems = queueItems.filter((q) => q.review && q.review.status === 'COMPLETED');
  const agreeItems = validatedItems.filter((q) => q.review?.agreementStatus === 'AGREE');
  const agreementRate = validatedItems.length > 0 ? Math.round((agreeItems.length / validatedItems.length) * 100) : 100;

  const filteredItems = queueItems.filter((item) => {
    if (activeFilter === 'PENDING') return item.status === 'NEEDS_REVIEW' || !item.review;
    if (activeFilter === 'HIGH_RISK') return item.riskLevel === 'HIGH' || item.riskLevel === 'CRITICAL';
    if (activeFilter === 'VALIDATED') return item.review?.status === 'COMPLETED';
    return true;
  });

  const handleOpenReview = (item: ExpertQueueItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedQueueItem(item);
    setIsReviewModalOpen(true);
  };

  const selectedObservationObj = selectedQueueItem ? observations.find((o) => o.id === selectedQueueItem.observationId) || {
    id: selectedQueueItem.observationId,
    userId: 'usr-farmer-01',
    farmId: 'farm-01',
    plotId: 'plot-01',
    farmName: 'Demo Farm',
    plotName: 'Plot 1',
    cropName: selectedQueueItem.cropName,
    growthStage: selectedQueueItem.growthStage,
    plantPart: selectedQueueItem.affectedPart,
    severityEstimate: selectedQueueItem.severityEstimate,
    symptomTags: [],
    symptomDescription: selectedQueueItem.symptomDescription,
    imageId: 'img-1',
    status: selectedQueueItem.status,
    createdAt: selectedQueueItem.submittedAt,
    updatedAt: selectedQueueItem.submittedAt,
  } as Observation : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Top Banner */}
      <div className="bg-[#1B3022] rounded-xl p-6 text-white shadow-sm border-b-4 border-[#2D5A27] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">Agronomist Review Desk</h1>
            <span className="bg-[#2D5A27] text-white text-xs px-2.5 py-0.5 rounded-full border border-emerald-400/30 font-medium">
              {currentUser.name}
            </span>
          </div>
          <p className="text-xs text-emerald-200/90 mt-1 max-w-xl">
            Agronomist review queue: Verify diagnostic evaluations, assess plant disease risk, and provide field-tested crop-care guidance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#142419] px-4 py-2 rounded-lg border border-[#2D5A27] text-right">
            <div className="text-[10px] text-emerald-300 font-semibold uppercase">Pending Reviews</div>
            <div className="text-base font-bold text-amber-400">
              {pendingItems.length} {pendingItems.length === 1 ? 'case' : 'cases'}
            </div>
          </div>
        </div>
      </div>

      {/* Bento Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Queue Depth</span>
          <div className="text-2xl font-bold font-mono text-[#1B3022] mt-2">{queueItems.length}</div>
          <div className="text-[11px] text-[#888] mt-0.5">Total cases in review stream</div>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs border-l-4 border-l-[#F27D26]">
          <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Pending Action</span>
          <div className="text-2xl font-bold font-mono text-[#F27D26] mt-2">
            {pendingItems.length}
          </div>
          <div className="text-[11px] text-[#888] mt-0.5">Awaiting human validation</div>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs border-l-4 border-l-[#4CAF50]">
          <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Validated Cases</span>
          <div className="text-2xl font-bold font-mono text-[#2E7D32] mt-2">
            {validatedItems.length}
          </div>
          <div className="text-[11px] text-[#888] mt-0.5">Agronomist verified</div>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">AI Agreement Rate</span>
          <div className="text-2xl font-bold font-mono text-[#1B3022] mt-2">
            {agreementRate}%
          </div>
          <div className="text-[11px] text-[#888] mt-0.5">Expert-AI concordance</div>
        </div>
      </div>

      {/* Review Queue Bento Card */}
      <div className="bg-white rounded-xl shadow-xs border border-[#E0E0E0] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#F0F0F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFF3E0]/30">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F27D26]" />
              <h2 className="text-xs font-bold text-[#1B3022] uppercase tracking-widest">
                Priority Review Queue ({filteredItems.length})
              </h2>
            </div>
            <p className="text-xs text-[#666] mt-0.5">
              Escalated due to high biological risk, diagnostic ambiguity, or farmer request
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { key: 'ALL', label: `All (${queueItems.length})` },
              { key: 'PENDING', label: `Pending (${pendingItems.length})` },
              { key: 'HIGH_RISK', label: 'High Risk' },
              { key: 'VALIDATED', label: `Validated (${validatedItems.length})` },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key as any)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === f.key
                    ? 'bg-[#1B3022] text-white shadow-xs'
                    : 'bg-white text-[#555] border border-[#E0E0E0] hover:bg-[#F8F9FA]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#888]">
            <CheckCircle2 className="w-8 h-8 text-[#4CAF50] mx-auto mb-2 opacity-80" />
            <div className="font-semibold text-slate-700">No cases matching this filter</div>
            <p className="text-[11px] text-[#888] mt-0.5">
              All cases in this category are fully up-to-date.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0F0F0]">
            {filteredItems.map((item) => {
              const hasReview = Boolean(item.review && item.review.status === 'COMPLETED');
              const isAgree = item.review?.agreementStatus === 'AGREE';
              const isDisagree = item.review?.agreementStatus === 'DISAGREE';

              return (
                <div
                  key={item.observationId}
                  onClick={() => {
                    const obs = observations.find((o) => o.id === item.observationId);
                    if (obs) onSelectObservation(obs);
                  }}
                  className={`p-4 hover:bg-[#F8F9FA] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 ${
                    hasReview ? 'border-l-[#4CAF50]' : 'border-l-[#F27D26]'
                  }`}
                >
                  <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
                    <div className="w-14 h-14 rounded-lg bg-[#111] border border-[#333] flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={`/api/observations/${item.observationId}/image`}
                        alt={item.cropName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as any).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23F27D26" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
                        }}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-[#1B3022]">
                          CF-{item.observationId.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          • {item.cropName} ({item.growthStage})
                        </span>
                        {item.farmerDistrict && (
                          <span className="text-xs text-[#777]">
                            • {item.farmerDistrict}
                          </span>
                        )}

                        {hasReview ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isAgree ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C5E1A5]' :
                            isDisagree ? 'bg-[#FFF3E0] text-[#D84315] border border-[#FFE0B2]' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            HUMAN VALIDATED: {item.review?.agreementStatus}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FFF3E0] text-[#F27D26] border border-[#FFE0B2]">
                            ESCALATED FOR REVIEW
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-[#555] mt-1 flex flex-wrap items-center gap-2">
                        {item.aiPrimaryIssue && (
                          <span>AI Assessment: <strong className="text-[#2E7D32]">{item.aiPrimaryIssue}</strong></span>
                        )}
                        {item.aiConfidenceScore && (
                          <span>({Math.round(item.aiConfidenceScore * 100)}% conf)</span>
                        )}
                        {item.riskLevel && (
                          <span className="font-bold text-[#F27D26]">Risk: {item.riskLevel}</span>
                        )}
                      </div>

                      <p className="text-[11px] text-[#666] mt-0.5 italic truncate">
                        &quot;{item.symptomDescription || 'Foliar lesions inspected'}&quot;
                      </p>

                      {hasReview && item.review?.expertAssessment && (
                        <div className="mt-1.5 p-2 bg-[#F1F8E9] rounded-lg border border-[#C5E1A5] text-xs">
                          <strong className="text-[#1B3022]">Agronomist Determination: </strong>
                          <span className="text-[#2E7D32] font-semibold">{item.review.expertAssessment}</span>
                          {item.review.expertNotes && (
                            <p className="text-[11px] text-[#555] mt-0.5 line-clamp-1">"{item.review.expertNotes}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    <button
                      id={`btn-validate-case-${item.observationId}`}
                      onClick={(e) => handleOpenReview(item, e)}
                      className="text-xs font-bold uppercase tracking-wider text-white bg-[#1B3022] hover:bg-[#2D5A27] px-3.5 py-2 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 text-[#4CAF50]" />
                      <span>{hasReview ? 'Update Validation' : 'Validate Case'}</span>
                    </button>
                    <ChevronRight className="w-5 h-5 text-[#AAA]" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Validation Modal */}
      {selectedObservationObj && selectedQueueItem && (
        <ExpertReviewModal
          observation={selectedObservationObj}
          existingReview={selectedQueueItem.review}
          aiAssessment={
            selectedQueueItem.aiPrimaryIssue
              ? {
                  id: 'asmt-preview',
                  observationId: selectedQueueItem.observationId,
                  primaryIssue: selectedQueueItem.aiPrimaryIssue,
                  confidenceScore: selectedQueueItem.aiConfidenceScore || 0.85,
                  confidenceLevel: 'HIGH',
                  evidencePoints: [],
                  alternativeCandidates: [],
                  disclaimer: 'Diagnostic decision support only.',
                  createdAt: selectedQueueItem.submittedAt,
                }
              : null
          }
          riskAssessment={
            selectedQueueItem.riskLevel
              ? {
                  id: 'risk-preview',
                  observationId: selectedQueueItem.observationId,
                  pathogenType: 'FUNGAL',
                  overallRiskLevel: selectedQueueItem.riskLevel,
                  riskScore: 70,
                  spreadPotential: 'MODERATE',
                  economicImpactRisk: 'MODERATE',
                  recommendedActions: [],
                  explanation: 'Contextual risk assessment.',
                  createdAt: selectedQueueItem.submittedAt,
                }
              : null
          }
          token={token}
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
};
