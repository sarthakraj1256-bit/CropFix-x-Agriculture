/**
 * CropFix - Type Definitions
 * SIH26131: Early detection and management of crop diseases and pest infestations
 */

export type UserRole = 'FARMER' | 'EXPERT' | 'INSTITUTIONAL' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  district?: string;
  state?: string;
  preferredLanguage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  token: string;
  user: User;
  expiresAt: string;
}

export interface Farm {
  id: string;
  userId: string;
  name: string;
  district: string;
  state: string;
  totalArea: number;
  areaUnit: 'acres' | 'hectares' | 'bigha' | 'guntha';
  soilType?: string;
  irrigationType?: string;
  isActive: boolean;
  plotsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type CropGrowthStage = 
  | 'Sowing / Germination'
  | 'Germination / Seedling'
  | 'Vegetative'
  | 'Flowering'
  | 'Fruit / Grain Formation'
  | 'Maturity / Harvesting'
  | 'Maturation / Harvest';

export type CropStage = CropGrowthStage;

export type CropSeason = 'Kharif' | 'Rabi' | 'Zaid' | 'Perennial';

export interface Plot {
  id: string;
  farmId: string;
  userId: string;
  name: string;
  area: number;
  areaUnit: 'acres' | 'hectares' | 'bigha' | 'guntha';
  cropName: string;
  variety?: string;
  plantingDate?: string;
  cropStage: CropGrowthStage;
  season: CropSeason;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ObservationStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'ASSESSED'
  | 'NEEDS_REVIEW'
  | 'RESOLVED';

export type PlantPart = 'Leaf' | 'Stem' | 'Fruit / Grain' | 'Flower' | 'Root' | 'Whole Plant';
export type SeverityEstimate = 'Mild (isolated spots)' | 'Moderate (multiple leaves)' | 'Severe (widespread)';

export interface Observation {
  id: string;
  userId: string;
  farmId: string;
  plotId: string;
  farmName?: string;
  plotName?: string;
  cropName: string;
  growthStage: CropGrowthStage;
  plantPart: PlantPart;
  severityEstimate: SeverityEstimate;
  symptomTags: string[];
  symptomDescription: string;
  imageId: string;
  imageMime?: string;
  farmerNotes?: string;
  status: ObservationStatus;
  createdAt: string;
  updatedAt: string;
  hasAssessment?: boolean;
  hasRisk?: boolean;
}

export type IssueCategory = 
  | 'fungal_disease'
  | 'bacterial_disease'
  | 'viral_disease'
  | 'pest_damage'
  | 'nutrient_deficiency'
  | 'environmental_stress'
  | 'healthy_no_obvious_issue'
  | 'insufficient_evidence';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CandidateIssue {
  issueName: string;
  category: IssueCategory;
  confidence: ConfidenceLevel;
  likelihoodScore: number; // 0.0 - 1.0
  notes: string;
}

export interface AssessmentRecord {
  id: string;
  observationId: string;
  engineId: string;
  status: 'ASSESSED' | 'NEEDS_REVIEW' | 'INSUFFICIENT_EVIDENCE' | 'FAILED';
  primaryIssue: string;
  issueCategory: IssueCategory;
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number; // 0.0 - 1.0
  evidencePoints: string[];
  alternativeCandidates: CandidateIssue[];
  uncertaintyNotes: string;
  isDemo: boolean;
  disclaimer: string;
  createdAt: string;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'UNCERTAIN';

export interface RiskFactor {
  factor: string;
  impact: 'low' | 'moderate' | 'high';
  detail: string;
}

export interface UncertaintyFactor {
  factor: string;
  detail: string;
}

export interface RiskAssessmentRecord {
  id: string;
  observationId: string;
  assessmentId: string;
  riskLevel: RiskLevel;
  riskScore: number; // 1 - 100
  riskFactors: RiskFactor[];
  uncertaintyFactors: UncertaintyFactor[];
  explanation: string;
  expertReviewRecommended: boolean;
  requiresEscalation: boolean;
  reviewReason?: string;
  recommendedActions: string[];
  isDemo: boolean;
  disclaimer: string;
  createdAt: string;
}

// -------------------------------------------------------------
// PHASE 7: GUIDANCE & ACTION MANAGEMENT TYPES
// -------------------------------------------------------------

export type GuidanceCategory = 
  | 'IMMEDIATE_OBSERVATION'
  | 'MONITORING'
  | 'FIELD_SCOUTING'
  | 'CULTURAL_PREVENTIVE'
  | 'INTEGRATED_PEST_MANAGEMENT'
  | 'EXPERT_EXTENSION_REFERRAL'
  | 'LAB_CONFIRMATION'
  | 'FOLLOW_UP';

export type GuidancePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface GuidanceRecord {
  id: string;
  observationId: string;
  caseId?: string;
  riskAssessmentId?: string;
  category: GuidanceCategory;
  recommendation: string;
  rationale: string;
  priority: GuidancePriority;
  sourceReference?: string;
  safetyNote: string;
  version: number;
  createdAt: string;
}

export type ActionItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED';
export type ActionStatus = ActionItemStatus;

export interface ActionItem {
  id: string;
  userId: string;
  observationId: string;
  caseId?: string;
  guidanceId?: string;
  title: string;
  description: string;
  category: string;
  priority: GuidancePriority;
  dueDate?: string;
  status: ActionItemStatus;
  createdAt: string;
  completedAt?: string;
}

export type ActionItemRecord = ActionItem;

// -------------------------------------------------------------
// PHASE 8: FOLLOW-UP & OUTCOME TRACKING TYPES
// -------------------------------------------------------------

export type FollowUpStatus = 'SCHEDULED' | 'DUE' | 'COMPLETED' | 'MISSED' | 'CANCELLED';

export type SymptomTrend = 'IMPROVED' | 'UNCHANGED' | 'WORSENED' | 'NEW_SYMPTOMS' | 'UNCERTAIN';

export interface FollowUpRecord {
  id: string;
  userId: string;
  observationId: string;
  caseId?: string;
  plotId: string;
  actionId?: string;
  cropName?: string;
  plotName?: string;
  scheduledDate: string;
  completedDate?: string;
  status: FollowUpStatus;
  farmerNotes?: string;
  symptomTrend?: SymptomTrend;
  followupImageId?: string;
  hasFollowupImage?: boolean;
  outcomeSummary?: string;
  actionEffectiveness?: string;
  escalationRecommended: boolean;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// PHASE 9: CASE HISTORY & LONGITUDINAL TRACKING TYPES
// -------------------------------------------------------------

export type CaseStatus = 
  | 'OPEN' 
  | 'MONITORING' 
  | 'IMPROVING' 
  | 'WORSENING' 
  | 'RESOLVED' 
  | 'NEEDS_REVIEW';

export interface CropCase {
  id: string;
  userId: string;
  farmId: string;
  plotId: string;
  farmName?: string;
  plotName?: string;
  cropName: string;
  title: string;
  status: CaseStatus;
  severitySummary?: string;
  riskSummary?: string;
  initialObservationId?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
  observationCount?: number;
  pendingActionCount?: number;
  nextFollowUpDate?: string;
}

export type TimelineEventType = 
  | 'OBSERVATION'
  | 'ASSESSMENT'
  | 'RISK_EVALUATION'
  | 'GUIDANCE'
  | 'ACTION'
  | 'FOLLOW_UP'
  | 'OUTCOME'
  | 'CASE_STATUS';

export interface TimelineEvent {
  id: string;
  caseId: string;
  type: TimelineEventType;
  timestamp: string;
  title: string;
  description: string;
  statusBadge?: string;
  badgeVariant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  observationId?: string;
  referenceId?: string;
  hasImage?: boolean;
  imageUrl?: string;
  metadata?: Record<string, any>;
}

export type CaseTimelineEvent = TimelineEvent;

export interface CaseInsights {
  caseId: string;
  totalObservations: number;
  daysActive: number;
  latestSymptomTrend?: SymptomTrend;
  initialRiskLevel?: RiskLevel;
  currentRiskLevel?: RiskLevel;
  completedActionsCount: number;
  totalActionsCount: number;
  completedFollowUpsCount: number;
  totalFollowUpsCount: number;
  hasSufficientData: boolean;
  trendSummary: string;
  suggestedNextStep: string;
}

// -------------------------------------------------------------
// PHASE 10: EXPERT REVIEW & HUMAN VALIDATION TYPES
// -------------------------------------------------------------

export type ReviewStatus = 'OPEN' | 'ASSIGNED' | 'IN_REVIEW' | 'COMPLETED' | 'DECLINED';

export type ExpertAgreement = 
  | 'AGREE' 
  | 'DISAGREE' 
  | 'INSUFFICIENT_EVIDENCE' 
  | 'NEEDS_MORE_INFORMATION';

export interface ExpertReview {
  id: string;
  caseId?: string;
  observationId: string;
  expertId: string;
  expertName: string;
  status: ReviewStatus;
  expertAssessment?: string;
  confidenceLevel?: ConfidenceLevel;
  agreementStatus: ExpertAgreement;
  expertNotes?: string;
  recommendations: string[];
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// PHASE 11: INSTITUTIONAL AGGREGATED INTELLIGENCE TYPES
// -------------------------------------------------------------

export type TimeframeFilter = 'today' | '7d' | '30d' | 'all';

export interface InstitutionalAnalytics {
  timeframe: TimeframeFilter;
  totalObservations: number;
  activeCases: number;
  riskDistribution: Record<RiskLevel, number>;
  cropDistribution: { crop: string; observations: number; cases: number }[];
  followUpStats: {
    total: number;
    completed: number;
    improved: number;
    unchanged: number;
    worsened: number;
  };
  expertReviewStats: {
    total: number;
    pending: number;
    completed: number;
    agreeCount: number;
    disagreeCount: number;
    insufficientEvidenceCount: number;
    agreementRate: number; // Percentage 0-100
  };
  emergingSymptoms: { symptom: string; count: number }[];
  coarseHotspots: { district: string; count: number; highRiskCount: number }[];
  hasSufficientData: boolean;
  generatedAt: string;
}

// -------------------------------------------------------------
// PHASE 12: NOTIFICATION & ALERT TYPES
// -------------------------------------------------------------

export type NotificationType = 
  | 'FOLLOWUP_DUE'
  | 'FOLLOWUP_OVERDUE'
  | 'HIGH_RISK_ALERT'
  | 'EXPERT_REVIEW_COMPLETED'
  | 'ACTION_DUE'
  | 'ACTION_OVERDUE'
  | 'NEW_EXPERT_REVIEW_ASSIGNED'
  | 'CASE_STATUS_UPDATE';

export type NotificationPriority = 'INFO' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  relatedEntityType?: 'case' | 'observation' | 'action' | 'follow_up' | 'review';
  relatedEntityId?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
