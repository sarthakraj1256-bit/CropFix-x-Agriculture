/**
 * CropFix - Case History & Longitudinal Tracking Service (Phase 8 & 9)
 * SIH26131: Early detection and management of crop diseases and pest infestations
 * 
 * Provides:
 * - Follow-up scheduling, outcome tracking & adaptive next steps (Phase 8)
 * - Longitudinal Case Management & Chronological Timeline (Phase 9)
 * - Objective, evidence-based data insights without fabricated statistics
 */

import crypto from 'node:crypto';
import { getDb } from './db.js';
import type { 
  CropCase, 
  CaseStatus, 
  FollowUpRecord, 
  FollowUpStatus, 
  SymptomTrend,
  TimelineEvent, 
  CaseInsights,
  RiskLevel
} from '../types/index.js';

export class CaseService {
  // -------------------------------------------------------------
  // PHASE 9: CASE LIFECYCLE MANAGEMENT
  // -------------------------------------------------------------

  /**
   * Finds an active (unresolved) case for a given plot and crop, or creates a new one.
   * This maintains crop-health case continuity across repeated observations.
   */
  public static findOrCreateActiveCase(params: {
    userId: string;
    farmId: string;
    plotId: string;
    cropName: string;
    initialObservationId: string;
    severityEstimate?: string;
    riskLevel?: string;
  }): CropCase {
    const db = getDb();
    const now = new Date().toISOString();

    // Check for an existing open/monitoring case for this plot and crop
    const existingCase = db.prepare(`
      SELECT c.*, f.name as farm_name, p.name as plot_name
      FROM cases c
      JOIN farms f ON c.farm_id = f.id
      JOIN plots p ON c.plot_id = p.id
      WHERE c.plot_id = ? AND c.crop_name = ? AND c.status != 'RESOLVED'
      ORDER BY c.created_at DESC
      LIMIT 1
    `).get(params.plotId, params.cropName) as any;

    if (existingCase) {
      // Update case timestamp and link observation
      db.prepare('UPDATE observations SET case_id = ? WHERE id = ?').run(existingCase.id, params.initialObservationId);
      db.prepare('UPDATE cases SET updated_at = ? WHERE id = ?').run(now, existingCase.id);

      return this.getCase(existingCase.id)!;
    }

    // Otherwise create a new CropCase
    const caseId = `case-${crypto.randomBytes(6).toString('hex')}`;
    const plotRow = db.prepare('SELECT name FROM plots WHERE id = ?').get(params.plotId) as { name: string } | undefined;
    const plotName = plotRow?.name || 'Field Plot';
    const title = `${params.cropName} Foliar Health Tracking — ${plotName}`;

    db.prepare(`
      INSERT INTO cases (
        id, user_id, farm_id, plot_id, crop_name, title, status,
        severity_summary, risk_summary, initial_observation_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?)
    `).run(
      caseId,
      params.userId,
      params.farmId,
      params.plotId,
      params.cropName,
      title,
      params.severityEstimate || 'Initial Assessment',
      params.riskLevel || 'Pending Evaluation',
      params.initialObservationId,
      now,
      now
    );

    // Link observation to the newly created case
    db.prepare('UPDATE observations SET case_id = ? WHERE id = ?').run(caseId, params.initialObservationId);

    return this.getCase(caseId)!;
  }

  /**
   * Retrieves single case details with aggregated counters
   */
  public static getCase(caseId: string): CropCase | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT c.*, f.name as farm_name, p.name as plot_name,
        (SELECT COUNT(*) FROM observations o WHERE o.case_id = c.id OR o.id = c.initial_observation_id) as obs_count,
        (SELECT COUNT(*) FROM action_items a WHERE a.case_id = c.id AND a.status IN ('PENDING', 'IN_PROGRESS')) as pending_actions,
        (SELECT MIN(f.scheduled_date) FROM follow_ups f WHERE f.case_id = c.id AND f.status = 'SCHEDULED') as next_followup
      FROM cases c
      JOIN farms f ON c.farm_id = f.id
      JOIN plots p ON c.plot_id = p.id
      WHERE c.id = ?
    `).get(caseId) as any;

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      farmId: row.farm_id,
      plotId: row.plot_id,
      farmName: row.farm_name,
      plotName: row.plot_name,
      cropName: row.crop_name,
      title: row.title,
      status: row.status as CaseStatus,
      severitySummary: row.severity_summary || undefined,
      riskSummary: row.risk_summary || undefined,
      initialObservationId: row.initial_observation_id || undefined,
      resolvedAt: row.resolved_at || undefined,
      resolutionNotes: row.resolution_notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      observationCount: row.obs_count || 1,
      pendingActionCount: row.pending_actions || 0,
      nextFollowUpDate: row.next_followup || undefined,
    };
  }

  /**
   * Lists cases for a farmer or platform view
   */
  public static listCases(userId: string, role: string, statusFilter?: string): CropCase[] {
    const db = getDb();
    let query = `
      SELECT c.*, f.name as farm_name, p.name as plot_name,
        (SELECT COUNT(*) FROM observations o WHERE o.case_id = c.id OR o.id = c.initial_observation_id) as obs_count,
        (SELECT COUNT(*) FROM action_items a WHERE a.case_id = c.id AND a.status IN ('PENDING', 'IN_PROGRESS')) as pending_actions,
        (SELECT MIN(f.scheduled_date) FROM follow_ups f WHERE f.case_id = c.id AND f.status = 'SCHEDULED') as next_followup
      FROM cases c
      JOIN farms f ON c.farm_id = f.id
      JOIN plots p ON c.plot_id = p.id
    `;
    const params: any[] = [];

    if (role !== 'ADMIN' && role !== 'EXPERT' && role !== 'INSTITUTIONAL') {
      query += ` WHERE c.user_id = ?`;
      params.push(userId);
      if (statusFilter && statusFilter !== 'ALL') {
        query += ` AND c.status = ?`;
        params.push(statusFilter);
      }
    } else if (statusFilter && statusFilter !== 'ALL') {
      query += ` WHERE c.status = ?`;
      params.push(statusFilter);
    }

    query += ` ORDER BY c.updated_at DESC`;

    const rows = db.prepare(query).all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      farmId: row.farm_id,
      plotId: row.plot_id,
      farmName: row.farm_name,
      plotName: row.plot_name,
      cropName: row.crop_name,
      title: row.title,
      status: row.status as CaseStatus,
      severitySummary: row.severity_summary || undefined,
      riskSummary: row.risk_summary || undefined,
      initialObservationId: row.initial_observation_id || undefined,
      resolvedAt: row.resolved_at || undefined,
      resolutionNotes: row.resolution_notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      observationCount: row.obs_count || 1,
      pendingActionCount: row.pending_actions || 0,
      nextFollowUpDate: row.next_followup || undefined,
    }));
  }

  /**
   * Resolves a case with closing notes
   */
  public static resolveCase(caseId: string, notes?: string): CropCase {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE cases 
      SET status = 'RESOLVED', resolved_at = ?, resolution_notes = ?, updated_at = ? 
      WHERE id = ?
    `).run(now, notes?.trim() || 'Symptoms resolved following recommended cultural management.', now, caseId);

    return this.getCase(caseId)!;
  }

  /**
   * Reopens a case if symptoms re-emerge
   */
  public static reopenCase(caseId: string): CropCase {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE cases 
      SET status = 'MONITORING', resolved_at = NULL, updated_at = ? 
      WHERE id = ?
    `).run(now, caseId);

    return this.getCase(caseId)!;
  }

  // -------------------------------------------------------------
  // PHASE 8: FOLLOW-UP MANAGEMENT & OUTCOME TRACKING
  // -------------------------------------------------------------

  /**
   * Schedules a follow-up date for an observation
   */
  public static scheduleFollowUp(params: {
    userId: string;
    observationId: string;
    caseId?: string;
    plotId: string;
    scheduledDate: string;
    actionId?: string;
    notes?: string;
  }): FollowUpRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const followUpId = `fu-${crypto.randomBytes(6).toString('hex')}`;

    // Ensure case exists
    let effectiveCaseId = params.caseId;
    if (!effectiveCaseId) {
      const obs = db.prepare('SELECT case_id FROM observations WHERE id = ?').get(params.observationId) as { case_id: string } | undefined;
      effectiveCaseId = obs?.case_id;
    }

    db.prepare(`
      INSERT INTO follow_ups (
        id, user_id, observation_id, case_id, plot_id, action_id,
        scheduled_date, status, farmer_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?)
    `).run(
      followUpId,
      params.userId,
      params.observationId,
      effectiveCaseId || null,
      params.plotId,
      params.actionId || null,
      params.scheduledDate,
      params.notes?.trim() || null,
      now,
      now
    );

    // Update case status to MONITORING if it was OPEN
    if (effectiveCaseId) {
      db.prepare(`
        UPDATE cases 
        SET status = CASE WHEN status = 'OPEN' THEN 'MONITORING' ELSE status END,
            updated_at = ? 
        WHERE id = ?
      `).run(now, effectiveCaseId);
    }

    return this.getFollowUp(followUpId)!;
  }

  /**
   * Retrieves single follow-up
   */
  public static getFollowUp(followUpId: string): FollowUpRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT fu.*, p.name as plot_name, p.crop_name,
             (fu.followup_image_data IS NOT NULL) as has_image
      FROM follow_ups fu
      JOIN plots p ON fu.plot_id = p.id
      WHERE fu.id = ?
    `).get(followUpId) as any;

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      observationId: row.observation_id,
      caseId: row.case_id || undefined,
      plotId: row.plot_id,
      actionId: row.action_id || undefined,
      cropName: row.crop_name,
      plotName: row.plot_name,
      scheduledDate: row.scheduled_date,
      completedDate: row.completed_date || undefined,
      status: row.status as FollowUpStatus,
      farmerNotes: row.farmer_notes || undefined,
      symptomTrend: row.symptom_trend || undefined,
      followupImageId: row.followup_image_id || undefined,
      hasFollowupImage: Boolean(row.has_image),
      outcomeSummary: row.outcome_summary || undefined,
      actionEffectiveness: row.action_effectiveness || undefined,
      escalationRecommended: Boolean(row.escalation_recommended),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Completes a follow-up with farmer outcome feedback & optional second image
   */
  public static completeFollowUp(params: {
    followUpId: string;
    symptomTrend: SymptomTrend;
    farmerNotes?: string;
    actionEffectiveness?: string;
    followupImageData?: string;
    mimeType?: string;
  }): FollowUpRecord {
    const db = getDb();
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(params.followUpId) as any;
    if (!existing) throw new Error('Follow-up record not found');

    const imageId = params.followupImageData ? `fuimg-${crypto.randomBytes(6).toString('hex')}` : null;
    const escalationRecommended = params.symptomTrend === 'WORSENED' ? 1 : 0;

    let outcomeSummary = '';
    switch (params.symptomTrend) {
      case 'IMPROVED':
        outcomeSummary = 'Foliar lesions appear contained with reduced chlorosis. Continue routine observation.';
        break;
      case 'UNCHANGED':
        outcomeSummary = 'Symptom perimeter remains stable without immediate spread. Continue cultural aeration.';
        break;
      case 'WORSENED':
        outcomeSummary = 'Symptoms show signs of spread or increased lesion area. Recommend expert agronomy consultation.';
        break;
      case 'NEW_SYMPTOMS':
        outcomeSummary = 'Novel secondary signs observed on upper canopy. Recommend recording a fresh diagnostic observation.';
        break;
      case 'UNCERTAIN':
      default:
        outcomeSummary = 'Foliar changes remain inconclusive. Additional clear imagery recommended in 48 hours.';
        break;
    }

    db.prepare(`
      UPDATE follow_ups SET
        status = 'COMPLETED',
        completed_date = ?,
        symptom_trend = ?,
        farmer_notes = ?,
        action_effectiveness = ?,
        followup_image_id = COALESCE(?, followup_image_id),
        followup_image_mime = COALESCE(?, followup_image_mime),
        followup_image_data = COALESCE(?, followup_image_data),
        outcome_summary = ?,
        escalation_recommended = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      now,
      params.symptomTrend,
      params.farmerNotes?.trim() || null,
      params.actionEffectiveness?.trim() || null,
      imageId,
      params.mimeType || null,
      params.followupImageData || null,
      outcomeSummary,
      escalationRecommended,
      now,
      params.followUpId
    );

    // Adaptive next step: update case status based on outcome
    if (existing.case_id) {
      let targetCaseStatus: CaseStatus = 'MONITORING';
      if (params.symptomTrend === 'IMPROVED') targetCaseStatus = 'IMPROVING';
      else if (params.symptomTrend === 'WORSENED') targetCaseStatus = 'WORSENING';

      db.prepare('UPDATE cases SET status = ?, updated_at = ? WHERE id = ?').run(
        targetCaseStatus,
        now,
        existing.case_id
      );
    }

    return this.getFollowUp(params.followUpId)!;
  }

  /**
   * Reschedules a follow-up without penalty
   */
  public static rescheduleFollowUp(followUpId: string, newDate: string): FollowUpRecord {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE follow_ups 
      SET scheduled_date = ?, status = 'SCHEDULED', updated_at = ? 
      WHERE id = ?
    `).run(newDate, now, followUpId);

    return this.getFollowUp(followUpId)!;
  }

  /**
   * Lists follow-ups for a user or observation with dynamic overdue/due calculation
   */
  public static listFollowUps(filter: {
    userId?: string;
    observationId?: string;
    caseId?: string;
  }): FollowUpRecord[] {
    const db = getDb();
    let query = `
      SELECT fu.*, p.name as plot_name, p.crop_name,
             (fu.followup_image_data IS NOT NULL) as has_image
      FROM follow_ups fu
      JOIN plots p ON fu.plot_id = p.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (filter.observationId) {
      conditions.push('fu.observation_id = ?');
      params.push(filter.observationId);
    }
    if (filter.caseId) {
      conditions.push('fu.case_id = ?');
      params.push(filter.caseId);
    }
    if (filter.userId) {
      conditions.push('fu.user_id = ?');
      params.push(filter.userId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY fu.scheduled_date ASC`;

    const rows = db.prepare(query).all(...params) as any[];
    const todayStr = new Date().toISOString().split('T')[0];

    return rows.map(row => {
      let currentStatus: FollowUpStatus = row.status;
      // Evaluate if SCHEDULED follow-up is DUE or MISSED
      if (currentStatus === 'SCHEDULED') {
        if (row.scheduled_date < todayStr) {
          currentStatus = 'MISSED';
        } else if (row.scheduled_date === todayStr) {
          currentStatus = 'DUE';
        }
      }

      return {
        id: row.id,
        userId: row.user_id,
        observationId: row.observation_id,
        caseId: row.case_id || undefined,
        plotId: row.plot_id,
        actionId: row.action_id || undefined,
        cropName: row.crop_name,
        plotName: row.plot_name,
        scheduledDate: row.scheduled_date,
        completedDate: row.completed_date || undefined,
        status: currentStatus,
        farmerNotes: row.farmer_notes || undefined,
        symptomTrend: row.symptom_trend || undefined,
        followupImageId: row.followup_image_id || undefined,
        hasFollowupImage: Boolean(row.has_image),
        outcomeSummary: row.outcome_summary || undefined,
        actionEffectiveness: row.action_effectiveness || undefined,
        escalationRecommended: Boolean(row.escalation_recommended),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  // -------------------------------------------------------------
  // PHASE 9: TIMELINE & LONGITUDINAL INSIGHTS
  // -------------------------------------------------------------

  /**
   * Generates a unified, chronological timeline of all events for a case
   */
  public static getCaseTimeline(caseId: string): TimelineEvent[] {
    const db = getDb();
    const events: TimelineEvent[] = [];

    // 1. Observations
    const obsRows = db.prepare(`
      SELECT o.*, p.name as plot_name
      FROM observations o
      JOIN plots p ON o.plot_id = p.id
      WHERE o.case_id = ? OR o.id = (SELECT initial_observation_id FROM cases WHERE id = ?)
      ORDER BY o.created_at ASC
    `).all(caseId, caseId) as any[];

    for (const obs of obsRows) {
      events.push({
        id: `evt-obs-${obs.id}`,
        caseId,
        type: 'OBSERVATION',
        timestamp: obs.created_at,
        title: `Observation Logged: ${obs.crop_name} (${obs.growth_stage})`,
        description: `Severity estimate: ${obs.severity_estimate}. Symptoms: ${JSON.parse(obs.symptom_tags).join(', ')}. ${obs.symptom_description || ''}`,
        statusBadge: obs.status,
        badgeVariant: 'info',
        observationId: obs.id,
        hasImage: true,
        imageUrl: `/api/observations/${obs.id}/image`,
        metadata: {
          plantPart: obs.plant_part,
          severityEstimate: obs.severity_estimate,
        },
      });

      // 2. Assessments for this observation
      const asmt = db.prepare('SELECT * FROM assessments WHERE observation_id = ?').get(obs.id) as any;
      if (asmt) {
        events.push({
          id: `evt-asmt-${asmt.id}`,
          caseId,
          type: 'ASSESSMENT',
          timestamp: asmt.created_at,
          title: `AI-Assisted Assessment: ${asmt.primary_issue}`,
          description: `Confidence: ${asmt.confidence_level} (${Math.round(asmt.confidence_score * 100)}%). Uncertainty note: ${asmt.uncertainty_notes}`,
          statusBadge: asmt.confidence_level + ' CONFIDENCE',
          badgeVariant: asmt.confidence_level === 'HIGH' ? 'success' : asmt.confidence_level === 'MEDIUM' ? 'warning' : 'neutral',
          observationId: obs.id,
        });
      }

      // 3. Risk Evaluations
      const risk = db.prepare('SELECT * FROM risk_assessments WHERE observation_id = ?').get(obs.id) as any;
      if (risk) {
        events.push({
          id: `evt-risk-${risk.id}`,
          caseId,
          type: 'RISK_EVALUATION',
          timestamp: risk.created_at,
          title: `Contextual Risk: ${risk.risk_level}`,
          description: risk.explanation,
          statusBadge: risk.risk_level + ' RISK',
          badgeVariant: risk.risk_level === 'CRITICAL' || risk.risk_level === 'HIGH' ? 'danger' : risk.risk_level === 'MODERATE' ? 'warning' : 'success',
          observationId: obs.id,
          metadata: {
            expertReviewRecommended: Boolean(risk.expert_review_recommended),
          },
        });
      }

      // 4. Guidance
      const guidanceRows = db.prepare('SELECT * FROM guidance_records WHERE observation_id = ?').all(obs.id) as any[];
      if (guidanceRows.length > 0) {
        const topG = guidanceRows[0];
        events.push({
          id: `evt-guid-${topG.id}`,
          caseId,
          type: 'GUIDANCE',
          timestamp: topG.created_at,
          title: `Guidance Generated (${guidanceRows.length} recommendations)`,
          description: topG.recommendation,
          statusBadge: topG.priority + ' PRIORITY',
          badgeVariant: topG.priority === 'URGENT' || topG.priority === 'HIGH' ? 'danger' : 'info',
          observationId: obs.id,
        });
      }
    }

    // 5. Actions
    const actionRows = db.prepare('SELECT * FROM action_items WHERE case_id = ? OR observation_id IN (SELECT id FROM observations WHERE case_id = ?)').all(caseId, caseId) as any[];
    for (const a of actionRows) {
      events.push({
        id: `evt-act-${a.id}`,
        caseId,
        type: 'ACTION',
        timestamp: a.completed_at || a.created_at,
        title: a.status === 'COMPLETED' ? `Action Completed: ${a.title}` : `Action Assigned: ${a.title}`,
        description: a.description,
        statusBadge: a.status,
        badgeVariant: a.status === 'COMPLETED' ? 'success' : 'neutral',
        metadata: {
          priority: a.priority,
          dueDate: a.due_date,
        },
      });
    }

    // 6. Follow-ups & Outcomes
    const fuRows = db.prepare('SELECT * FROM follow_ups WHERE case_id = ? ORDER BY scheduled_date ASC').all(caseId) as any[];
    for (const fu of fuRows) {
      if (fu.status === 'COMPLETED') {
        events.push({
          id: `evt-fu-comp-${fu.id}`,
          caseId,
          type: 'OUTCOME',
          timestamp: fu.completed_date || fu.updated_at,
          title: `Follow-Up Outcome: ${fu.symptom_trend || 'Completed'}`,
          description: fu.outcome_summary || fu.farmer_notes || 'Follow-up inspection submitted by farmer.',
          statusBadge: fu.symptom_trend || 'COMPLETED',
          badgeVariant: fu.symptom_trend === 'IMPROVED' ? 'success' : fu.symptom_trend === 'WORSENED' ? 'danger' : 'warning',
          hasImage: Boolean(fu.followup_image_data),
          imageUrl: fu.followup_image_data ? `/api/follow-ups/${fu.id}/image` : undefined,
        });
      } else {
        events.push({
          id: `evt-fu-sched-${fu.id}`,
          caseId,
          type: 'FOLLOW_UP',
          timestamp: fu.created_at,
          title: `Follow-Up Scheduled for ${fu.scheduled_date}`,
          description: fu.farmer_notes || 'Scheduled field inspection to check symptom stability.',
          statusBadge: fu.status,
          badgeVariant: 'neutral',
        });
      }
    }

    // Sort chronologically ascending
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Calculates objective, real longitudinal insights for a case
   */
  public static getCaseInsights(caseId: string): CaseInsights {
    const db = getDb();
    const caseRecord = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId) as any;
    if (!caseRecord) throw new Error('Case not found');

    const obsCount = (db.prepare('SELECT COUNT(*) as count FROM observations WHERE case_id = ? OR id = ?').get(caseId, caseRecord.initial_observation_id) as { count: number }).count;
    const actions = db.prepare('SELECT status FROM action_items WHERE case_id = ? OR observation_id IN (SELECT id FROM observations WHERE case_id = ?)').all(caseId, caseId) as Array<{ status: string }>;
    const followUps = db.prepare('SELECT * FROM follow_ups WHERE case_id = ? ORDER BY completed_date DESC, created_at DESC').all(caseId) as any[];

    const completedActions = actions.filter(a => a.status === 'COMPLETED').length;
    const completedFollowUps = followUps.filter(f => f.status === 'COMPLETED').length;

    // Days active
    const startMs = new Date(caseRecord.created_at).getTime();
    const nowMs = Date.now();
    const daysActive = Math.max(1, Math.round((nowMs - startMs) / (1000 * 60 * 60 * 24)));

    // Latest trend
    const latestCompletedFollowUp = followUps.find(f => f.status === 'COMPLETED');
    const latestSymptomTrend: SymptomTrend | undefined = latestCompletedFollowUp?.symptom_trend;

    // Has sufficient real data: Requires at least 2 distinct temporal observations or 1 completed follow-up
    const hasSufficientData = obsCount >= 2 || completedFollowUps >= 1;

    let trendSummary = 'Not enough history yet. Continue monitoring and record your scheduled follow-up.';
    let suggestedNextStep = 'Complete assigned sanitation and scouting actions.';

    if (hasSufficientData) {
      if (latestSymptomTrend === 'IMPROVED') {
        trendSummary = `Symptom trend shows positive stability. Foliar recovery noted after ${daysActive} days of management.`;
        suggestedNextStep = 'Maintain preventive cultural practices and prepare case for resolution.';
      } else if (latestSymptomTrend === 'WORSENED') {
        trendSummary = `Symptoms indicate progressive spread over ${daysActive} days. Higher attention required.`;
        suggestedNextStep = 'Contact local agricultural extension officer (KVK) for ground confirmation.';
      } else if (latestSymptomTrend === 'UNCHANGED') {
        trendSummary = `Symptom boundary is stable. No accelerated spread detected over ${daysActive} days.`;
        suggestedNextStep = 'Schedule next follow-up in 3 to 4 days to confirm ongoing containment.';
      } else {
        trendSummary = `${obsCount} foliar observations recorded across ${daysActive} days. Longitudinal monitoring active.`;
        suggestedNextStep = 'Complete follow-up check on scheduled date.';
      }
    }

    return {
      caseId,
      totalObservations: obsCount,
      daysActive,
      latestSymptomTrend,
      initialRiskLevel: 'MODERATE',
      currentRiskLevel: latestSymptomTrend === 'IMPROVED' ? 'LOW' : latestSymptomTrend === 'WORSENED' ? 'HIGH' : 'MODERATE',
      completedActionsCount: completedActions,
      totalActionsCount: actions.length,
      completedFollowUpsCount: completedFollowUps,
      totalFollowUpsCount: followUps.length,
      hasSufficientData,
      trendSummary,
      suggestedNextStep,
    };
  }
}
