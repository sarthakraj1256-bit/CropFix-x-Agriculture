/**
 * CropFix - Institutional Intelligence & Aggregated Surveillance Service
 * SIH26131: Early detection and management of crop diseases and pest infestations
 * Phase 11 Implementation
 * 
 * CRITICAL PRIVACY DIRECTIVE:
 * Strict aggregate-only computation. Never expose individual farmer identities,
 * telephone numbers, precise GPS coordinates, private farmer notes, or foliar images.
 */

import { getDb } from './db.js';
import type { InstitutionalAnalytics, TimeframeFilter, RiskLevel } from '../types/index.js';

export class InstitutionalService {
  /**
   * Computes high-level aggregated crop-health metrics with server-side temporal filtering.
   */
  static getAggregatedAnalytics(timeframe: TimeframeFilter = '30d'): InstitutionalAnalytics {
    const db = getDb();
    const now = new Date();

    let startDate: string | null = null;
    if (timeframe === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (timeframe === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (timeframe === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    } // 'all' leaves startDate as null

    const timeClause = startDate ? 'WHERE created_at >= ?' : '';
    const timeParams = startDate ? [startDate] : [];

    // 1. Total Observations
    const totalObsRow = db.prepare(`
      SELECT COUNT(*) as count FROM observations ${timeClause}
    `).get(...timeParams) as { count: number };
    const totalObservations = totalObsRow?.count || 0;

    // 2. Active Cases Count
    const activeCasesRow = db.prepare(`
      SELECT COUNT(*) as count FROM cases 
      WHERE status IN ('OPEN', 'MONITORING', 'WORSENING', 'NEEDS_REVIEW')
      ${startDate ? 'AND created_at >= ?' : ''}
    `).get(...(startDate ? [startDate] : [])) as { count: number };
    const activeCases = activeCasesRow?.count || 0;

    // 3. Contextual Crop-Health Risk Distribution
    const riskDistribution: Record<RiskLevel, number> = {
      LOW: 0,
      MODERATE: 0,
      HIGH: 0,
      CRITICAL: 0,
      UNCERTAIN: 0,
    };

    const riskRows = db.prepare(`
      SELECT r.risk_level, COUNT(*) as count
      FROM risk_assessments r
      JOIN observations o ON r.observation_id = o.id
      ${startDate ? 'WHERE o.created_at >= ?' : ''}
      GROUP BY r.risk_level
    `).all(...(startDate ? [startDate] : [])) as { risk_level: string; count: number }[];

    for (const r of riskRows) {
      if (r.risk_level in riskDistribution) {
        riskDistribution[r.risk_level as RiskLevel] = Number(r.count);
      }
    }

    // 4. Crop Distribution
    const cropObsRows = db.prepare(`
      SELECT crop_name, COUNT(*) as count
      FROM observations
      ${timeClause}
      GROUP BY crop_name
      ORDER BY count DESC
    `).all(...timeParams) as { crop_name: string; count: number }[];

    const cropCaseRows = db.prepare(`
      SELECT crop_name, COUNT(*) as count
      FROM cases
      ${timeClause}
      GROUP BY crop_name
    `).all(...timeParams) as { crop_name: string; count: number }[];

    const caseCountMap = new Map<string, number>();
    for (const c of cropCaseRows) {
      caseCountMap.set(c.crop_name, Number(c.count));
    }

    const cropDistribution = cropObsRows.map((c) => ({
      crop: c.crop_name,
      observations: Number(c.count),
      cases: caseCountMap.get(c.crop_name) || 0,
    }));

    // 5. Follow-Up Outcome Stats
    const fuTotalRow = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN symptom_trend = 'IMPROVED' THEN 1 ELSE 0 END) as improved,
             SUM(CASE WHEN symptom_trend = 'UNCHANGED' THEN 1 ELSE 0 END) as unchanged,
             SUM(CASE WHEN symptom_trend = 'WORSENED' THEN 1 ELSE 0 END) as worsened
      FROM follow_ups
      ${timeClause}
    `).get(...timeParams) as any;

    const followUpStats = {
      total: Number(fuTotalRow?.total || 0),
      completed: Number(fuTotalRow?.completed || 0),
      improved: Number(fuTotalRow?.improved || 0),
      unchanged: Number(fuTotalRow?.unchanged || 0),
      worsened: Number(fuTotalRow?.worsened || 0),
    };

    // 6. Expert Review Analytics (Phase 10 & 11)
    const expertStatsRow = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status != 'COMPLETED' THEN 1 ELSE 0 END) as pending,
             SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN agreement_status = 'AGREE' THEN 1 ELSE 0 END) as agree_count,
             SUM(CASE WHEN agreement_status = 'DISAGREE' THEN 1 ELSE 0 END) as disagree_count,
             SUM(CASE WHEN agreement_status IN ('INSUFFICIENT_EVIDENCE', 'NEEDS_MORE_INFORMATION') THEN 1 ELSE 0 END) as insufficient_count
      FROM expert_reviews
      ${timeClause}
    `).get(...timeParams) as any;

    const completedReviews = Number(expertStatsRow?.completed || 0);
    const agreeCount = Number(expertStatsRow?.agree_count || 0);
    const agreementRate = completedReviews > 0 ? Math.round((agreeCount / completedReviews) * 100) : 0;

    const expertReviewStats = {
      total: Number(expertStatsRow?.total || 0),
      pending: Number(expertStatsRow?.pending || 0),
      completed: completedReviews,
      agreeCount,
      disagreeCount: Number(expertStatsRow?.disagree_count || 0),
      insufficientEvidenceCount: Number(expertStatsRow?.insufficient_count || 0),
      agreementRate,
    };

    // 7. Emerging Symptoms Distribution
    const symptomRows = db.prepare(`
      SELECT symptom_tags FROM observations ${timeClause}
    `).all(...timeParams) as { symptom_tags: string }[];

    const symptomCounts: Record<string, number> = {};
    for (const row of symptomRows) {
      if (!row.symptom_tags) continue;
      try {
        const tags: string[] = JSON.parse(row.symptom_tags);
        for (const tag of tags) {
          const clean = tag.replace(/_/g, ' ').toLowerCase();
          symptomCounts[clean] = (symptomCounts[clean] || 0) + 1;
        }
      } catch {
        // Safe skip
      }
    }

    const emergingSymptoms = Object.entries(symptomCounts)
      .map(([symptom, count]) => ({ symptom, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 8. Coarse Hotspot Aggregates (Coarse area only - district level)
    const hotspotRows = db.prepare(`
      SELECT 
        COALESCE(u.district, 'Unspecified District') as district,
        COUNT(o.id) as count,
        SUM(CASE WHEN r.risk_level IN ('HIGH', 'CRITICAL') THEN 1 ELSE 0 END) as high_risk_count
      FROM observations o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN risk_assessments r ON o.id = r.observation_id
      ${startDate ? 'WHERE o.created_at >= ?' : ''}
      GROUP BY u.district
      ORDER BY count DESC
    `).all(...(startDate ? [startDate] : [])) as { district: string; count: number; high_risk_count: number }[];

    const coarseHotspots = hotspotRows.map((h) => ({
      district: h.district,
      count: Number(h.count),
      highRiskCount: Number(h.high_risk_count || 0),
    }));

    return {
      timeframe,
      totalObservations,
      activeCases,
      riskDistribution,
      cropDistribution,
      followUpStats,
      expertReviewStats,
      emergingSymptoms,
      coarseHotspots,
      hasSufficientData: totalObservations > 0,
      generatedAt: now.toISOString(),
    };
  }
}
