/**
 * CropFix - Risk & Uncertainty Intelligence Service (Phase 6)
 * SIH26131: Early detection and management of crop diseases and pest infestations
 * 
 * CORE PRINCIPLE:
 * AI Confidence != Risk
 * Risk != Confirmed Diagnosis
 * Uncertainty is a first-class agricultural concept.
 */

import crypto from 'node:crypto';
import { getDb } from './db.js';
import type { 
  AssessmentRecord, 
  RiskAssessmentRecord, 
  RiskLevel, 
  RiskFactor, 
  UncertaintyFactor,
  Observation 
} from '../types/index.js';

export class RiskService {
  /**
   * Evaluates contextual risk and uncertainty for an assessed observation
   */
  static evaluate(observation: Observation, assessment: AssessmentRecord): RiskAssessmentRecord {
    const db = getDb();

    // Check if risk assessment already exists
    const existing = db.prepare('SELECT * FROM risk_assessments WHERE observation_id = ?').get(observation.id) as {
      id: string;
      observation_id: string;
      assessment_id: string;
      risk_level: string;
      risk_score: number;
      risk_factors: string;
      uncertainty_factors: string;
      explanation: string;
      expert_review_recommended: number;
      requires_escalation: number;
      review_reason: string | null;
      recommended_actions: string;
      is_demo: number;
      disclaimer: string;
      created_at: string;
    } | undefined;

    if (existing) {
      return {
        id: existing.id,
        observationId: existing.observation_id,
        assessmentId: existing.assessment_id,
        riskLevel: existing.risk_level as RiskLevel,
        riskScore: existing.risk_score,
        riskFactors: JSON.parse(existing.risk_factors),
        uncertaintyFactors: JSON.parse(existing.uncertainty_factors),
        explanation: existing.explanation,
        expertReviewRecommended: Boolean(existing.expert_review_recommended),
        requiresEscalation: Boolean(existing.requires_escalation),
        reviewReason: existing.review_reason || undefined,
        recommendedActions: JSON.parse(existing.recommended_actions),
        isDemo: Boolean(existing.is_demo),
        disclaimer: existing.disclaimer,
        createdAt: existing.created_at,
      };
    }

    const riskFactors: RiskFactor[] = [];
    const uncertaintyFactors: UncertaintyFactor[] = [];
    const recommendedActions: string[] = [];

    let riskScore = 30; // base score out of 100
    let riskLevel: RiskLevel = 'LOW';
    let expertReviewRecommended = false;
    let requiresEscalation = false;
    let reviewReason: string | undefined = undefined;

    // 1. Evaluate Crop Stage Sensitivity
    const stage = observation.growthStage;
    if (stage === 'Flowering' || stage === 'Fruit / Grain Formation') {
      riskScore += 25;
      riskFactors.push({
        factor: 'Critical Reproductive Growth Stage',
        impact: 'high',
        detail: `Crop is at ${stage} stage where foliar damage directly impacts yield formation and fruit setting.`
      });
    } else if (stage === 'Vegetative') {
      riskScore += 10;
      riskFactors.push({
        factor: 'Vegetative Canopy Development',
        impact: 'moderate',
        detail: 'Damage may slow photosynthetic biomass accumulation, but crop retains compensation capacity.'
      });
    } else {
      riskFactors.push({
        factor: 'Early / Late Stage',
        impact: 'low',
        detail: `Observed during ${stage} phase.`
      });
    }

    // 2. Evaluate Severity Level from Field Observation
    const severity = observation.severityEstimate;
    if (severity.includes('Severe') || severity.includes('widespread')) {
      riskScore += 35;
      riskFactors.push({
        factor: 'Widespread Field Dispersion',
        impact: 'high',
        detail: 'Farmer reports widespread multi-plant symptom distribution across plot.'
      });
    } else if (severity.includes('Moderate')) {
      riskScore += 15;
      riskFactors.push({
        factor: 'Clustered Foliar Manifestation',
        impact: 'moderate',
        detail: 'Symptoms visible across multiple adjacent leaves on sampled plants.'
      });
    } else {
      riskFactors.push({
        factor: 'Localized Initial Inoculum',
        impact: 'low',
        detail: 'Isolated spots currently confined to single leaves or plants.'
      });
    }

    // 3. Evaluate Issue Category Inherent Spread Risk
    const cat = assessment.issueCategory;
    if (cat === 'bacterial_disease') {
      riskScore += 20;
      riskFactors.push({
        factor: 'Rapid Vascular Pathogen Trajectory',
        impact: 'high',
        detail: 'Bacterial wilt and vascular blights can cause irreversible plant collapse under warm humid conditions.'
      });
    } else if (cat === 'fungal_disease') {
      riskScore += 15;
      riskFactors.push({
        factor: 'Foliar Airborne Spore Dispersal',
        impact: 'moderate',
        detail: 'Fungal spores can spread with morning dew and wind currents to adjacent rows.'
      });
    } else if (cat === 'pest_damage') {
      riskScore += 15;
      riskFactors.push({
        factor: 'Insect Larval Feeding Activity',
        impact: 'moderate',
        detail: 'Rapid defoliation can occur as larvae mature without physical intervention.'
      });
    } else if (cat === 'viral_disease') {
      riskScore += 20;
      riskFactors.push({
        factor: 'Insect Vector Transmission',
        impact: 'high',
        detail: 'Viral infections cannot be cured once systemic; containment relies on controlling vector populations.'
      });
    } else if (cat === 'insufficient_evidence') {
      riskLevel = 'UNCERTAIN';
      uncertaintyFactors.push({
        factor: 'Diagnostic Uncertainty',
        detail: 'Insufficient symptom features to calculate deterministic biological risk.'
      });
    }

    // 4. Uncertainty Evaluation (First-class concept)
    uncertaintyFactors.push({
      factor: 'Micro-climate & Weather Sensor Data',
      detail: 'Local field canopy humidity and temperature telemetry currently unintegrated in prototype.'
    });

    if (assessment.confidenceLevel === 'LOW') {
      uncertaintyFactors.push({
        factor: 'Low AI Confidence on Primary Pattern',
        detail: 'Visible morphological signs overlap with secondary abiotic stresses.'
      });
    }

    if (assessment.alternativeCandidates.length > 0) {
      const topAlt = assessment.alternativeCandidates[0];
      if (topAlt.likelihoodScore > 0.4) {
        uncertaintyFactors.push({
          factor: 'Competing Diagnostic Possibility',
          detail: `Significant diagnostic overlap with ${topAlt.issueName} (${Math.round(topAlt.likelihoodScore * 100)}% likelihood).`
        });
      }
    }

    // 5. Determine Overall Risk Level & Escalation
    if (riskLevel !== 'UNCERTAIN') {
      if (riskScore >= 70) {
        riskLevel = 'HIGH';
        expertReviewRecommended = true;
        requiresEscalation = true;
        reviewReason = 'High contextual risk: Potential for rapid yield impact or widespread field spread.';
      } else if (riskScore >= 45) {
        riskLevel = 'MODERATE';
        expertReviewRecommended = assessment.confidenceLevel === 'LOW';
        if (expertReviewRecommended) {
          reviewReason = 'Moderate risk paired with low AI assessment confidence.';
        }
      } else {
        riskLevel = 'LOW';
        expertReviewRecommended = false;
      }
    } else {
      expertReviewRecommended = true;
      requiresEscalation = true;
      reviewReason = 'Uncertain risk profile: Insufficient visual and descriptive evidence.';
    }

    // 6. Safe, Evidence-Grounded Next Steps (NO CHEMICAL DOSAGES)
    recommendedActions.push('Scout 10 randomized plants across the plot to establish true incidence percentage.');
    recommendedActions.push('Physically inspect the underside of affected leaves for pest frass or fungal spore masses.');
    
    if (riskLevel === 'HIGH' || (riskLevel as string) === 'CRITICAL') {
      recommendedActions.push('Higher attention may be needed: Segregate or tag affected sample plants to monitor 24-hour symptom progression.');
      recommendedActions.push('Primary action: Request Expert Review from a certified agricultural agronomist or local KVK.');
    } else if (riskLevel === 'UNCERTAIN') {
      recommendedActions.push('Take an additional in-focus photo under diffuse morning daylight.');
      recommendedActions.push('Request human expert review for definitive field assessment.');
    } else {
      recommendedActions.push('Maintain clean field sanitation and sanitize hand tools after handling suspect foliage.');
      recommendedActions.push('Record a follow-up observation in 3 to 5 days to track symptom stability.');
    }

    const explanation = riskLevel === 'HIGH'
      ? 'Higher attention may be needed. Critical crop stage combined with reported spread creates elevated risk of harvest loss.'
      : riskLevel === 'MODERATE'
      ? 'Moderate risk. Issue requires proactive field monitoring to prevent secondary canopy spread.'
      : riskLevel === 'LOW'
      ? 'Low immediate risk. Symptoms appear early or localized with minimal current yield jeopardy.'
      : 'Risk is uncertain due to insufficient visual or symptom clarity. Expert review is advised.';

    const riskId = `risk-${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO risk_assessments (
        id, observation_id, assessment_id, risk_level, risk_score, risk_factors,
        uncertainty_factors, explanation, expert_review_recommended, requires_escalation,
        review_reason, recommended_actions, is_demo, disclaimer, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      riskId,
      observation.id,
      assessment.id,
      riskLevel,
      riskScore,
      JSON.stringify(riskFactors),
      JSON.stringify(uncertaintyFactors),
      explanation,
      expertReviewRecommended ? 1 : 0,
      requiresEscalation ? 1 : 0,
      reviewReason || null,
      JSON.stringify(recommendedActions),
      1,
      'Demo Risk Assessment: Risk calculations are contextual decision-support estimates. Consult accredited agricultural officers.',
      now
    );

    return {
      id: riskId,
      observationId: observation.id,
      assessmentId: assessment.id,
      riskLevel,
      riskScore,
      riskFactors,
      uncertaintyFactors,
      explanation,
      expertReviewRecommended,
      requiresEscalation,
      reviewReason,
      recommendedActions,
      isDemo: true,
      disclaimer: 'Demo Risk Assessment: Risk calculations are contextual decision-support estimates. Consult accredited agricultural officers.',
      createdAt: now,
    };
  }
}
