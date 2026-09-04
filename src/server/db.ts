/**
 * CropFix - Database Layer (Relational SQLite via Node.js native DatabaseSync)
 * SIH26131: Early detection and management of crop diseases and pest infestations
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const DB_PATH = process.env.NODE_ENV === 'test' ? ':memory:' : path.resolve(process.cwd(), 'cropfix.db');

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    initSchema(dbInstance);
    seedDemoData(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('FARMER', 'EXPERT', 'INSTITUTIONAL', 'ADMIN')),
      name TEXT NOT NULL,
      phone TEXT,
      district TEXT,
      state TEXT,
      preferred_language TEXT DEFAULT 'English',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

    CREATE TABLE IF NOT EXISTS farms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      district TEXT NOT NULL,
      state TEXT NOT NULL,
      total_area REAL NOT NULL,
      area_unit TEXT NOT NULL CHECK(area_unit IN ('acres', 'hectares', 'bigha', 'guntha')),
      soil_type TEXT,
      irrigation_type TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_farms_user ON farms(user_id);

    CREATE TABLE IF NOT EXISTS plots (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      area REAL NOT NULL,
      area_unit TEXT NOT NULL CHECK(area_unit IN ('acres', 'hectares', 'bigha', 'guntha')),
      crop_name TEXT NOT NULL,
      variety TEXT,
      planting_date TEXT,
      crop_stage TEXT NOT NULL,
      season TEXT NOT NULL CHECK(season IN ('Kharif', 'Rabi', 'Zaid', 'Perennial')),
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_plots_farm ON plots(farm_id);
    CREATE INDEX IF NOT EXISTS idx_plots_user ON plots(user_id);

    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
      crop_name TEXT NOT NULL,
      growth_stage TEXT NOT NULL,
      plant_part TEXT NOT NULL,
      severity_estimate TEXT NOT NULL,
      symptom_tags TEXT NOT NULL, -- JSON array
      symptom_description TEXT NOT NULL,
      image_id TEXT NOT NULL,
      image_mime TEXT,
      image_data TEXT, -- Base64 data or storage ref
      farmer_notes TEXT,
      status TEXT NOT NULL CHECK(status IN ('DRAFT', 'SUBMITTED', 'PROCESSING', 'ASSESSED', 'NEEDS_REVIEW', 'RESOLVED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_obs_user ON observations(user_id);
    CREATE INDEX IF NOT EXISTS idx_obs_farm ON observations(farm_id);
    CREATE INDEX IF NOT EXISTS idx_obs_plot ON observations(plot_id);

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
      engine_id TEXT NOT NULL,
      status TEXT NOT NULL,
      primary_issue TEXT NOT NULL,
      issue_category TEXT NOT NULL,
      confidence_level TEXT NOT NULL CHECK(confidence_level IN ('HIGH', 'MEDIUM', 'LOW')),
      confidence_score REAL NOT NULL,
      evidence_points TEXT NOT NULL, -- JSON array
      alternative_candidates TEXT NOT NULL, -- JSON array
      uncertainty_notes TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 1,
      disclaimer TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_assessments_obs ON assessments(observation_id);

    CREATE TABLE IF NOT EXISTS risk_assessments (
      id TEXT PRIMARY KEY,
      observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      risk_level TEXT NOT NULL CHECK(risk_level IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'UNCERTAIN')),
      risk_score INTEGER NOT NULL,
      risk_factors TEXT NOT NULL, -- JSON array
      uncertainty_factors TEXT NOT NULL, -- JSON array
      explanation TEXT NOT NULL,
      expert_review_recommended INTEGER NOT NULL DEFAULT 0,
      requires_escalation INTEGER NOT NULL DEFAULT 0,
      review_reason TEXT,
      recommended_actions TEXT NOT NULL, -- JSON array
      is_demo INTEGER NOT NULL DEFAULT 1,
      disclaimer TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_risk_obs ON risk_assessments(observation_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    -- Phase 9: Crop-Health Cases
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
      crop_name TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('OPEN', 'MONITORING', 'IMPROVING', 'WORSENING', 'RESOLVED', 'NEEDS_REVIEW')),
      severity_summary TEXT,
      risk_summary TEXT,
      initial_observation_id TEXT,
      resolved_at TEXT,
      resolution_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cases_user ON cases(user_id);
    CREATE INDEX IF NOT EXISTS idx_cases_plot ON cases(plot_id);

    -- Phase 7: Guidance Layer Records
    CREATE TABLE IF NOT EXISTS guidance_records (
      id TEXT PRIMARY KEY,
      observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
      case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
      risk_assessment_id TEXT,
      category TEXT NOT NULL CHECK(category IN (
        'IMMEDIATE_OBSERVATION',
        'MONITORING',
        'FIELD_SCOUTING',
        'CULTURAL_PREVENTIVE',
        'INTEGRATED_PEST_MANAGEMENT',
        'EXPERT_EXTENSION_REFERRAL',
        'LAB_CONFIRMATION',
        'FOLLOW_UP'
      )),
      recommendation TEXT NOT NULL,
      rationale TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
      source_reference TEXT,
      safety_note TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_guidance_obs ON guidance_records(observation_id);
    CREATE INDEX IF NOT EXISTS idx_guidance_case ON guidance_records(case_id);

    -- Phase 7: Farmer Action Items / Tasks
    CREATE TABLE IF NOT EXISTS action_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
      case_id TEXT REFERENCES cases(id) ON DELETE CASCADE,
      guidance_id TEXT REFERENCES guidance_records(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
      due_date TEXT,
      status TEXT NOT NULL CHECK(status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED')),
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_actions_user ON action_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_actions_obs ON action_items(observation_id);
    CREATE INDEX IF NOT EXISTS idx_actions_case ON action_items(case_id);

    -- Phase 8: Follow-Ups & Outcome Tracking
    CREATE TABLE IF NOT EXISTS follow_ups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
      case_id TEXT REFERENCES cases(id) ON DELETE CASCADE,
      plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
      action_id TEXT REFERENCES action_items(id) ON DELETE SET NULL,
      scheduled_date TEXT NOT NULL,
      completed_date TEXT,
      status TEXT NOT NULL CHECK(status IN ('SCHEDULED', 'DUE', 'COMPLETED', 'MISSED', 'CANCELLED')),
      farmer_notes TEXT,
      symptom_trend TEXT CHECK(symptom_trend IN ('IMPROVED', 'UNCHANGED', 'WORSENED', 'NEW_SYMPTOMS', 'UNCERTAIN') OR symptom_trend IS NULL),
      followup_image_id TEXT,
      followup_image_mime TEXT,
      followup_image_data TEXT,
      outcome_summary TEXT,
      action_effectiveness TEXT,
      escalation_recommended INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_followups_user ON follow_ups(user_id);
    CREATE INDEX IF NOT EXISTS idx_followups_obs ON follow_ups(observation_id);
    CREATE INDEX IF NOT EXISTS idx_followups_case ON follow_ups(case_id);

    -- Phase 10: Expert Reviews & Human Validation
    CREATE TABLE IF NOT EXISTS expert_reviews (
      id TEXT PRIMARY KEY,
      case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
      observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
      expert_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expert_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('OPEN', 'ASSIGNED', 'IN_REVIEW', 'COMPLETED', 'DECLINED')),
      expert_assessment TEXT,
      confidence_level TEXT CHECK(confidence_level IN ('HIGH', 'MEDIUM', 'LOW') OR confidence_level IS NULL),
      agreement_status TEXT NOT NULL CHECK(agreement_status IN ('AGREE', 'DISAGREE', 'INSUFFICIENT_EVIDENCE', 'NEEDS_MORE_INFORMATION')),
      expert_notes TEXT,
      recommendations TEXT,
      priority TEXT NOT NULL CHECK(priority IN ('NORMAL', 'HIGH', 'URGENT')) DEFAULT 'NORMAL',
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_obs ON expert_reviews(observation_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_case ON expert_reviews(case_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_expert ON expert_reviews(expert_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_status ON expert_reviews(status);

    -- Phase 12: System Notifications & Alerts
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN (
        'FOLLOWUP_DUE',
        'FOLLOWUP_OVERDUE',
        'HIGH_RISK_ALERT',
        'EXPERT_REVIEW_COMPLETED',
        'ACTION_DUE',
        'ACTION_OVERDUE',
        'NEW_EXPERT_REVIEW_ASSIGNED',
        'CASE_STATUS_UPDATE'
      )),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('INFO', 'NORMAL', 'HIGH', 'URGENT')) DEFAULT 'NORMAL',
      related_entity_type TEXT,
      related_entity_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      read_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, is_read);
  `);

  // Safe schema migrations for existing observations table
  try {
    db.exec('ALTER TABLE observations ADD COLUMN case_id TEXT REFERENCES cases(id) ON DELETE SET NULL;');
  } catch {
    // Column already exists
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function seedDemoData(db: DatabaseSync): void {
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existingUsers && existingUsers.count > 0) {
    return;
  }

  const now = new Date().toISOString();

  // Demo accounts
  const demoUsers = [
    {
      id: 'usr-farmer-01',
      email: 'farmer@cropfix.org',
      password: 'Farmer@123',
      role: 'FARMER',
      name: 'Ramesh Patel',
      phone: '+91 98234 56789',
      district: 'Nashik',
      state: 'Maharashtra',
      preferred_language: 'Marathi',
    },
    {
      id: 'usr-expert-01',
      email: 'expert@cropfix.org',
      password: 'Expert@123',
      role: 'EXPERT',
      name: 'Dr. Ananya Sharma',
      phone: '+91 98111 22334',
      district: 'Pune',
      state: 'Maharashtra',
      preferred_language: 'English',
    },
    {
      id: 'usr-inst-01',
      email: 'institutional@cropfix.org',
      password: 'Institutional@123',
      role: 'INSTITUTIONAL',
      name: 'Rajesh Nair',
      phone: '+91 94455 66778',
      district: 'Nashik',
      state: 'Maharashtra',
      preferred_language: 'English',
    },
    {
      id: 'usr-admin-01',
      email: 'admin@cropfix.org',
      password: 'Admin@123',
      role: 'ADMIN',
      name: 'CropFix System Admin',
      phone: '+91 90000 00001',
      district: 'New Delhi',
      state: 'Delhi',
      preferred_language: 'English',
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, role, name, phone, district, state, preferred_language, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of demoUsers) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(u.password, salt);
    insertUser.run(u.id, u.email, hash, salt, u.role, u.name, u.phone, u.district, u.state, u.preferred_language, now, now);
  }

  // Seed a sample farm and plot for Ramesh Patel
  const insertFarm = db.prepare(`
    INSERT INTO farms (id, user_id, name, district, state, total_area, area_unit, soil_type, irrigation_type, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const farmId = 'farm-demo-01';
  insertFarm.run(
    farmId,
    'usr-farmer-01',
    'Patel Green Acres',
    'Nashik',
    'Maharashtra',
    4.5,
    'acres',
    'Black cotton soil',
    'Drip irrigation',
    1,
    now,
    now
  );

  const insertPlot = db.prepare(`
    INSERT INTO plots (id, farm_id, user_id, name, area, area_unit, crop_name, variety, planting_date, crop_stage, season, notes, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const plot1Id = 'plot-demo-01';
  insertPlot.run(
    plot1Id,
    farmId,
    'usr-farmer-01',
    'North Block (Tomato)',
    2.0,
    'acres',
    'Tomato',
    'Abhinav F1',
    '2026-07-15',
    'Flowering',
    'Kharif',
    'Good canopy growth, trellised drip system',
    1,
    now,
    now
  );

  const plot2Id = 'plot-demo-02';
  insertPlot.run(
    plot2Id,
    farmId,
    'usr-farmer-01',
    'South Block (Chilli)',
    1.5,
    'acres',
    'Chilli',
    'G4 / Sitara',
    '2026-08-01',
    'Vegetative',
    'Kharif',
    'Organic mulch applied',
    1,
    now,
    now
  );
}
