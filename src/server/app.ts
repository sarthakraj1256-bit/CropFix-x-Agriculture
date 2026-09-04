/**
 * CropFix - Express API Server & Routes
 * SIH26131: Early detection and management of crop diseases and pest infestations
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { getDb } from './db.js';
import { 
  authenticateUser, 
  registerUser, 
  getSessionUser, 
  deleteSession,
  verifyFarmOwnership,
  verifyPlotOwnership,
  verifyObservationAccess,
  verifyCaseAccess,
  verifyActionAccess,
  verifyFollowUpAccess
} from './auth.js';
import { AssessmentService } from './assessmentService.js';
import { RiskService } from './riskService.js';
import { GuidanceService } from './guidanceService.js';
import { CaseService } from './caseService.js';
import { ExpertService } from './expertService.js';
import { InstitutionalService } from './institutionalService.js';
import { NotificationService } from './notificationService.js';
import type { 
  User, 
  Farm, 
  Plot, 
  Observation, 
  AssessmentRecord, 
  RiskAssessmentRecord, 
  GuidanceRecord,
  ActionItem,
  FollowUpRecord,
  CropCase,
  ExpertReview,
  AppNotification,
  InstitutionalAnalytics,
  ApiResponse 
} from '../types/index.js';

export const app = express();

// Security Headers Middleware (Production Hardening)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// In-memory rate limiter for sensitive endpoints
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
export function rateLimiter(limit: number = 60, windowMs: number = 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      next();
    } else if (entry.count < limit) {
      entry.count++;
      next();
    } else {
      res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
    }
  };
}

// Helper to extract session token from Authorization header or Cookie
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/cropfix_session=([^;]+)/);
    if (match) return match[1].trim();
  }

  return null;
}

// Authentication Middleware
export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionToken?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    return;
  }

  const user = getSessionUser(token);
  if (!user) {
    res.status(401).json({ success: false, error: 'Invalid or expired session. Please log in again.' });
    return;
  }

  req.user = user;
  req.sessionToken = token;
  next();
}

// Role Authorization Middleware
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ 
        success: false, 
        error: `Access denied. Role ${req.user.role} is not authorized for this resource.` 
      });
      return;
    }
    next();
  };
}

// -------------------------------------------------------------
// AUTH ROUTES
// -------------------------------------------------------------

app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    const session = authenticateUser(email, password);
    res.setHeader('Set-Cookie', `cropfix_session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    res.json({ success: true, data: session });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Authentication failed';
    res.status(401).json({ success: false, error: msg });
  }
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { email, password, name, role, phone, district, state, preferredLanguage } = req.body;
    const session = registerUser({
      email,
      password,
      name,
      role: role || 'FARMER',
      phone,
      district,
      state,
      preferredLanguage
    });

    res.setHeader('Set-Cookie', `cropfix_session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    res.status(201).json({ success: true, data: session });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    res.status(400).json({ success: false, error: msg });
  }
});

app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.sessionToken) {
    deleteSession(req.sessionToken);
  }
  res.setHeader('Set-Cookie', 'cropfix_session=; Path=/; HttpOnly; Max-Age=0');
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: req.user });
});

// -------------------------------------------------------------
// FARM MANAGEMENT ROUTES (Phase 3)
// -------------------------------------------------------------

app.get('/api/farms', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const user = req.user!;

  const rows = (user.role === 'ADMIN'
    ? db.prepare('SELECT f.*, COUNT(p.id) as plots_count FROM farms f LEFT JOIN plots p ON f.id = p.farm_id WHERE f.is_active = 1 GROUP BY f.id ORDER BY f.created_at DESC').all()
    : db.prepare('SELECT f.*, COUNT(p.id) as plots_count FROM farms f LEFT JOIN plots p ON f.id = p.farm_id WHERE f.user_id = ? AND f.is_active = 1 GROUP BY f.id ORDER BY f.created_at DESC').all(user.id)
  ) as Array<{
    id: string;
    user_id: string;
    name: string;
    district: string;
    state: string;
    total_area: number;
    area_unit: string;
    soil_type: string | null;
    irrigation_type: string | null;
    is_active: number;
    plots_count: number;
    created_at: string;
    updated_at: string;
  }>;

  const farms: Farm[] = rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    district: r.district,
    state: r.state,
    totalArea: r.total_area,
    areaUnit: r.area_unit as Farm['areaUnit'],
    soilType: r.soil_type || undefined,
    irrigationType: r.irrigation_type || undefined,
    isActive: Boolean(r.is_active),
    plotsCount: r.plots_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  res.json({ success: true, data: farms });
});

app.post('/api/farms', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { name, district, state, totalArea, areaUnit, soilType, irrigationType } = req.body;

    if (!name?.trim() || !district?.trim() || !state?.trim() || !totalArea) {
      res.status(400).json({ success: false, error: 'Farm name, district, state, and total area are required' });
      return;
    }

    const db = getDb();
    const farmId = `farm-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO farms (id, user_id, name, district, state, total_area, area_unit, soil_type, irrigation_type, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      farmId,
      user.id,
      name.trim(),
      district.trim(),
      state.trim(),
      Number(totalArea),
      areaUnit || 'acres',
      soilType?.trim() || null,
      irrigationType?.trim() || null,
      now,
      now
    );

    res.status(201).json({
      success: true,
      data: {
        id: farmId,
        userId: user.id,
        name: name.trim(),
        district: district.trim(),
        state: state.trim(),
        totalArea: Number(totalArea),
        areaUnit: areaUnit || 'acres',
        soilType,
        irrigationType,
        isActive: true,
        plotsCount: 0,
        createdAt: now,
        updatedAt: now,
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create farm';
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/farms/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const farmId = req.params.id;
  if (!verifyFarmOwnership(farmId, req.user!)) {
    res.status(403).json({ success: false, error: 'Access denied to this farm resource (IDOR protection)' });
    return;
  }

  const db = getDb();
  const farm = db.prepare('SELECT * FROM farms WHERE id = ? AND is_active = 1').get(farmId) as any;
  if (!farm) {
    res.status(404).json({ success: false, error: 'Farm not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      id: farm.id,
      userId: farm.user_id,
      name: farm.name,
      district: farm.district,
      state: farm.state,
      totalArea: farm.total_area,
      areaUnit: farm.area_unit,
      soilType: farm.soil_type,
      irrigationType: farm.irrigation_type,
      isActive: Boolean(farm.is_active),
      createdAt: farm.created_at,
      updatedAt: farm.updated_at,
    }
  });
});

// -------------------------------------------------------------
// PLOT MANAGEMENT ROUTES (Phase 3)
// -------------------------------------------------------------

app.get('/api/farms/:farmId/plots', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const farmId = req.params.farmId;
  if (!verifyFarmOwnership(farmId, req.user!)) {
    res.status(403).json({ success: false, error: 'Access denied to this farm (IDOR protection)' });
    return;
  }

  const db = getDb();
  const rows = db.prepare('SELECT * FROM plots WHERE farm_id = ? AND is_active = 1 ORDER BY created_at DESC').all(farmId) as any[];

  const plots: Plot[] = rows.map(r => ({
    id: r.id,
    farmId: r.farm_id,
    userId: r.user_id,
    name: r.name,
    area: r.area,
    areaUnit: r.area_unit,
    cropName: r.crop_name,
    variety: r.variety || undefined,
    plantingDate: r.planting_date || undefined,
    cropStage: r.crop_stage,
    season: r.season,
    notes: r.notes || undefined,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  res.json({ success: true, data: plots });
});

app.post('/api/farms/:farmId/plots', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const farmId = req.params.farmId;
    if (!verifyFarmOwnership(farmId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied to this farm (IDOR protection)' });
      return;
    }

    const { name, area, areaUnit, cropName, variety, plantingDate, cropStage, season, notes } = req.body;
    if (!name?.trim() || !area || !cropName?.trim() || !cropStage || !season) {
      res.status(400).json({ success: false, error: 'Plot name, area, crop name, growth stage, and season are required' });
      return;
    }

    const db = getDb();
    const plotId = `plot-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO plots (id, farm_id, user_id, name, area, area_unit, crop_name, variety, planting_date, crop_stage, season, notes, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      plotId,
      farmId,
      req.user!.id,
      name.trim(),
      Number(area),
      areaUnit || 'acres',
      cropName.trim(),
      variety?.trim() || null,
      plantingDate || null,
      cropStage,
      season,
      notes?.trim() || null,
      now,
      now
    );

    res.status(201).json({
      success: true,
      data: {
        id: plotId,
        farmId,
        userId: req.user!.id,
        name: name.trim(),
        area: Number(area),
        areaUnit: areaUnit || 'acres',
        cropName: cropName.trim(),
        variety: variety?.trim(),
        plantingDate,
        cropStage,
        season,
        notes: notes?.trim(),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create plot';
    res.status(500).json({ success: false, error: msg });
  }
});

// -------------------------------------------------------------
// OBSERVATION ROUTES (Phase 4)
// -------------------------------------------------------------

app.get('/api/observations', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const user = req.user!;

  const rows = (user.role === 'ADMIN' || user.role === 'EXPERT' || user.role === 'INSTITUTIONAL'
    ? db.prepare(`
        SELECT o.*, f.name as farm_name, p.name as plot_name,
               (SELECT COUNT(*) FROM assessments a WHERE a.observation_id = o.id) as has_assessment,
               (SELECT COUNT(*) FROM risk_assessments r WHERE r.observation_id = o.id) as has_risk
        FROM observations o
        JOIN farms f ON o.farm_id = f.id
        JOIN plots p ON o.plot_id = p.id
        ORDER BY o.created_at DESC
      `).all()
    : db.prepare(`
        SELECT o.*, f.name as farm_name, p.name as plot_name,
               (SELECT COUNT(*) FROM assessments a WHERE a.observation_id = o.id) as has_assessment,
               (SELECT COUNT(*) FROM risk_assessments r WHERE r.observation_id = o.id) as has_risk
        FROM observations o
        JOIN farms f ON o.farm_id = f.id
        JOIN plots p ON o.plot_id = p.id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC
      `).all(user.id)
  ) as any[];

  const observations: Observation[] = rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    farmId: r.farm_id,
    plotId: r.plot_id,
    farmName: r.farm_name,
    plotName: r.plot_name,
    cropName: r.crop_name,
    growthStage: r.growth_stage,
    plantPart: r.plant_part,
    severityEstimate: r.severity_estimate,
    symptomTags: JSON.parse(r.symptom_tags),
    symptomDescription: r.symptom_description,
    imageId: r.image_id,
    imageMime: r.image_mime,
    farmerNotes: r.farmer_notes || undefined,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    hasAssessment: Boolean(r.has_assessment),
    hasRisk: Boolean(r.has_risk),
  }));

  res.json({ success: true, data: observations });
});

app.post('/api/observations', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { 
      farmId, 
      plotId, 
      cropName, 
      growthStage, 
      plantPart, 
      severityEstimate, 
      symptomTags, 
      symptomDescription, 
      imageData, // base64 data url
      farmerNotes 
    } = req.body;

    // Verify ownership of farm and plot
    if (!verifyFarmOwnership(farmId, user)) {
      res.status(403).json({ success: false, error: 'Unauthorized farm selection' });
      return;
    }
    if (!verifyPlotOwnership(plotId, user)) {
      res.status(403).json({ success: false, error: 'Unauthorized plot selection' });
      return;
    }

    if (!cropName || !growthStage || !plantPart || !severityEstimate || !imageData) {
      res.status(400).json({ 
        success: false, 
        error: 'Crop context, affected plant part, severity estimate, and crop image are required.' 
      });
      return;
    }

    // Validate image format and size
    const imageMatch = imageData.match(/^data:(image\/(jpeg|png|webp));base64,/);
    if (!imageMatch) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid image format. Supported formats: JPEG, PNG, WEBP.' 
      });
      return;
    }

    const mimeType = imageMatch[1];
    const imageSizeApprox = (imageData.length * 3) / 4;
    if (imageSizeApprox > 10 * 1024 * 1024) {
      res.status(400).json({ success: false, error: 'Image size exceeds 10MB limit.' });
      return;
    }

    const db = getDb();
    const obsId = `obs-${crypto.randomBytes(6).toString('hex')}`;
    const imageId = `img-${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO observations (
        id, user_id, farm_id, plot_id, crop_name, growth_stage, plant_part,
        severity_estimate, symptom_tags, symptom_description, image_id,
        image_mime, image_data, farmer_notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?)
    `).run(
      obsId,
      user.id,
      farmId,
      plotId,
      cropName,
      growthStage,
      plantPart,
      severityEstimate,
      JSON.stringify(Array.isArray(symptomTags) ? symptomTags : []),
      symptomDescription || '',
      imageId,
      mimeType,
      imageData, // Stored safely inside relational database
      farmerNotes || null,
      now,
      now
    );

    // Phase 9: Link or initialize longitudinal case for this plot & crop
    const activeCase = CaseService.findOrCreateActiveCase({
      userId: user.id,
      farmId,
      plotId,
      cropName,
      initialObservationId: obsId,
      severityEstimate,
    });

    res.status(201).json({
      success: true,
      data: {
        id: obsId,
        caseId: activeCase.id,
        userId: user.id,
        farmId,
        plotId,
        cropName,
        growthStage,
        plantPart,
        severityEstimate,
        symptomTags: Array.isArray(symptomTags) ? symptomTags : [],
        symptomDescription: symptomDescription || '',
        imageId,
        status: 'SUBMITTED',
        createdAt: now,
        updatedAt: now,
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record observation';
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/observations/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const obsId = req.params.id;
  if (!verifyObservationAccess(obsId, req.user!)) {
    res.status(403).json({ success: false, error: 'Access denied to this observation (IDOR protection)' });
    return;
  }

  const db = getDb();
  const row = db.prepare(`
    SELECT o.*, f.name as farm_name, p.name as plot_name
    FROM observations o
    JOIN farms f ON o.farm_id = f.id
    JOIN plots p ON o.plot_id = p.id
    WHERE o.id = ?
  `).get(obsId) as any;

  if (!row) {
    res.status(404).json({ success: false, error: 'Observation not found' });
    return;
  }

  const observation: Observation = {
    id: row.id,
    userId: row.user_id,
    farmId: row.farm_id,
    plotId: row.plot_id,
    farmName: row.farm_name,
    plotName: row.plot_name,
    cropName: row.crop_name,
    growthStage: row.growth_stage,
    plantPart: row.plant_part,
    severityEstimate: row.severity_estimate,
    symptomTags: JSON.parse(row.symptom_tags),
    symptomDescription: row.symptom_description,
    imageId: row.image_id,
    imageMime: row.image_mime,
    farmerNotes: row.farmer_notes || undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  res.json({ success: true, data: observation });
});

// Secure image serving endpoint with role/ownership enforcement
app.get('/api/observations/:id/image', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const obsId = req.params.id;
  if (!verifyObservationAccess(obsId, req.user!)) {
    res.status(403).json({ success: false, error: 'Unauthorized to access this crop image' });
    return;
  }

  const db = getDb();
  const row = db.prepare('SELECT image_data, image_mime FROM observations WHERE id = ?').get(obsId) as {
    image_data: string;
    image_mime: string;
  } | undefined;

  if (!row || !row.image_data) {
    res.status(404).json({ success: false, error: 'Image not found' });
    return;
  }

  // Handle base64 string
  const base64Data = row.image_data.replace(/^data:image\/\w+;base64,/, '');
  const imgBuffer = Buffer.from(base64Data, 'base64');

  res.setHeader('Content-Type', row.image_mime || 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.send(imgBuffer);
});

// -------------------------------------------------------------
// AI-ASSISTED ASSESSMENT ROUTES (Phase 5)
// -------------------------------------------------------------

app.post('/api/observations/:id/assess', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const obsId = req.params.id;
    if (!verifyObservationAccess(obsId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied to assess this observation' });
      return;
    }

    const db = getDb();
    const obs = db.prepare('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
    if (!obs) {
      res.status(404).json({ success: false, error: 'Observation not found' });
      return;
    }

    const assessment = await AssessmentService.assess({
      observationId: obs.id,
      cropName: obs.crop_name,
      growthStage: obs.growth_stage,
      plantPart: obs.plant_part,
      severityEstimate: obs.severity_estimate,
      symptomTags: JSON.parse(obs.symptom_tags),
      symptomDescription: obs.symptom_description,
      imageData: obs.image_data,
    });

    res.json({ success: true, data: assessment });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Assessment failed';
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/observations/:id/assessment', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const obsId = req.params.id;
  if (!verifyObservationAccess(obsId, req.user!)) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  const db = getDb();
  const row = db.prepare('SELECT * FROM assessments WHERE observation_id = ?').get(obsId) as any;
  if (!row) {
    res.status(404).json({ success: false, error: 'Assessment not found for this observation' });
    return;
  }

  const assessment: AssessmentRecord = {
    id: row.id,
    observationId: row.observation_id,
    engineId: row.engine_id,
    status: row.status,
    primaryIssue: row.primary_issue,
    issueCategory: row.issue_category,
    confidenceLevel: row.confidence_level,
    confidenceScore: row.confidence_score,
    evidencePoints: JSON.parse(row.evidence_points),
    alternativeCandidates: JSON.parse(row.alternative_candidates),
    uncertaintyNotes: row.uncertainty_notes,
    isDemo: Boolean(row.is_demo),
    disclaimer: row.disclaimer,
    createdAt: row.created_at,
  };

  res.json({ success: true, data: assessment });
});

// -------------------------------------------------------------
// RISK & UNCERTAINTY INTELLIGENCE ROUTES (Phase 6)
// -------------------------------------------------------------

app.post('/api/observations/:id/risk', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const obsId = req.params.id;
    if (!verifyObservationAccess(obsId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const db = getDb();
    const obs = db.prepare(`
      SELECT o.*, f.name as farm_name, p.name as plot_name
      FROM observations o
      JOIN farms f ON o.farm_id = f.id
      JOIN plots p ON o.plot_id = p.id
      WHERE o.id = ?
    `).get(obsId) as any;

    if (!obs) {
      res.status(404).json({ success: false, error: 'Observation not found' });
      return;
    }

    const asmtRow = db.prepare('SELECT * FROM assessments WHERE observation_id = ?').get(obsId) as any;
    if (!asmtRow) {
      res.status(400).json({ 
        success: false, 
        error: 'Observation has not been assessed yet. AI Assessment must precede Risk Evaluation.' 
      });
      return;
    }

    const observation: Observation = {
      id: obs.id,
      userId: obs.user_id,
      farmId: obs.farm_id,
      plotId: obs.plot_id,
      farmName: obs.farm_name,
      plotName: obs.plot_name,
      cropName: obs.crop_name,
      growthStage: obs.growth_stage,
      plantPart: obs.plant_part,
      severityEstimate: obs.severity_estimate,
      symptomTags: JSON.parse(obs.symptom_tags),
      symptomDescription: obs.symptom_description,
      imageId: obs.image_id,
      status: obs.status,
      createdAt: obs.created_at,
      updatedAt: obs.updated_at,
    };

    const assessment: AssessmentRecord = {
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

    const riskAssessment = RiskService.evaluate(observation, assessment);
    res.json({ success: true, data: riskAssessment });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Risk evaluation failed';
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/observations/:id/risk', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const obsId = req.params.id;
  if (!verifyObservationAccess(obsId, req.user!)) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  const db = getDb();
  const row = db.prepare('SELECT * FROM risk_assessments WHERE observation_id = ?').get(obsId) as any;
  if (!row) {
    res.status(404).json({ success: false, error: 'Risk evaluation not found for this observation' });
    return;
  }

  const riskAssessment: RiskAssessmentRecord = {
    id: row.id,
    observationId: row.observation_id,
    assessmentId: row.assessment_id,
    riskLevel: row.risk_level,
    riskScore: row.risk_score,
    riskFactors: JSON.parse(row.risk_factors),
    uncertaintyFactors: JSON.parse(row.uncertainty_factors),
    explanation: row.explanation,
    expertReviewRecommended: Boolean(row.expert_review_recommended),
    requiresEscalation: Boolean(row.requires_escalation),
    reviewReason: row.review_reason || undefined,
    recommendedActions: JSON.parse(row.recommended_actions),
    isDemo: Boolean(row.is_demo),
    disclaimer: row.disclaimer,
    createdAt: row.created_at,
  };

  res.json({ success: true, data: riskAssessment });
});

// Expert Review Escalation
app.post('/api/observations/:id/request-review', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const obsId = req.params.id;
    if (!verifyObservationAccess(obsId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { notes } = req.body;
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare('UPDATE observations SET status = ?, updated_at = ? WHERE id = ?').run('NEEDS_REVIEW', now, obsId);
    
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, created_at)
      VALUES (?, ?, 'REQUEST_EXPERT_REVIEW', 'observation', ?, ?, ?)
    `).run(`aud-${crypto.randomBytes(6).toString('hex')}`, req.user!.id, obsId, JSON.stringify({ notes }), now);

    res.json({ 
      success: true, 
      message: 'Expert review successfully requested. The case has been queued for human agronomy validation.' 
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to request review';
    res.status(500).json({ success: false, error: msg });
  }
});

// -------------------------------------------------------------
// PHASE 7: GUIDANCE & ACTION MANAGEMENT ROUTES
// -------------------------------------------------------------

app.post('/api/observations/:id/guidance', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const obsId = req.params.id;
    if (!verifyObservationAccess(obsId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied (IDOR protection)' });
      return;
    }

    const db = getDb();
    const obsRow = db.prepare('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
    if (!obsRow) {
      res.status(404).json({ success: false, error: 'Observation not found' });
      return;
    }

    const observation: Observation = {
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
      imageMime: obsRow.image_mime,
      status: obsRow.status,
      createdAt: obsRow.created_at,
      updatedAt: obsRow.updated_at,
    };

    // Retrieve Assessment (must precede guidance)
    const asmtRow = db.prepare('SELECT * FROM assessments WHERE observation_id = ?').get(obsId) as any;
    if (!asmtRow) {
      res.status(400).json({
        success: false,
        error: 'Observation has not been assessed yet. AI Assessment must precede Guidance generation.'
      });
      return;
    }

    const assessment: AssessmentRecord = {
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

    // Retrieve or generate Risk Assessment
    let riskRow = db.prepare('SELECT * FROM risk_assessments WHERE observation_id = ?').get(obsId) as any;
    let riskAssessment: RiskAssessmentRecord;
    if (!riskRow) {
      riskAssessment = RiskService.evaluate(observation, assessment);
    } else {
      riskAssessment = {
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
        reviewReason: riskRow.review_reason || undefined,
        recommendedActions: JSON.parse(riskRow.recommended_actions),
        isDemo: Boolean(riskRow.is_demo),
        disclaimer: riskRow.disclaimer,
        createdAt: riskRow.created_at,
      };
    }

    const result = GuidanceService.generateGuidance({
      observation,
      assessment,
      riskAssessment,
      caseId: obsRow.case_id || undefined,
    });

    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate guidance';
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/observations/:id/guidance', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const obsId = req.params.id;
  if (!verifyObservationAccess(obsId, req.user!)) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  const guidance = GuidanceService.getGuidance(obsId);
  res.json({ success: true, data: guidance });
});

app.get('/api/observations/:id/actions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const obsId = req.params.id;
  if (!verifyObservationAccess(obsId, req.user!)) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  const actions = GuidanceService.getActions(obsId);
  res.json({ success: true, data: actions });
});

app.post('/api/observations/:id/actions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const obsId = req.params.id;
    if (!verifyObservationAccess(obsId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { title, description, category, priority, dueDate } = req.body;
    if (!title?.trim() || !description?.trim()) {
      res.status(400).json({ success: false, error: 'Title and description are required' });
      return;
    }

    const db = getDb();
    const obsRow = db.prepare('SELECT case_id FROM observations WHERE id = ?').get(obsId) as { case_id: string } | undefined;
    const actionId = `act-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO action_items (
        id, user_id, observation_id, case_id, title, description,
        category, priority, due_date, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `).run(
      actionId,
      req.user!.id,
      obsId,
      obsRow?.case_id || null,
      title.trim(),
      description.trim(),
      category?.trim() || 'FARMER_TASK',
      priority || 'NORMAL',
      dueDate || null,
      now
    );

    const action = db.prepare('SELECT * FROM action_items WHERE id = ?').get(actionId) as any;
    res.status(201).json({
      success: true,
      data: {
        id: action.id,
        userId: action.user_id,
        observationId: action.observation_id,
        caseId: action.case_id || undefined,
        title: action.title,
        description: action.description,
        category: action.category,
        priority: action.priority,
        dueDate: action.due_date || undefined,
        status: action.status,
        createdAt: action.created_at,
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to add action item';
    res.status(500).json({ success: false, error: msg });
  }
});

app.patch('/api/actions/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const actionId = req.params.id;
    if (!verifyActionAccess(actionId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied to this action item' });
      return;
    }

    const { status } = req.body;
    if (!status || !['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED'].includes(status)) {
      res.status(400).json({ success: false, error: 'Valid status is required' });
      return;
    }

    const updated = GuidanceService.updateActionStatus(actionId, status);
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update action';
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/actions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const statusFilter = req.query.status as string | undefined;

  let query = 'SELECT * FROM action_items WHERE user_id = ?';
  const params: any[] = [userId];

  if (statusFilter && statusFilter !== 'ALL') {
    query += ' AND status = ?';
    params.push(statusFilter);
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params) as any[];
  const actions: ActionItem[] = rows.map(r => ({
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

  res.json({ success: true, data: actions });
});

// -------------------------------------------------------------
// PHASE 8: FOLLOW-UP & OUTCOME TRACKING ROUTES
// -------------------------------------------------------------

app.post('/api/observations/:id/follow-ups', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const obsId = req.params.id;
    if (!verifyObservationAccess(obsId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { scheduledDate, notes, actionId } = req.body;
    if (!scheduledDate) {
      res.status(400).json({ success: false, error: 'Scheduled follow-up date is required' });
      return;
    }

    const db = getDb();
    const obs = db.prepare('SELECT plot_id, case_id FROM observations WHERE id = ?').get(obsId) as any;
    if (!obs) {
      res.status(404).json({ success: false, error: 'Observation not found' });
      return;
    }

    const followUp = CaseService.scheduleFollowUp({
      userId: req.user!.id,
      observationId: obsId,
      caseId: obs.case_id,
      plotId: obs.plot_id,
      scheduledDate,
      actionId,
      notes,
    });

    res.status(201).json({ success: true, data: followUp });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to schedule follow-up';
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/observations/:id/follow-ups', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const obsId = req.params.id;
  if (!verifyObservationAccess(obsId, req.user!)) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  const followUps = CaseService.listFollowUps({ observationId: obsId });
  res.json({ success: true, data: followUps });
});

app.get('/api/follow-ups', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const followUps = CaseService.listFollowUps({ userId: req.user!.id });
  res.json({ success: true, data: followUps });
});

app.post('/api/follow-ups/:id/complete', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const followUpId = req.params.id;
    if (!verifyFollowUpAccess(followUpId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied to this follow-up' });
      return;
    }

    const { symptomTrend, farmerNotes, actionEffectiveness, followupImageData } = req.body;
    if (!symptomTrend || !['IMPROVED', 'UNCHANGED', 'WORSENED', 'NEW_SYMPTOMS', 'UNCERTAIN'].includes(symptomTrend)) {
      res.status(400).json({ success: false, error: 'Valid symptom trend is required (IMPROVED, UNCHANGED, WORSENED, NEW_SYMPTOMS, UNCERTAIN)' });
      return;
    }

    let mimeType: string | undefined;
    if (followupImageData) {
      const match = followupImageData.match(/^data:(image\/(jpeg|png|webp));base64,/);
      if (match) mimeType = match[1];
    }

    const completed = CaseService.completeFollowUp({
      followUpId,
      symptomTrend,
      farmerNotes,
      actionEffectiveness,
      followupImageData,
      mimeType,
    });

    res.json({ success: true, data: completed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to complete follow-up';
    res.status(500).json({ success: false, error: msg });
  }
});

app.post('/api/follow-ups/:id/reschedule', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const followUpId = req.params.id;
    if (!verifyFollowUpAccess(followUpId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { newDate } = req.body;
    if (!newDate) {
      res.status(400).json({ success: false, error: 'New date is required' });
      return;
    }

    const rescheduled = CaseService.rescheduleFollowUp(followUpId, newDate);
    res.json({ success: true, data: rescheduled });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reschedule follow-up';
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/follow-ups/:id/image', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const followUpId = req.params.id;
  if (!verifyFollowUpAccess(followUpId, req.user!)) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  const db = getDb();
  const row = db.prepare('SELECT followup_image_mime, followup_image_data FROM follow_ups WHERE id = ?').get(followUpId) as any;
  if (!row || !row.followup_image_data) {
    res.status(404).json({ success: false, error: 'Follow-up image not found' });
    return;
  }

  const base64Data = row.followup_image_data.replace(/^data:image\/[a-z]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  res.setHeader('Content-Type', row.followup_image_mime || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(buffer);
});

// -------------------------------------------------------------
// PHASE 9: CASE HISTORY & LONGITUDINAL TRACKING ROUTES
// -------------------------------------------------------------

app.get('/api/cases', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const statusFilter = req.query.status as string | undefined;
  const cases = CaseService.listCases(req.user!.id, req.user!.role, statusFilter);
  res.json({ success: true, data: cases });
});

app.get('/api/cases/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const caseId = req.params.id;
  if (!verifyCaseAccess(caseId, req.user!)) {
    res.status(403).json({ success: false, error: 'Access denied to this case' });
    return;
  }

  const cropCase = CaseService.getCase(caseId);
  if (!cropCase) {
    res.status(404).json({ success: false, error: 'Case not found' });
    return;
  }

  res.json({ success: true, data: cropCase });
});

app.get('/api/cases/:id/timeline', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const caseId = req.params.id;
  if (!verifyCaseAccess(caseId, req.user!)) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  const timeline = CaseService.getCaseTimeline(caseId);
  res.json({ success: true, data: timeline });
});

app.get('/api/cases/:id/insights', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = req.params.id;
    if (!verifyCaseAccess(caseId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const insights = CaseService.getCaseInsights(caseId);
    res.json({ success: true, data: insights });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to calculate insights';
    res.status(500).json({ success: false, error: msg });
  }
});

app.post('/api/cases/:id/resolve', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = req.params.id;
    if (!verifyCaseAccess(caseId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { notes } = req.body;
    const resolved = CaseService.resolveCase(caseId, notes);
    res.json({ success: true, data: resolved });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to resolve case';
    res.status(500).json({ success: false, error: msg });
  }
});

app.post('/api/cases/:id/reopen', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = req.params.id;
    if (!verifyCaseAccess(caseId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const reopened = CaseService.reopenCase(caseId);
    res.json({ success: true, data: reopened });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reopen case';
    res.status(500).json({ success: false, error: msg });
  }
});

// -------------------------------------------------------------
// PHASE 10: EXPERT REVIEW & HUMAN VALIDATION ROUTES
// -------------------------------------------------------------

app.get('/api/expert/queue', requireAuth, requireRole(['EXPERT', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const crop = req.query.crop as string | undefined;
    const risk = req.query.risk as string | undefined;
    const status = req.query.status as string | undefined;

    const queue = ExpertService.listExpertQueue({ crop, risk, status });
    res.json({ success: true, data: queue });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve expert queue';
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/observations/:id/review', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const obsId = req.params.id;
  if (!verifyObservationAccess(obsId, req.user!)) {
    res.status(403).json({ success: false, error: 'Access denied to this review record' });
    return;
  }

  const review = ExpertService.getReviewForObservation(obsId);
  res.json({ success: true, data: review });
});

app.post('/api/observations/:id/review', requireAuth, requireRole(['EXPERT', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const obsId = req.params.id;
    if (!verifyObservationAccess(obsId, req.user!)) {
      res.status(403).json({ success: false, error: 'Access denied to this observation' });
      return;
    }

    const { 
      agreementStatus, 
      expertAssessment, 
      confidenceLevel, 
      expertNotes, 
      recommendations,
      priority 
    } = req.body;

    const validAgreements = ['AGREE', 'DISAGREE', 'INSUFFICIENT_EVIDENCE', 'NEEDS_MORE_INFORMATION'];
    if (!agreementStatus || !validAgreements.includes(agreementStatus)) {
      res.status(400).json({ 
        success: false, 
        error: `Valid agreementStatus is required (${validAgreements.join(', ')})` 
      });
      return;
    }

    const review = ExpertService.submitExpertReview({
      observationId: obsId,
      expertUser: req.user!,
      agreementStatus,
      expertAssessment,
      confidenceLevel,
      expertNotes,
      recommendations: Array.isArray(recommendations) ? recommendations : undefined,
      priority,
    });

    res.status(201).json({ success: true, data: review });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to submit expert review';
    res.status(500).json({ success: false, error: msg });
  }
});

// -------------------------------------------------------------
// PHASE 11: INSTITUTIONAL SURVEILLANCE & AGGREGATE INTELLIGENCE
// -------------------------------------------------------------

app.get('/api/institutional/analytics', requireAuth, requireRole(['INSTITUTIONAL', 'ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as string) || '30d';
    const validTimeframes = ['today', '7d', '30d', 'all'];
    const chosenTimeframe = validTimeframes.includes(timeframe) ? (timeframe as any) : '30d';

    const analytics = InstitutionalService.getAggregatedAnalytics(chosenTimeframe);
    res.json({ success: true, data: analytics });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to calculate surveillance intelligence';
    res.status(500).json({ success: false, error: msg });
  }
});

// -------------------------------------------------------------
// PHASE 12: SYSTEM NOTIFICATIONS & ALERTS
// -------------------------------------------------------------

app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const result = NotificationService.getUserNotifications(req.user!.id, unreadOnly);
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load notifications';
    res.status(500).json({ success: false, error: msg });
  }
});

app.patch('/api/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifId = req.params.id;
    const updated = NotificationService.markAsRead(notifId, req.user!.id);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Notification not found or unauthorized' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update notification';
    res.status(500).json({ success: false, error: msg });
  }
});

app.post('/api/notifications/mark-all-read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updatedCount = NotificationService.markAllAsRead(req.user!.id);
    res.json({ success: true, data: { updatedCount } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to mark notifications read';
    res.status(500).json({ success: false, error: msg });
  }
});

// -------------------------------------------------------------
// PHASE 13-15: ADMIN METRICS & SYSTEM AUDIT STATUS
// -------------------------------------------------------------

app.get('/api/admin/metrics', requireAuth, requireRole(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    
    // User role breakdown
    const userRows = db.prepare('SELECT role, COUNT(*) as count FROM users GROUP BY role').all() as { role: string; count: number }[];
    const usersByRole: Record<string, number> = {};
    for (const r of userRows) {
      usersByRole[r.role] = Number(r.count);
    }

    const obsCount = (db.prepare('SELECT COUNT(*) as c FROM observations').get() as any)?.c || 0;
    const casesCount = (db.prepare('SELECT COUNT(*) as c FROM cases').get() as any)?.c || 0;
    const reviewsCount = (db.prepare('SELECT COUNT(*) as c FROM expert_reviews').get() as any)?.c || 0;
    const pendingReviewsCount = (db.prepare("SELECT COUNT(*) as c FROM observations WHERE status = 'NEEDS_REVIEW'").get() as any)?.c || 0;
    const activeSessionsCount = (db.prepare('SELECT COUNT(*) as c FROM sessions WHERE expires_at > ?').get(new Date().toISOString()) as any)?.c || 0;
    const auditLogsCount = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any)?.c || 0;

    // Recent audit events (sanitized, zero secret leakage)
    const recentAudits = db.prepare(`
      SELECT a.id, a.action, a.resource_type, a.resource_id, a.created_at, u.name as user_name, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `).all() as any[];

    res.json({
      success: true,
      data: {
        usersByRole,
        activeSessionsCount: Number(activeSessionsCount),
        totalObservations: Number(obsCount),
        totalCases: Number(casesCount),
        totalReviews: Number(reviewsCount),
        pendingReviewsCount: Number(pendingReviewsCount),
        totalAuditLogs: Number(auditLogsCount),
        recentAudits,
        systemStatus: 'HEALTHY',
        databaseEngine: 'node:sqlite (DatabaseSync)',
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve admin telemetry';
    res.status(500).json({ success: false, error: msg });
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'CropFix Core API',
    problemStatement: 'SIH26131',
    timestamp: new Date().toISOString(),
  });
});
