/**
 * CropFix - Expert Human Validation & Agronomy Review Service
 * SIH26131: Early detection and management of crop diseases and pest infestations
 * Phase 10 Implementation
 */

import crypto from 'node:crypto';
import { getDb } from './db.js';
import { NotificationService } from './notificationService.js';
import type { 
  ExpertReview, 
  ExpertAgreement, 
  ReviewStatus, 
  ConfidenceLevel, 
  User, 
  Observation,
  RiskLevel 
} from '../types/index.js';

interface DbExpertReviewRow {
  id: string;
  case_id: string | null;
  observation_id: string;
  expert_id: string;
  expert_name: string;
  status: string;
  expert_assessment: string | null;
  confidence_level: string | null;
  agreement_status: string;
  expert_notes: string | null;
  recommendations: string | null;
  priority: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToExpertReview(row: DbExpertReviewRow): ExpertReview {
  let recommendations: string[] = [];
  try {
    if (row.recommendations) {
      recommendations = JSON.parse(row.recommendations);
    }
  } catch {
    recommendations = row.recommendations ? [row.recommendations] : [];
  }

  return {
    id: row.id,
    caseId: row.case_id || undefined,
    observationId: row.observation_id,
    expertId: row.expert_id,
    expertName: row.expert_name,
    status: row.status as ReviewStatus,
    expertAssessment: row.expert_assessment || undefined,
    confidenceLevel: (row.confidence_level as ConfidenceLevel) || undefined,
    agreementStatus: row.agreement_status as ExpertAgreement,
    expertNotes: row.expert_notes || undefined,
    recommendations,
    priority: row.priority as 'NORMAL' | 'HIGH' | 'URGENT',
    reviewedAt: row.reviewed_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ExpertQueueItem {
  observationId: string;
  caseId?: string;
  cropName: string;
  growthStage: string;
  affectedPart: string;
  severityEstimate: string;
  symptomDescription?: string;
  submittedAt: string;
  farmerDistrict?: string;
  status: string;
  hasImage: boolean;
  aiPrimaryIssue?: string;
  aiConfidenceScore?: number;
  riskLevel?: RiskLevel;
  triggerReason: string;
  review?: ExpertReview;
}

export class ExpertService {
  /**
   * Lists field cases queued for agronomist review.
   * Only accessible to authenticated EXPERT or ADMIN users.
   */
  static listExpertQueue(filters?: {
    status?: string;
    crop?: string;
    risk?: string;
  }): ExpertQueueItem[] {
    const db = getDb();

    // Query observations that are flagged for review or have an existing expert review
    let query = `
      SELECT 
        o.id as obs_id,
        c.id as case_id,
        o.crop_name,
        o.growth_stage,
        o.plant_part as affected_part,
        o.severity_estimate,
        o.symptom_description,
        o.status as obs_status,
        o.created_at as obs_created_at,
        u.district as farmer_district,
        a.primary_issue as ai_primary_issue,
        a.confidence_score as ai_confidence,
        r.risk_level as risk_level,
        er.id as review_id
      FROM observations o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN cases c ON c.plot_id = o.plot_id AND c.crop_name = o.crop_name AND c.status != 'RESOLVED'
      LEFT JOIN assessments a ON o.id = a.observation_id
      LEFT JOIN risk_assessments r ON o.id = r.observation_id
      LEFT JOIN expert_reviews er ON o.id = er.observation_id
      WHERE (o.status = 'NEEDS_REVIEW' OR er.id IS NOT NULL)
    `;

    const params: any[] = [];

    if (filters?.crop) {
      query += ' AND o.crop_name = ?';
      params.push(filters.crop);
    }

    if (filters?.risk) {
      query += ' AND r.risk_level = ?';
      params.push(filters.risk);
    }

    query += ' ORDER BY o.created_at DESC';

    const rows = db.prepare(query).all(...params) as any[];

    return rows.map((r) => {
      let triggerReason = 'Agronomist validation requested';
      if (r.risk_level === 'HIGH' || r.risk_level === 'CRITICAL') {
        triggerReason = `Elevated biological risk (${r.risk_level})`;
      } else if (r.ai_confidence && r.ai_confidence < 0.65) {
        triggerReason = `Low diagnostic confidence (${Math.round(r.ai_confidence * 100)}%)`;
      } else if (r.obs_status === 'NEEDS_REVIEW') {
        triggerReason = 'Farmer initiated escalation';
      }

      let review: ExpertReview | undefined;
      if (r.review_id) {
        const reviewRow = db.prepare('SELECT * FROM expert_reviews WHERE id = ?').get(r.review_id) as unknown as DbExpertReviewRow;
        if (reviewRow) {
          review = mapRowToExpertReview(reviewRow);
        }
      }

      return {
        observationId: r.obs_id,
        caseId: r.case_id || undefined,
        cropName: r.crop_name,
        growthStage: r.growth_stage,
        affectedPart: r.affected_part,
        severityEstimate: r.severity_estimate,
        symptomDescription: r.symptom_description || undefined,
        submittedAt: r.obs_created_at,
        farmerDistrict: r.farmer_district || undefined,
        status: r.obs_status,
        hasImage: true,
        aiPrimaryIssue: r.ai_primary_issue || undefined,
        aiConfidenceScore: r.ai_confidence ? Number(r.ai_confidence) : undefined,
        riskLevel: r.risk_level || undefined,
        triggerReason,
        review,
      };
    });
  }

  /**
   * Retrieves an expert review for a specific observation.
   */
  static getReviewForObservation(observationId: string): ExpertReview | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM expert_reviews WHERE observation_id = ?').get(observationId) as unknown as DbExpertReviewRow | undefined;
    if (!row) return null;
    return mapRowToExpertReview(row);
  }

  /**
   * Submits or updates an Expert Review.
   * AI diagnostic assessment is NEVER modified or overwritten.
   * Runs in a SQLite transaction with atomic status updates, audit log, and farmer notification.
   */
  static submitExpertReview(params: {
    observationId: string;
    expertUser: User;
    agreementStatus: ExpertAgreement;
    expertAssessment?: string;
    confidenceLevel?: ConfidenceLevel;
    expertNotes?: string;
    recommendations?: string[];
    priority?: 'NORMAL' | 'HIGH' | 'URGENT';
  }): ExpertReview {
    const db = getDb();
    const now = new Date().toISOString();

    // Verify observation exists and fetch farmer owner
    const obs = db.prepare('SELECT id, user_id, plot_id, crop_name FROM observations WHERE id = ?').get(params.observationId) as any;
    if (!obs) {
      throw new Error('Observation not found for expert review');
    }

    const activeCase = db.prepare(`SELECT id, status FROM cases WHERE plot_id = ? AND crop_name = ? AND status != 'RESOLVED' LIMIT 1`).get(obs.plot_id, obs.crop_name) as any;
    const caseId = activeCase?.id || null;

    const priority = params.priority || 'NORMAL';
    const recommendationsJson = JSON.stringify(params.recommendations || [
      'Implement strict field sanitation and clean pruning tools between rows.',
      'Scout 10 randomized plants across the plot to establish true foliar incidence percentage.',
      'Maintain adequate canopy aeration and avoid overhead irrigation.'
    ]);

    // Check if an existing review exists
    const existing = db.prepare('SELECT id FROM expert_reviews WHERE observation_id = ?').get(params.observationId) as { id: string } | undefined;
    const reviewId = existing ? existing.id : `rev-${crypto.randomBytes(8).toString('hex')}`;

    // Transaction execution
    db.exec('BEGIN TRANSACTION');
    try {
      if (existing) {
        db.prepare(`
          UPDATE expert_reviews
          SET expert_id = ?, expert_name = ?, status = 'COMPLETED',
              expert_assessment = ?, confidence_level = ?, agreement_status = ?,
              expert_notes = ?, recommendations = ?, priority = ?,
              reviewed_at = ?, updated_at = ?
          WHERE id = ?
        `).run(
          params.expertUser.id,
          params.expertUser.name,
          params.expertAssessment || null,
          params.confidenceLevel || 'HIGH',
          params.agreementStatus,
          params.expertNotes || null,
          recommendationsJson,
          priority,
          now,
          now,
          reviewId
        );
      } else {
        db.prepare(`
          INSERT INTO expert_reviews (
            id, case_id, observation_id, expert_id, expert_name, status,
            expert_assessment, confidence_level, agreement_status, expert_notes,
            recommendations, priority, reviewed_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          reviewId,
          caseId,
          params.observationId,
          params.expertUser.id,
          params.expertUser.name,
          params.expertAssessment || null,
          params.confidenceLevel || 'HIGH',
          params.agreementStatus,
          params.expertNotes || null,
          recommendationsJson,
          priority,
          now,
          now,
          now
        );
      }

      // Update observation status to ASSESSED (resolving the escalated state)
      db.prepare(`
        UPDATE observations 
        SET status = 'ASSESSED', updated_at = ?
        WHERE id = ?
      `).run(now, params.observationId);

      // If linked to a case, update case status if it was in NEEDS_REVIEW
      if (caseId) {
        db.prepare(`
          UPDATE cases 
          SET status = 'MONITORING', updated_at = ?
          WHERE id = ? AND status = 'NEEDS_REVIEW'
        `).run(now, caseId);
      }

      // Record in audit logs
      const auditId = `audit-${crypto.randomBytes(8).toString('hex')}`;
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, created_at)
        VALUES (?, ?, 'SUBMIT_EXPERT_REVIEW', 'observation', ?, ?, ?)
      `).run(
        auditId,
        params.expertUser.id,
        params.observationId,
        JSON.stringify({
          expertName: params.expertUser.name,
          agreement: params.agreementStatus,
          assessment: params.expertAssessment,
        }),
        now
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    // Send notification to the farmer regarding the completed validation
    try {
      NotificationService.createNotification({
        userId: obs.user_id,
        type: 'EXPERT_REVIEW_COMPLETED',
        title: `Agronomist Review Completed: ${obs.crop_name}`,
        message: `${params.expertUser.name} validated your observation. Review decision: ${params.agreementStatus}.`,
        priority: 'HIGH',
        relatedEntityType: 'review',
        relatedEntityId: reviewId,
      });
    } catch (notifErr) {
      console.warn('Failed to send notification to farmer for review:', notifErr);
    }

    const finalRow = db.prepare('SELECT * FROM expert_reviews WHERE id = ?').get(reviewId) as unknown as DbExpertReviewRow;
    return mapRowToExpertReview(finalRow);
  }

  // Compatibility aliases for automated tests and legacy callers
  static getReviewQueue(filters?: { status?: string; crop?: string; risk?: string }) {
    return this.listExpertQueue(filters);
  }

  static getReviewByObservationId(observationId: string) {
    return this.getReviewForObservation(observationId);
  }

  static getObservationForReview(observationId: string) {
    const db = getDb();
    return db.prepare('SELECT * FROM observations WHERE id = ?').get(observationId) as any;
  }

  static submitReview(params: {
    observationId: string;
    expertId: string;
    expertName: string;
    agreementStatus: ExpertAgreement;
    expertAssessment?: string;
    confidenceLevel?: ConfidenceLevel;
    expertNotes?: string;
    recommendations?: string[];
    priority?: 'NORMAL' | 'HIGH' | 'URGENT';
  }) {
    return this.submitExpertReview({
      observationId: params.observationId,
      expertUser: { id: params.expertId, name: params.expertName, role: 'EXPERT' } as any,
      agreementStatus: params.agreementStatus,
      expertAssessment: params.expertAssessment,
      confidenceLevel: params.confidenceLevel,
      expertNotes: params.expertNotes,
      recommendations: params.recommendations,
      priority: params.priority,
    });
  }
}
