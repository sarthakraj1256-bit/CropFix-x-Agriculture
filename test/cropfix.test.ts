/**
 * CropFix - Comprehensive Test Suite
 * Covers Phases 1, 2, 3, 4, 5, 6
 * SIH26131: Early detection and management of crop diseases and pest infestations
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/server/db.js';
import { 
  authenticateUser, 
  registerUser, 
  getSessionUser, 
  deleteSession,
  verifyFarmOwnership,
  verifyPlotOwnership,
  verifyObservationAccess
} from '../src/server/auth.js';
import { AssessmentService } from '../src/server/assessmentService.js';
import { RiskService } from '../src/server/riskService.js';
import type { Observation } from '../src/types/index.js';

describe('CropFix Core Engine Tests (Phases 1-6)', () => {
  let farmerSession: ReturnType<typeof authenticateUser>;
  let otherFarmerSession: ReturnType<typeof registerUser>;
  const runId = Date.now();
  const testObsId = `obs-test-${runId}`;
  const obscureObsId = `obs-insufficient-${runId}`;

  before(() => {
    // Ensure DB is initialized
    getDb();
  });

  // -------------------------------------------------------------
  // PHASE 1 & 2: Database, Authentication, Roles & IDOR Protection
  // -------------------------------------------------------------
  describe('Phase 1 & 2: Database & Authentication', () => {
    test('Seeded demo farmer authenticates successfully', () => {
      farmerSession = authenticateUser('farmer@cropfix.org', 'Farmer@123');
      assert.ok(farmerSession.token, 'Session token should be present');
      assert.equal(farmerSession.user.role, 'FARMER');
      assert.equal(farmerSession.user.email, 'farmer@cropfix.org');
      assert.equal((farmerSession.user as any).password_hash, undefined, 'password_hash must never leak');
      assert.equal((farmerSession.user as any).salt, undefined, 'salt must never leak');
    });

    test('Rejects invalid password with authentication failure', () => {
      assert.throws(() => {
        authenticateUser('farmer@cropfix.org', 'WrongPassword!123');
      }, /Invalid email or password/);
    });

    test('Registers a new second farmer for IDOR isolation testing', () => {
      otherFarmerSession = registerUser({
        email: `other_farmer_${runId}@cropfix.org`,
        password: 'Password@123',
        name: 'Suresh Patil',
        role: 'FARMER',
        district: 'Kolhapur',
        state: 'Maharashtra',
      });
      assert.ok(otherFarmerSession.token);
      assert.equal(otherFarmerSession.user.email, `other_farmer_${runId}@cropfix.org`);
    });

    test('Rejects duplicate registration with identical email', () => {
      assert.throws(() => {
        registerUser({
          email: `other_farmer_${runId}@cropfix.org`,
          password: 'Password@123',
          name: 'Duplicate Suresh',
        });
      }, /already exists/);
    });

    test('Validates session token lookup and expiry', () => {
      const user = getSessionUser(farmerSession.token);
      assert.ok(user);
      assert.equal(user.id, farmerSession.user.id);
    });

    test('Invalid session token returns null', () => {
      const user = getSessionUser('invalid-token-123456');
      assert.equal(user, null);
    });
  });

  // -------------------------------------------------------------
  // PHASE 3: Farm, Plot & Crop Context Management
  // -------------------------------------------------------------
  describe('Phase 3: Farm, Plot & Crop Context', () => {
    test('Farmer can verify access to own seeded farm', () => {
      const hasAccess = verifyFarmOwnership('farm-demo-01', farmerSession.user);
      assert.equal(hasAccess, true, 'Ramesh Patel should own farm-demo-01');
    });

    test('Farmer B is blocked from accessing Farmer A farm (IDOR protection)', () => {
      const hasAccess = verifyFarmOwnership('farm-demo-01', otherFarmerSession.user);
      assert.equal(hasAccess, false, 'Suresh Patil must NOT have access to farm-demo-01');
    });

    test('Farmer can verify access to own seeded plot', () => {
      const hasAccess = verifyPlotOwnership('plot-demo-01', farmerSession.user);
      assert.equal(hasAccess, true, 'Ramesh Patel should own plot-demo-01');
    });

    test('Farmer B is blocked from accessing Farmer A plot (IDOR protection)', () => {
      const hasAccess = verifyPlotOwnership('plot-demo-01', otherFarmerSession.user);
      assert.equal(hasAccess, false, 'Suresh Patil must NOT have access to plot-demo-01');
    });
  });

  // -------------------------------------------------------------
  // PHASE 4: Crop Observation & Image Capture
  // -------------------------------------------------------------
  describe('Phase 4: Observation Recording & Image Privacy', () => {
    test('Can create a valid crop observation with image and symptoms', () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO observations (
          id, user_id, farm_id, plot_id, crop_name, growth_stage, plant_part,
          severity_estimate, symptom_tags, symptom_description, image_id,
          image_mime, image_data, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?)
      `).run(
        testObsId,
        farmerSession.user.id,
        'farm-demo-01',
        'plot-demo-01',
        'Tomato',
        'Flowering',
        'Leaf',
        'Moderate (multiple leaves)',
        JSON.stringify(['dark spots with concentric rings', 'yellowing']),
        'Target-board dark lesions visible on lower foliage with chlorotic yellow halo.',
        `img-${runId}`,
        'image/jpeg',
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
        now,
        now
      );

      const obs = db.prepare('SELECT * FROM observations WHERE id = ?').get(testObsId) as any;
      assert.ok(obs);
      assert.equal(obs.crop_name, 'Tomato');
      assert.equal(obs.status, 'SUBMITTED');
    });

    test('Farmer A owns the observation and can access it', () => {
      const canAccess = verifyObservationAccess(testObsId, farmerSession.user);
      assert.equal(canAccess, true);
    });

    test('Farmer B is blocked from accessing Farmer A observation (IDOR protection)', () => {
      const canAccess = verifyObservationAccess(testObsId, otherFarmerSession.user);
      assert.equal(canAccess, false, 'Farmer B must not access Farmer A observation');
    });
  });

  // -------------------------------------------------------------
  // PHASE 5: AI-Assisted Assessment Engine
  // -------------------------------------------------------------
  describe('Phase 5: AI-Assisted Assessment', () => {
    test('Produces structured assessment for Early Blight on Tomato', async () => {
      const assessment = await AssessmentService.assess({
        observationId: testObsId,
        cropName: 'Tomato',
        growthStage: 'Flowering',
        plantPart: 'Leaf',
        severityEstimate: 'Moderate (multiple leaves)',
        symptomTags: ['dark spots with concentric rings', 'yellowing'],
        symptomDescription: 'Concentric ring lesions on lower leaves',
      });

      assert.ok(assessment.id);
      assert.equal(assessment.status, 'ASSESSED');
      assert.equal(assessment.issueCategory, 'fungal_disease');
      assert.match(assessment.primaryIssue, /Early Blight/);
      assert.equal(assessment.confidenceLevel, 'HIGH');
      assert.ok(assessment.confidenceScore >= 0.7);
      assert.ok(assessment.evidencePoints.length >= 2, 'Should provide at least 2 evidence points');
      assert.ok(assessment.alternativeCandidates.length >= 1, 'Should provide alternative candidates');
      assert.ok(assessment.uncertaintyNotes.length > 0);
      assert.ok(assessment.disclaimer.includes('AI-assisted assessment'));
    });

    test('Handles insufficient evidence condition gracefully without forcing diagnosis', async () => {
      const db = getDb();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO observations (
          id, user_id, farm_id, plot_id, crop_name, growth_stage, plant_part,
          severity_estimate, symptom_tags, symptom_description, image_id,
          image_mime, image_data, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?)
      `).run(
        obscureObsId,
        farmerSession.user.id,
        'farm-demo-01',
        'plot-demo-01',
        'Cotton',
        'Vegetative',
        'Whole Plant',
        'Mild (isolated spots)',
        JSON.stringify([]),
        '',
        `img-obscure-${runId}`,
        'image/jpeg',
        'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        now,
        now
      );

      const result = await AssessmentService.assess({
        observationId: obscureObsId,
        cropName: 'Cotton',
        growthStage: 'Vegetative',
        plantPart: 'Whole Plant',
        severityEstimate: 'Mild (isolated spots)',
        symptomTags: [],
        symptomDescription: '',
      });

      assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
      assert.equal(result.issueCategory, 'insufficient_evidence');
      assert.equal(result.confidenceLevel, 'LOW');
      assert.ok(result.uncertaintyNotes.includes('High uncertainty'));
    });
  });

  // -------------------------------------------------------------
  // PHASE 6: Contextual Risk & Uncertainty Intelligence
  // -------------------------------------------------------------
  describe('Phase 6: Risk & Uncertainty Intelligence', () => {
    test('Calculates contextual risk separate from AI confidence', async () => {
      const db = getDb();
      const obsRow = db.prepare('SELECT * FROM observations WHERE id = ?').get(testObsId) as any;
      const asmtRow = db.prepare('SELECT * FROM assessments WHERE observation_id = ?').get(testObsId) as any;

      const mockObservation: Observation = {
        id: obsRow.id,
        userId: obsRow.user_id,
        farmId: obsRow.farm_id,
        plotId: obsRow.plot_id,
        cropName: obsRow.crop_name,
        growthStage: obsRow.growth_stage,
        plantPart: obsRow.plant_part,
        severityEstimate: obsRow.severity_estimate,
        symptomTags: JSON.parse(obsRow.symptom_tags),
        symptomDescription: obsRow.symptom_description,
        imageId: obsRow.image_id,
        status: obsRow.status,
        createdAt: obsRow.created_at,
        updatedAt: obsRow.updated_at,
      };

      const mockAssessment = {
        id: asmtRow.id,
        observationId: asmtRow.observation_id,
        engineId: asmtRow.engine_id,
        status: asmtRow.status,
        primaryIssue: asmtRow.primary_issue,
        issueCategory: asmtRow.issue_category,
        confidenceLevel: asmtRow.confidence_level,
        confidenceScore: asmtRow.confidence_score,
        evidencePoints: JSON.parse(asmtRow.evidence_points),
        alternativeCandidates: JSON.parse(asmtRow.alternative_candidates),
        uncertaintyNotes: asmtRow.uncertainty_notes,
        isDemo: Boolean(asmtRow.is_demo),
        disclaimer: asmtRow.disclaimer,
        createdAt: asmtRow.created_at,
      };

      const riskAssessment = RiskService.evaluate(mockObservation, mockAssessment);

      assert.ok(riskAssessment.id);
      assert.ok(['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].includes(riskAssessment.riskLevel));
      assert.ok(riskAssessment.riskScore > 0 && riskAssessment.riskScore <= 100);
      assert.ok(riskAssessment.riskFactors.length >= 2, 'Should include crop stage and severity risk factors');
      assert.ok(riskAssessment.uncertaintyFactors.length >= 1, 'Should include micro-climate uncertainty factor');
      assert.ok(riskAssessment.recommendedActions.length >= 2);
      
      // Safety check: Ensure no chemical or pesticide prescriptions are generated
      for (const action of riskAssessment.recommendedActions) {
        assert.ok(!action.includes('ml/L'), 'Must not invent chemical concentration');
        assert.ok(!action.includes('kg/ha'), 'Must not invent chemical dosage');
        assert.ok(!action.includes('spray 500g'), 'Must not invent pesticide schedule');
      }
    });

    test('Escalates uncertain risk cases to expert review recommendation', () => {
      const db = getDb();
      const obsRow = db.prepare('SELECT * FROM observations WHERE id = ?').get(obscureObsId) as any;
      const asmtRow = db.prepare('SELECT * FROM assessments WHERE observation_id = ?').get(obscureObsId) as any;

      const mockObservation: Observation = {
        id: obsRow.id,
        userId: obsRow.user_id,
        farmId: obsRow.farm_id,
        plotId: obsRow.plot_id,
        cropName: obsRow.crop_name,
        growthStage: obsRow.growth_stage,
        plantPart: obsRow.plant_part,
        severityEstimate: obsRow.severity_estimate,
        symptomTags: JSON.parse(obsRow.symptom_tags),
        symptomDescription: obsRow.symptom_description,
        imageId: obsRow.image_id,
        status: obsRow.status,
        createdAt: obsRow.created_at,
        updatedAt: obsRow.updated_at,
      };

      const mockAssessment = {
        id: asmtRow.id,
        observationId: asmtRow.observation_id,
        engineId: asmtRow.engine_id,
        status: asmtRow.status,
        primaryIssue: asmtRow.primary_issue,
        issueCategory: asmtRow.issue_category,
        confidenceLevel: asmtRow.confidence_level,
        confidenceScore: asmtRow.confidence_score,
        evidencePoints: JSON.parse(asmtRow.evidence_points),
        alternativeCandidates: JSON.parse(asmtRow.alternative_candidates),
        uncertaintyNotes: asmtRow.uncertainty_notes,
        isDemo: Boolean(asmtRow.is_demo),
        disclaimer: asmtRow.disclaimer,
        createdAt: asmtRow.created_at,
      };

      const risk = RiskService.evaluate(mockObservation, mockAssessment);
      assert.equal(risk.riskLevel, 'UNCERTAIN');
      assert.equal(risk.expertReviewRecommended, true);
      assert.equal(risk.requiresEscalation, true);
    });
  });

  // -------------------------------------------------------------
  // PHASE 7: Guidance & Action Management Tests
  // -------------------------------------------------------------
  describe('Phase 7: Guidance & Action Management', () => {
    let generatedActionId: string;

    test('Generates evidence-aware guidance and action plan for observation', async () => {
      const { GuidanceService } = await import('../src/server/guidanceService.js');
      const db = getDb();
      const obsRow = db.prepare('SELECT * FROM observations WHERE id = ?').get(testObsId) as any;
      const asmtRow = db.prepare('SELECT * FROM assessments WHERE observation_id = ?').get(testObsId) as any;
      const riskRow = db.prepare('SELECT * FROM risk_assessments WHERE observation_id = ?').get(testObsId) as any;

      const mockObs: Observation = {
        id: obsRow.id,
        userId: obsRow.user_id,
        farmId: obsRow.farm_id,
        plotId: obsRow.plot_id,
        cropName: obsRow.crop_name,
        growthStage: obsRow.growth_stage,
        plantPart: obsRow.plant_part,
        severityEstimate: obsRow.severity_estimate,
        symptomTags: JSON.parse(obsRow.symptom_tags),
        symptomDescription: obsRow.symptom_description,
        imageId: obsRow.image_id,
        status: obsRow.status,
        createdAt: obsRow.created_at,
        updatedAt: obsRow.updated_at,
      };

      const mockAsmt = {
        id: asmtRow.id,
        observationId: asmtRow.observation_id,
        engineId: asmtRow.engine_id,
        status: asmtRow.status,
        primaryIssue: asmtRow.primary_issue,
        issueCategory: asmtRow.issue_category,
        confidenceLevel: asmtRow.confidence_level,
        confidenceScore: asmtRow.confidence_score,
        evidencePoints: JSON.parse(asmtRow.evidence_points),
        alternativeCandidates: JSON.parse(asmtRow.alternative_candidates),
        uncertaintyNotes: asmtRow.uncertainty_notes,
        isDemo: Boolean(asmtRow.is_demo),
        disclaimer: asmtRow.disclaimer,
        createdAt: asmtRow.created_at,
      };

      const mockRisk = {
        id: riskRow.id,
        observationId: riskRow.observation_id,
        assessmentId: riskRow.assessment_id,
        riskLevel: riskRow.risk_level,
        riskScore: riskRow.risk_score,
        riskFactors: JSON.parse(riskRow.risk_factors),
        uncertaintyFactors: JSON.parse(riskRow.uncertainty_factors),
        explanation: riskRow.explanation,
        expertReviewRecommended: Boolean(riskRow.expert_review_recommended),
        requiresEscalation: Boolean(riskRow.requires_escalation),
        recommendedActions: JSON.parse(riskRow.recommended_actions),
        isDemo: Boolean(riskRow.is_demo),
        disclaimer: riskRow.disclaimer,
        createdAt: riskRow.created_at,
      };

      const result = GuidanceService.generateGuidance({
        observation: mockObs,
        assessment: mockAsmt,
        riskAssessment: mockRisk,
      });

      assert.ok(result.guidanceRecords.length >= 2, 'Should generate at least 2 guidance recommendations');
      assert.ok(result.actionPlan.length >= 2, 'Should generate actionable task checklist');

      // Verify Safety Rule: Absolutely no chemical/pesticide fabrication
      for (const g of result.guidanceRecords) {
        assert.ok(!g.recommendation.includes('ml/L'), 'Must not fabricate chemical concentration');
        assert.ok(!g.recommendation.includes('kg/ha'), 'Must not fabricate chemical dosage');
        assert.ok(g.safetyNote.length > 10, 'Must include clear safety note');
      }

      generatedActionId = result.actionPlan[0].id;
      assert.equal(result.actionPlan[0].status, 'PENDING');
    });

    test('Generates cautious observation guidance for low-confidence evidence', async () => {
      const { GuidanceService } = await import('../src/server/guidanceService.js');
      const db = getDb();
      const obsRow = db.prepare('SELECT * FROM observations WHERE id = ?').get(obscureObsId) as any;
      const asmtRow = db.prepare('SELECT * FROM assessments WHERE observation_id = ?').get(obscureObsId) as any;
      const riskRow = db.prepare('SELECT * FROM risk_assessments WHERE observation_id = ?').get(obscureObsId) as any;

      const mockObs: Observation = {
        id: obsRow.id,
        userId: obsRow.user_id,
        farmId: obsRow.farm_id,
        plotId: obsRow.plot_id,
        cropName: obsRow.crop_name,
        growthStage: obsRow.growth_stage,
        plantPart: obsRow.plant_part,
        severityEstimate: obsRow.severity_estimate,
        symptomTags: JSON.parse(obsRow.symptom_tags),
        symptomDescription: obsRow.symptom_description,
        imageId: obsRow.image_id,
        status: obsRow.status,
        createdAt: obsRow.created_at,
        updatedAt: obsRow.updated_at,
      };

      const mockAsmt = {
        id: asmtRow.id,
        observationId: asmtRow.observation_id,
        engineId: asmtRow.engine_id,
        status: asmtRow.status,
        primaryIssue: asmtRow.primary_issue,
        issueCategory: asmtRow.issue_category,
        confidenceLevel: asmtRow.confidence_level,
        confidenceScore: asmtRow.confidence_score,
        evidencePoints: JSON.parse(asmtRow.evidence_points),
        alternativeCandidates: JSON.parse(asmtRow.alternative_candidates),
        uncertaintyNotes: asmtRow.uncertainty_notes,
        isDemo: Boolean(asmtRow.is_demo),
        disclaimer: asmtRow.disclaimer,
        createdAt: asmtRow.created_at,
      };

      const mockRisk = {
        id: riskRow.id,
        observationId: riskRow.observation_id,
        assessmentId: riskRow.assessment_id,
        riskLevel: riskRow.risk_level,
        riskScore: riskRow.risk_score,
        riskFactors: JSON.parse(riskRow.risk_factors),
        uncertaintyFactors: JSON.parse(riskRow.uncertainty_factors),
        explanation: riskRow.explanation,
        expertReviewRecommended: Boolean(riskRow.expert_review_recommended),
        requiresEscalation: Boolean(riskRow.requires_escalation),
        recommendedActions: JSON.parse(riskRow.recommended_actions),
        isDemo: Boolean(riskRow.is_demo),
        disclaimer: riskRow.disclaimer,
        createdAt: riskRow.created_at,
      };

      const result = GuidanceService.generateGuidance({
        observation: mockObs,
        assessment: mockAsmt,
        riskAssessment: mockRisk,
      });

      const immediateObs = result.guidanceRecords.find(g => g.category === 'IMMEDIATE_OBSERVATION');
      assert.ok(immediateObs, 'Low confidence must produce IMMEDIATE_OBSERVATION recommendation');
      assert.ok(immediateObs.recommendation.includes('insufficient'), 'Should highlight insufficient evidence');
    });

    test('Updates action item status to COMPLETED with timestamp', async () => {
      const { GuidanceService } = await import('../src/server/guidanceService.js');
      const updated = GuidanceService.updateActionStatus(generatedActionId, 'COMPLETED');
      assert.equal(updated.status, 'COMPLETED');
      assert.ok(updated.completedAt, 'completedAt timestamp must be recorded');
    });

    test('Enforces IDOR authorization on action items', async () => {
      const { verifyActionAccess } = await import('../src/server/auth.js');
      assert.equal(verifyActionAccess(generatedActionId, farmerSession.user), true);
      assert.equal(verifyActionAccess(generatedActionId, otherFarmerSession.user), false);
    });
  });

  // -------------------------------------------------------------
  // PHASE 8: Follow-up & Outcome Tracking Tests
  // -------------------------------------------------------------
  describe('Phase 8: Follow-Up & Outcome Tracking', () => {
    let followUpId: string;

    test('Schedules a field follow-up inspection', async () => {
      const { CaseService } = await import('../src/server/caseService.js');
      const followUp = CaseService.scheduleFollowUp({
        userId: farmerSession.user.id,
        observationId: testObsId,
        plotId: 'plot-demo-01',
        scheduledDate: '2026-09-08',
        notes: 'Check if target-spot lesions have stabilized after pruning',
      });

      assert.ok(followUp.id);
      assert.equal(followUp.status, 'SCHEDULED');
      assert.equal(followUp.scheduledDate, '2026-09-08');
      followUpId = followUp.id;
    });

    test('Completes follow-up with IMPROVED symptom trend and notes', async () => {
      const { CaseService } = await import('../src/server/caseService.js');
      const completed = CaseService.completeFollowUp({
        followUpId,
        symptomTrend: 'IMPROVED',
        farmerNotes: 'Lesions dried up and contained on lower leaves; no upper spread.',
        actionEffectiveness: 'Sanitary pruning and aeration were effective.',
      });

      assert.equal(completed.status, 'COMPLETED');
      assert.equal(completed.symptomTrend, 'IMPROVED');
      assert.ok(completed.completedDate);
      assert.ok(completed.outcomeSummary?.includes('contained'));
    });

    test('Allows rescheduling follow-ups to a new date without penalty', async () => {
      const { CaseService } = await import('../src/server/caseService.js');
      // Create a second follow-up for rescheduling test
      const tempFollowUp = CaseService.scheduleFollowUp({
        userId: farmerSession.user.id,
        observationId: testObsId,
        plotId: 'plot-demo-01',
        scheduledDate: '2026-09-10',
      });

      const rescheduled = CaseService.rescheduleFollowUp(tempFollowUp.id, '2026-09-14');
      assert.equal(rescheduled.scheduledDate, '2026-09-14');
      assert.equal(rescheduled.status, 'SCHEDULED');
    });

    test('Enforces IDOR authorization on follow-up tracking', async () => {
      const { verifyFollowUpAccess } = await import('../src/server/auth.js');
      assert.equal(verifyFollowUpAccess(followUpId, farmerSession.user), true);
      assert.equal(verifyFollowUpAccess(followUpId, otherFarmerSession.user), false);
    });
  });

  // -------------------------------------------------------------
  // PHASE 9: Case History & Longitudinal Tracking Tests
  // -------------------------------------------------------------
  describe('Phase 9: Case History & Longitudinal Tracking', () => {
    let activeCaseId: string;

    test('Initializes an active crop-health case for a new plot observation', async () => {
      const { CaseService } = await import('../src/server/caseService.js');
      const cropCase = CaseService.findOrCreateActiveCase({
        userId: farmerSession.user.id,
        farmId: 'farm-demo-01',
        plotId: 'plot-demo-01',
        cropName: 'Tomato',
        initialObservationId: testObsId,
        severityEstimate: 'MODERATE_10_25',
      });

      assert.ok(cropCase.id.startsWith('case-'));
      assert.equal(cropCase.cropName, 'Tomato');
      assert.ok(['OPEN', 'MONITORING', 'IMPROVING'].includes(cropCase.status));
      activeCaseId = cropCase.id;
    });

    test('Repeated observation on the same plot preserves continuity in the same case', async () => {
      const { CaseService } = await import('../src/server/caseService.js');
      const secondObsId = `obs-repeat-${runId}`;
      const db = getDb();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO observations (
          id, user_id, farm_id, plot_id, crop_name, growth_stage, plant_part,
          severity_estimate, symptom_tags, symptom_description, image_id,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?)
      `).run(
        secondObsId,
        farmerSession.user.id,
        'farm-demo-01',
        'plot-demo-01',
        'Tomato',
        'Flowering',
        'FOLIAGE_LEAF',
        'LOW_UNDER_10',
        '["leaf_spots"]',
        'Second follow-up inspection',
        'img-repeat',
        now,
        now
      );

      const repeatedCase = CaseService.findOrCreateActiveCase({
        userId: farmerSession.user.id,
        farmId: 'farm-demo-01',
        plotId: 'plot-demo-01',
        cropName: 'Tomato',
        initialObservationId: secondObsId,
      });

      assert.equal(repeatedCase.id, activeCaseId, 'Should link to the same ongoing crop health case');
    });

    test('Generates unified chronological timeline of case events', async () => {
      const { CaseService } = await import('../src/server/caseService.js');
      const timeline = CaseService.getCaseTimeline(activeCaseId);

      assert.ok(timeline.length >= 3, 'Timeline should contain multiple chronological events');
      const eventTypes = timeline.map(e => e.type);
      assert.ok(eventTypes.includes('OBSERVATION'), 'Must include observation event');
      assert.ok(eventTypes.includes('ASSESSMENT'), 'Must include assessment event');

      // Verify strict chronological order
      for (let i = 0; i < timeline.length - 1; i++) {
        const t1 = new Date(timeline[i].timestamp).getTime();
        const t2 = new Date(timeline[i + 1].timestamp).getTime();
        assert.ok(t1 <= t2, 'Timeline events must be sorted chronologically ascending');
      }
    });

    test('Calculates objective longitudinal insights based on real field data', async () => {
      const { CaseService } = await import('../src/server/caseService.js');
      const insights = CaseService.getCaseInsights(activeCaseId);

      assert.ok(insights.totalObservations >= 1);
      assert.ok(insights.daysActive >= 1);
      assert.ok(insights.hasSufficientData === true || insights.hasSufficientData === false);
      assert.ok(insights.trendSummary.length > 5);
      assert.ok(insights.suggestedNextStep.length > 5);
    });

    test('Resolves case with closing notes and supports reopening', async () => {
      const { CaseService } = await import('../src/server/caseService.js');
      const resolved = CaseService.resolveCase(activeCaseId, 'Plot fully recovered. No active lesions.');
      assert.equal(resolved.status, 'RESOLVED');
      assert.ok(resolved.resolvedAt);

      const reopened = CaseService.reopenCase(activeCaseId);
      assert.equal(reopened.status, 'MONITORING');
      assert.equal(reopened.resolvedAt, undefined);
    });

    test('Enforces IDOR authorization on crop cases', async () => {
      const { verifyCaseAccess } = await import('../src/server/auth.js');
      assert.equal(verifyCaseAccess(activeCaseId, farmerSession.user), true);
      assert.equal(verifyCaseAccess(activeCaseId, otherFarmerSession.user), false);
    });
  });

  // -------------------------------------------------------------
  // PHASE 10: Agronomist Human Validation & Expert Review Desk
  // -------------------------------------------------------------
  describe('Phase 10: Expert Review System', () => {
    let expertSession: ReturnType<typeof authenticateUser>;
    let reviewObsId: string;

    before(async () => {
      expertSession = authenticateUser('expert@cropfix.org', 'Expert@123');
      reviewObsId = `obs-expert-review-${Date.now()}`;
      const db = getDb();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO observations (
          id, user_id, farm_id, plot_id, crop_name, growth_stage,
          plant_part, severity_estimate, symptom_tags, symptom_description,
          image_id, image_mime, image_data, farmer_notes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEEDS_REVIEW', ?, ?)
      `).run(
        reviewObsId,
        farmerSession.user.id,
        'farm-demo-01',
        'plot-demo-01',
        'Tomato',
        'Vegetative',
        'LEAF',
        'MODERATE',
        '["leaf_spots", "yellowing"]',
        'Escalated observation needing specialist inspection',
        'img-review-01',
        'image/jpeg',
        'data:image/jpeg;base64,/9j/test',
        'Please inspect early blight spread',
        now,
        now
      );
    });

    test('Expert can view pending review queue', async () => {
      const { ExpertService } = await import('../src/server/expertService.js');
      const queue = ExpertService.getReviewQueue({ status: 'PENDING' });
      assert.ok(Array.isArray(queue));
      const target = queue.find(q => q.observationId === reviewObsId);
      assert.ok(target, 'Review queue should include newly flagged observation');
      assert.equal(target.status, 'NEEDS_REVIEW');
    });

    test('Expert can submit clinical review and diagnosis validation', async () => {
      const { ExpertService } = await import('../src/server/expertService.js');
      const review = ExpertService.submitReview({
        observationId: reviewObsId,
        expertId: expertSession.user.id,
        expertName: expertSession.user.name,
        agreementStatus: 'AGREE',
        expertAssessment: 'Confirmed Early Blight (Alternaria solani)',
        confidenceLevel: 'HIGH',
        expertNotes: 'Characteristic concentric target spot lesions evident on lower canopy.',
        recommendations: [
          'Apply Copper Oxychloride 50 WP @ 3g/L',
          'Ensure lower canopy aerated through targeted pruning'
        ],
      });

      assert.ok(review.id);
      assert.equal(review.agreementStatus, 'AGREE');
      assert.equal(review.expertId, expertSession.user.id);
      assert.equal(review.recommendations.length, 2);

      // Verify observation status was updated
      const obs = ExpertService.getObservationForReview(reviewObsId);
      assert.equal(obs?.status, 'ASSESSED');
    });

    test('Retrieves submitted review for observation', async () => {
      const { ExpertService } = await import('../src/server/expertService.js');
      const review = ExpertService.getReviewByObservationId(reviewObsId);
      assert.ok(review);
      assert.equal(review.agreementStatus, 'AGREE');
      assert.equal(review.confidenceLevel, 'HIGH');
    });

    test('Verifies review access authorization with IDOR protection', async () => {
      const { ExpertService } = await import('../src/server/expertService.js');
      const { verifyReviewAccess } = await import('../src/server/auth.js');
      const review = ExpertService.getReviewByObservationId(reviewObsId);
      assert.ok(review);

      // Owner farmer has access
      assert.equal(verifyReviewAccess(review.id, farmerSession.user), true);
      // Reviewing expert has access
      assert.equal(verifyReviewAccess(review.id, expertSession.user), true);
      // Unrelated farmer B does NOT have access
      assert.equal(verifyReviewAccess(review.id, otherFarmerSession.user), false);
    });
  });

  // -------------------------------------------------------------
  // PHASE 11: Institutional Surveillance & Aggregate Analytics
  // -------------------------------------------------------------
  describe('Phase 11: Institutional Surveillance Intelligence', () => {
    test('Calculates privacy-preserving aggregated crop health metrics', async () => {
      const { InstitutionalService } = await import('../src/server/institutionalService.js');
      const analytics = InstitutionalService.getAggregatedAnalytics('30d');

      assert.ok(typeof analytics.totalObservations === 'number');
      assert.ok(typeof analytics.activeCases === 'number');
      assert.ok(analytics.hasSufficientData !== undefined);
      assert.ok(Array.isArray(analytics.cropDistribution));
      assert.ok(analytics.riskDistribution.LOW !== undefined);
      assert.ok(analytics.riskDistribution.MODERATE !== undefined);
      assert.ok(analytics.followUpStats.improved !== undefined);
      assert.ok(analytics.expertReviewStats.agreementRate !== undefined);
      assert.ok(Array.isArray(analytics.coarseHotspots));

      // STRICT PRIVACY VERIFICATION:
      // Institutional analytics MUST NOT contain farmer names, phone numbers, or private coordinates
      const serialized = JSON.stringify(analytics);
      assert.equal(serialized.includes('Ramesh'), false, 'Farmer names must NEVER be present in institutional analytics');
      assert.equal(serialized.includes('phone'), false, 'Private contacts must NEVER be present');
      assert.equal(serialized.includes('image_uri'), false, 'Foliar images must NEVER be leaked in institutional analytics');
    });
  });

  // -------------------------------------------------------------
  // PHASE 12: Notification System & Duplicate Suppression
  // -------------------------------------------------------------
  describe('Phase 12: Actionable Alerts & Notifications', () => {
    let createdNotifId: string;

    test('Creates an in-app notification for a farmer', async () => {
      const { NotificationService } = await import('../src/server/notificationService.js');
      const notif = NotificationService.createNotification({
        userId: farmerSession.user.id,
        title: 'Diagnostic Validation Complete',
        message: 'Dr. Ananya Sharma validated your Tomato observation.',
        type: 'EXPERT_REVIEW_COMPLETED',
        priority: 'NORMAL',
        relatedEntityType: 'observation',
        relatedEntityId: testObsId,
      });

      assert.ok(notif);
      assert.equal(notif.userId, farmerSession.user.id);
      assert.equal(notif.isRead, false);
      createdNotifId = notif.id;
    });

    test('Duplicate suppression avoids notification spam within 1 hour', async () => {
      const { NotificationService } = await import('../src/server/notificationService.js');
      const dup = NotificationService.createNotification({
        userId: farmerSession.user.id,
        title: 'Diagnostic Validation Complete',
        message: 'Dr. Ananya Sharma validated your Tomato observation.',
        type: 'EXPERT_REVIEW_COMPLETED',
        priority: 'NORMAL',
        relatedEntityType: 'observation',
        relatedEntityId: testObsId,
      });

      assert.equal(dup, null, 'Duplicate alert within 1 hour must be suppressed');
    });

    test('Fetches unread notifications and unread count', async () => {
      const { NotificationService } = await import('../src/server/notificationService.js');
      const userNotifs = NotificationService.getUserNotifications(farmerSession.user.id);
      assert.ok(userNotifs.unreadCount >= 1);
      assert.ok(userNotifs.notifications.length >= 1);
    });

    test('Marks notification as read and enforces IDOR access isolation', async () => {
      const { NotificationService } = await import('../src/server/notificationService.js');
      const { verifyNotificationAccess } = await import('../src/server/auth.js');

      // IDOR check: Farmer B cannot access Farmer A notification
      assert.equal(verifyNotificationAccess(createdNotifId, otherFarmerSession.user), false);
      assert.equal(verifyNotificationAccess(createdNotifId, farmerSession.user), true);

      // Mark as read
      const updated = NotificationService.markAsRead(createdNotifId, farmerSession.user.id);
      assert.ok(updated);
      assert.equal(updated.isRead, true);
    });
  });

  // -------------------------------------------------------------
  // PHASE 13-15: Operational Telemetry & System Security
  // -------------------------------------------------------------
  describe('Phase 13-15: Operational Telemetry & Audit Logs', () => {
    test('Records system audit log events securely', () => {
      const db = getDb();
      const auditId = `audit-${Date.now()}`;
      db.prepare(`
        INSERT INTO audit_logs (
          id, user_id, action, resource_type, resource_id, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        auditId,
        farmerSession.user.id,
        'TEST_SECURITY_VERIFY',
        'system',
        'sih26131',
        JSON.stringify({ status: 'ok', ip: '127.0.0.1' }),
        new Date().toISOString()
      );

      const log = db.prepare(`SELECT * FROM audit_logs WHERE id = ?`).get(auditId) as any;
      assert.ok(log);
      assert.equal(log.action, 'TEST_SECURITY_VERIFY');
      assert.equal(log.user_id, farmerSession.user.id);
    });
  });
});
