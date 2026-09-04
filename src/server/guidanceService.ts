/**
 * CropFix - Guidance & Action Management Service (Phase 7)
 * SIH26131: Early detection and management of crop diseases and pest infestations
 * 
 * Strict agricultural safety rules:
 * - Evidence-aware: reflects uncertainty and contextual risk
 * - NEVER invents pesticide dosage, chemical concentration, or spray schedules
 * - Promotes IPM, sanitation, scouting, and expert/extension referral
 */

import crypto from 'node:crypto';
import { getDb } from './db.js';
import type { 
  Observation, 
  AssessmentRecord, 
  RiskAssessmentRecord, 
  GuidanceRecord, 
  GuidanceCategory,
  GuidancePriority,
  ActionItem,
  ActionItemStatus
} from '../types/index.js';

export interface GuidanceGenerationResult {
  guidanceRecords: GuidanceRecord[];
  actionPlan: ActionItem[];
}

export class GuidanceService {
  /**
   * Generates evidence-aware guidance and an initial actionable plan
   */
  public static generateGuidance(params: {
    observation: Observation;
    assessment: AssessmentRecord;
    riskAssessment: RiskAssessmentRecord;
    caseId?: string;
  }): GuidanceGenerationResult {
    const { observation, assessment, riskAssessment, caseId } = params;
    const db = getDb();
    const now = new Date().toISOString();

    const isLowConfidence = assessment.confidenceLevel === 'LOW' || assessment.status === 'INSUFFICIENT_EVIDENCE';
    const isCritical = riskAssessment.riskLevel === 'CRITICAL';
    const isHighRisk = riskAssessment.riskLevel === 'HIGH' || isCritical;
    const isModerateRisk = riskAssessment.riskLevel === 'MODERATE';

    const guidanceList: Array<{
      category: GuidanceCategory;
      recommendation: string;
      rationale: string;
      priority: GuidancePriority;
      sourceReference?: string;
      safetyNote: string;
    }> = [];

    const actionList: Array<{
      title: string;
      description: string;
      category: string;
      priority: GuidancePriority;
      dueDays: number;
    }> = [];

    // 1. Evidence-aware rules based on confidence and uncertainty
    if (isLowConfidence) {
      guidanceList.push({
        category: 'IMMEDIATE_OBSERVATION',
        recommendation: 'Evidence is insufficient for a reliable assessment. Capture a clearer close-up image in diffused morning light and monitor the affected foliage.',
        rationale: 'Optical distortion, motion blur, or partial leaf coverage prevents reliable distinction between biotic infection and mechanical abrasion.',
        priority: 'NORMAL',
        sourceReference: 'ICAR-IIHR Foliar Diagnosis Protocol',
        safetyNote: 'Do not apply chemical controls based on ambiguous symptoms. Premature input application incurs unnecessary cost and risks beneficial insect disruption.',
      });

      guidanceList.push({
        category: 'MONITORING',
        recommendation: 'Inspect whether the chlorotic leaf spots or discoloration increase in area or spread to adjacent foliage over the next 48 to 72 hours.',
        rationale: 'Active pathogen progression produces characteristic lesion margins, whereas physical injury remains static.',
        priority: 'NORMAL',
        sourceReference: 'Standard Agronomic Scouting Guidelines',
        safetyNote: 'Examine plants without tearing or shaking affected leaves to avoid potential mechanical spore dissemination.',
      });

      guidanceList.push({
        category: 'FIELD_SCOUTING',
        recommendation: 'Conduct a "W" or "Z" pattern walk across the plot, checking 10 random plants to determine if symptoms are isolated or clustered.',
        rationale: 'Determining the spatial distribution helps distinguish localized focal points from broader environmental stresses.',
        priority: 'LOW',
        safetyNote: 'Clean boots and hands between plot rows.',
      });

      actionList.push({
        title: 'Capture high-clarity follow-up photo',
        description: 'Take a close-up photo of the affected leaf showing both upper and lower surface under good natural light.',
        category: 'OBSERVATION',
        priority: 'NORMAL',
        dueDays: 1,
      });

      actionList.push({
        title: 'Scout 10 randomized plants in plot',
        description: 'Check 10 plants in a zig-zag pattern across the plot to establish if symptoms appear elsewhere.',
        category: 'SCOUTING',
        priority: 'NORMAL',
        dueDays: 2,
      });

      actionList.push({
        title: 'Schedule foliar progress follow-up',
        description: 'Set a reminder to evaluate symptom stability and check for expansion or wilting.',
        category: 'FOLLOW_UP',
        priority: 'NORMAL',
        dueDays: 3,
      });

    } else {
      // 2. High or Medium Confidence Assessment Guidance
      if (isHighRisk) {
        guidanceList.push({
          category: 'FIELD_SCOUTING',
          recommendation: 'Prioritize systematic field scouting across all plot quadrants to determine the exact perimeter and incidence percentage of affected foliage.',
          rationale: `${assessment.primaryIssue} presents significant biological risk in ${observation.growthStage.toLowerCase()} stage with potential for rapid secondary cycling.`,
          priority: isCritical ? 'URGENT' : 'HIGH',
          sourceReference: 'ICAR National Integrated Pest Management Guidelines',
          safetyNote: 'Isolate tools and avoid field operations when leaves are wet to prevent pathogen dispersal via water droplets.',
        });

        guidanceList.push({
          category: 'CULTURAL_PREVENTIVE',
          recommendation: 'Carefully prune and remove heavily infected lower foliage showing advanced lesions; collect in bags and safely dispose outside the field.',
          rationale: 'Physical removal of sporulating inoculum lowers the spore pressure on upper developing fruit and canopy.',
          priority: isCritical ? 'URGENT' : 'HIGH',
          sourceReference: 'State Agricultural University (SAU) Extension Bulletin',
          safetyNote: 'Disinfect pruning tools with 70% alcohol or 1% sodium hypochlorite between rows. Do not leave pruned debris in field furrows.',
        });

        guidanceList.push({
          category: 'EXPERT_EXTENSION_REFERRAL',
          recommendation: 'Consult a qualified local agricultural extension officer (Krishi Vigyan Kendra / KVK) or certified agronomist for on-site confirmation and registered management options.',
          rationale: 'Complex high-risk conditions benefit from local ground-truth confirmation before major input decisions.',
          priority: isCritical ? 'URGENT' : 'HIGH',
          sourceReference: 'Ministry of Agriculture & Farmers Welfare Kisan Advisory',
          safetyNote: 'Consult a qualified local agricultural advisor for an appropriate registered treatment. Never apply arbitrary off-label chemical dosages.',
        });

        actionList.push({
          title: 'Immediate containment scouting',
          description: `Walk plot rows to establish the boundary of ${assessment.primaryIssue} symptoms and mark the perimeter.`,
          category: 'SCOUTING',
          priority: isCritical ? 'URGENT' : 'HIGH',
          dueDays: 1,
        });

        actionList.push({
          title: 'Sanitary pruning of heavily affected lower foliage',
          description: 'Prune infected lower leaves, bag them securely, and destroy outside the field boundaries.',
          category: 'SANITATION',
          priority: isCritical ? 'URGENT' : 'HIGH',
          dueDays: 1,
        });

        actionList.push({
          title: 'Consult local KVK or extension officer',
          description: 'Share observation details with local agricultural extension expert for area-specific IPM recommendations.',
          category: 'EXPERT_REVIEW',
          priority: isCritical ? 'URGENT' : 'HIGH',
          dueDays: 2,
        });

        actionList.push({
          title: 'Record follow-up observation in 48 hours',
          description: 'Capture a follow-up image to verify whether lesion progression has halted following containment steps.',
          category: 'FOLLOW_UP',
          priority: 'HIGH',
          dueDays: 2,
        });

      } else if (isModerateRisk) {
        guidanceList.push({
          category: 'FIELD_SCOUTING',
          recommendation: 'Inspect nearby plants for similar symptoms and record whether the affected area is increasing beyond the initial cluster.',
          rationale: 'Early localized symptoms can often be managed through cultural adjustments before significant economic threshold is reached.',
          priority: 'NORMAL',
          sourceReference: 'State Agricultural University IPM Protocol',
          safetyNote: 'Avoid handling wet plants during early morning dew.',
        });

        guidanceList.push({
          category: 'CULTURAL_PREVENTIVE',
          recommendation: 'Improve airflow by gentle canopy thinning, adjust irrigation to avoid standing water in furrows, and refrain from evening sprinkler irrigation.',
          rationale: 'Reducing free moisture on leaf surfaces slows down spore germination and microbial penetration.',
          priority: 'NORMAL',
          sourceReference: 'ICAR Good Agricultural Practices (GAP)',
          safetyNote: 'Ensure soil drainage channels are unobstructed.',
        });

        guidanceList.push({
          category: 'FOLLOW_UP',
          recommendation: 'Schedule a structured follow-up observation in 3 days to compare foliar lesion stability.',
          rationale: 'Objective visual tracking over 72 hours confirms whether the crop immune response and cultural adjustments are stabilizing the issue.',
          priority: 'NORMAL',
          sourceReference: 'CropFix Decision Support Model',
          safetyNote: 'If symptoms escalate rapidly within 48 hours, request agronomist review.',
        });

        actionList.push({
          title: 'Inspect plants adjacent to initial observation',
          description: 'Examine 5 plants to the left and right of the affected plant to evaluate containment.',
          category: 'SCOUTING',
          priority: 'NORMAL',
          dueDays: 2,
        });

        actionList.push({
          title: 'Adjust irrigation to prevent evening foliage wetness',
          description: 'Schedule irrigation during early morning hours to allow leaf canopy to dry before nightfall.',
          category: 'CULTURAL',
          priority: 'NORMAL',
          dueDays: 2,
        });

        actionList.push({
          title: 'Record follow-up comparison in 3 days',
          description: 'Upload a comparative photo to evaluate symptom stability.',
          category: 'FOLLOW_UP',
          priority: 'NORMAL',
          dueDays: 3,
        });

      } else {
        // Low Risk
        guidanceList.push({
          category: 'MONITORING',
          recommendation: 'Maintain routine weekly plot scouting. Symptoms are currently isolated and below management threshold.',
          rationale: 'Foliar damage is minimal and does not warrant aggressive intervention.',
          priority: 'LOW',
          sourceReference: 'ICAR Integrated Pest Management Manual',
          safetyNote: 'Preserve natural predators and beneficial microorganisms by avoiding unnecessary pesticide sprays.',
        });

        guidanceList.push({
          category: 'CULTURAL_PREVENTIVE',
          recommendation: 'Maintain balanced crop nutrition with appropriate organic mulch and adequate soil moisture management.',
          rationale: 'Vigorous crop physiology enhances natural defense against opportunistic foliar pathogens.',
          priority: 'LOW',
          sourceReference: 'Department of Agriculture Guidelines',
          safetyNote: 'Follow standard fertilizer recommendations based on verified soil test results.',
        });

        actionList.push({
          title: 'Routine weekly plot walk',
          description: 'Continue normal monitoring during weekly field walk.',
          category: 'MONITORING',
          priority: 'LOW',
          dueDays: 7,
        });
      }
    }

    // Always preserve historical guidance records (do not overwrite)
    // Check latest version for this observation
    const versionRow = db.prepare('SELECT MAX(version) as max_version FROM guidance_records WHERE observation_id = ?').get(observation.id) as { max_version: number | null };
    const nextVersion = (versionRow?.max_version || 0) + 1;

    const insertedGuidance: GuidanceRecord[] = [];
    const insertGuidanceStmt = db.prepare(`
      INSERT INTO guidance_records (
        id, observation_id, case_id, risk_assessment_id, category,
        recommendation, rationale, priority, source_reference, safety_note,
        version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const g of guidanceList) {
      const gid = `guid-${crypto.randomBytes(6).toString('hex')}`;
      insertGuidanceStmt.run(
        gid,
        observation.id,
        caseId || null,
        riskAssessment.id,
        g.category,
        g.recommendation,
        g.rationale,
        g.priority,
        g.sourceReference || null,
        g.safetyNote,
        nextVersion,
        now
      );

      insertedGuidance.push({
        id: gid,
        observationId: observation.id,
        caseId: caseId || undefined,
        riskAssessmentId: riskAssessment.id,
        category: g.category,
        recommendation: g.recommendation,
        rationale: g.rationale,
        priority: g.priority,
        sourceReference: g.sourceReference,
        safetyNote: g.safetyNote,
        version: nextVersion,
        createdAt: now,
      });
    }

    // Generate initial action items if no actions currently exist for this observation
    const existingActions = db.prepare('SELECT COUNT(*) as count FROM action_items WHERE observation_id = ?').get(observation.id) as { count: number };
    const insertedActions: ActionItem[] = [];

    if (existingActions.count === 0) {
      const insertActionStmt = db.prepare(`
        INSERT INTO action_items (
          id, user_id, observation_id, case_id, guidance_id, title,
          description, category, priority, due_date, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
      `);

      for (let i = 0; i < actionList.length; i++) {
        const a = actionList[i];
        const aid = `act-${crypto.randomBytes(6).toString('hex')}`;
        const relatedGuidanceId = insertedGuidance[i % insertedGuidance.length]?.id;
        const dueDate = new Date(Date.now() + a.dueDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        insertActionStmt.run(
          aid,
          observation.userId,
          observation.id,
          caseId || null,
          relatedGuidanceId || null,
          a.title,
          a.description,
          a.category,
          a.priority,
          dueDate,
          now
        );

        insertedActions.push({
          id: aid,
          userId: observation.userId,
          observationId: observation.id,
          caseId: caseId || undefined,
          guidanceId: relatedGuidanceId,
          title: a.title,
          description: a.description,
          category: a.category,
          priority: a.priority,
          dueDate,
          status: 'PENDING',
          createdAt: now,
        });
      }
    } else {
      // Fetch existing actions
      const rows = db.prepare('SELECT * FROM action_items WHERE observation_id = ? ORDER BY created_at ASC').all(observation.id) as any[];
      for (const r of rows) {
        insertedActions.push({
          id: r.id,
          userId: r.user_id,
          observationId: r.observation_id,
          caseId: r.case_id || undefined,
          guidanceId: r.guidance_id || undefined,
          title: r.title,
          description: r.description,
          category: r.category,
          priority: r.priority,
          dueDate: r.due_date || undefined,
          status: r.status,
          createdAt: r.created_at,
          completedAt: r.completed_at || undefined,
        });
      }
    }

    return {
      guidanceRecords: insertedGuidance,
      actionPlan: insertedActions,
    };
  }

  /**
   * Retrieves guidance records for an observation
   */
  public static getGuidance(observationId: string): GuidanceRecord[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM guidance_records 
      WHERE observation_id = ? 
      ORDER BY created_at DESC, version DESC
    `).all(observationId) as any[];

    return rows.map(r => ({
      id: r.id,
      observationId: r.observation_id,
      caseId: r.case_id || undefined,
      riskAssessmentId: r.risk_assessment_id || undefined,
      category: r.category,
      recommendation: r.recommendation,
      rationale: r.rationale,
      priority: r.priority,
      sourceReference: r.source_reference || undefined,
      safetyNote: r.safety_note,
      version: r.version,
      createdAt: r.created_at,
    }));
  }

  /**
   * Retrieves action items for an observation
   */
  public static getActions(observationId: string): ActionItem[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM action_items 
      WHERE observation_id = ? 
      ORDER BY created_at ASC
    `).all(observationId) as any[];

    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      observationId: r.observation_id,
      caseId: r.case_id || undefined,
      guidanceId: r.guidance_id || undefined,
      title: r.title,
      description: r.description,
      category: r.category,
      priority: r.priority,
      dueDate: r.due_date || undefined,
      status: r.status,
      createdAt: r.created_at,
      completedAt: r.completed_at || undefined,
    }));
  }

  /**
   * Updates an action item's status
   */
  public static updateActionStatus(actionId: string, status: ActionItemStatus): ActionItem {
    const db = getDb();
    const now = new Date().toISOString();
    const completedAt = (status === 'COMPLETED') ? now : null;

    db.prepare(`
      UPDATE action_items 
      SET status = ?, completed_at = ? 
      WHERE id = ?
    `).run(status, completedAt, actionId);

    const r = db.prepare('SELECT * FROM action_items WHERE id = ?').get(actionId) as any;
    if (!r) throw new Error('Action item not found');

    return {
      id: r.id,
      userId: r.user_id,
      observationId: r.observation_id,
      caseId: r.case_id || undefined,
      guidanceId: r.guidance_id || undefined,
      title: r.title,
      description: r.description,
      category: r.category,
      priority: r.priority,
      dueDate: r.due_date || undefined,
      status: r.status,
      createdAt: r.created_at,
      completedAt: r.completed_at || undefined,
    };
  }
}
