/**
 * CropFix - Authentication & Authorization Layer
 * SIH26131: Early detection and management of crop diseases and pest infestations
 */

import crypto from 'node:crypto';
import { getDb } from './db.js';
import type { User, UserRole, AuthSession } from '../types/index.js';

interface DbUserRow {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  role: string;
  name: string;
  phone: string | null;
  district: string | null;
  state: string | null;
  preferred_language: string | null;
  created_at: string;
  updated_at: string;
}

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function sanitizeUser(row: DbUserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role as UserRole,
    name: row.name,
    phone: row.phone || undefined,
    district: row.district || undefined,
    state: row.state || undefined,
    preferredLanguage: row.preferred_language || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSession(userId: string): AuthSession {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, expiresAt, createdAt);

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as DbUserRow | undefined;
  if (!userRow) {
    throw new Error('User not found for session');
  }

  return {
    token,
    user: sanitizeUser(userRow),
    expiresAt,
  };
}

export function getSessionUser(token: string): User | null {
  if (!token) return null;
  const db = getDb();
  const now = new Date().toISOString();

  const sessionRow = db.prepare(`
    SELECT s.token, s.expires_at, u.*
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, now) as unknown as (DbUserRow & { token: string; expires_at: string }) | undefined;

  if (!sessionRow) {
    return null;
  }

  return sanitizeUser(sessionRow);
}

export function deleteSession(token: string): void {
  if (!token) return;
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function authenticateUser(email: string, password: string): AuthSession {
  const db = getDb();
  const userRow = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email) as unknown as DbUserRow | undefined;

  if (!userRow) {
    throw new Error('Invalid email or password');
  }

  const expectedHash = hashPassword(password, userRow.salt);
  const hashMatches = crypto.timingSafeEqual(
    Buffer.from(expectedHash, 'hex'),
    Buffer.from(userRow.password_hash, 'hex')
  );

  if (!hashMatches) {
    throw new Error('Invalid email or password');
  }

  return createSession(userRow.id);
}

export function registerUser(params: {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  phone?: string;
  district?: string;
  state?: string;
  preferredLanguage?: string;
}): AuthSession {
  const db = getDb();
  const emailClean = params.email.trim().toLowerCase();
  
  if (!emailClean || !params.password || !params.name.trim()) {
    throw new Error('Email, password, and name are required');
  }

  if (params.password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(emailClean);
  if (existing) {
    throw new Error('An account with this email already exists');
  }

  const userId = `usr-${crypto.randomBytes(8).toString('hex')}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(params.password, salt);
  const role: UserRole = params.role || 'FARMER';
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, role, name, phone, district, state, preferred_language, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    emailClean,
    passwordHash,
    salt,
    role,
    params.name.trim(),
    params.phone?.trim() || null,
    params.district?.trim() || null,
    params.state?.trim() || null,
    params.preferredLanguage || 'English',
    now,
    now
  );

  return createSession(userId);
}

// Ownership / IDOR verification helpers
export function verifyFarmOwnership(farmId: string, user: User): boolean {
  if (user.role === 'ADMIN') return true;
  const db = getDb();
  const farm = db.prepare('SELECT user_id FROM farms WHERE id = ?').get(farmId) as { user_id: string } | undefined;
  return farm?.user_id === user.id;
}

export function verifyPlotOwnership(plotId: string, user: User): boolean {
  if (user.role === 'ADMIN') return true;
  const db = getDb();
  const plot = db.prepare('SELECT user_id FROM plots WHERE id = ?').get(plotId) as { user_id: string } | undefined;
  return plot?.user_id === user.id;
}

export function verifyObservationAccess(observationId: string, user: User): boolean {
  if (user.role === 'ADMIN') return true;
  // Institutional users can ONLY view aggregated intelligence, not individual farmer observations
  if (user.role === 'INSTITUTIONAL') return false;

  const db = getDb();
  const obs = db.prepare('SELECT user_id, status FROM observations WHERE id = ?').get(observationId) as { user_id: string; status: string } | undefined;
  if (!obs) return false;

  if (user.role === 'FARMER') {
    return obs.user_id === user.id;
  }

  if (user.role === 'EXPERT') {
    // Agronomists can access cases queued for review, or assigned to them, or owned by them
    if (obs.status === 'NEEDS_REVIEW') return true;
    const hasReview = db.prepare('SELECT id FROM expert_reviews WHERE observation_id = ?').get(observationId);
    return Boolean(hasReview) || obs.user_id === user.id;
  }

  return false;
}

export function verifyCaseAccess(caseId: string, user: User): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'INSTITUTIONAL') return false;

  const db = getDb();
  const cropCase = db.prepare('SELECT user_id, status FROM cases WHERE id = ?').get(caseId) as { user_id: string; status: string } | undefined;
  if (!cropCase) return false;

  if (user.role === 'FARMER') {
    return cropCase.user_id === user.id;
  }

  if (user.role === 'EXPERT') {
    if (cropCase.status === 'NEEDS_REVIEW') return true;
    const hasReview = db.prepare('SELECT id FROM expert_reviews WHERE case_id = ?').get(caseId);
    return Boolean(hasReview) || cropCase.user_id === user.id;
  }

  return false;
}

export function verifyActionAccess(actionId: string, user: User): boolean {
  if (user.role === 'ADMIN') return true;
  const db = getDb();
  const action = db.prepare('SELECT user_id FROM action_items WHERE id = ?').get(actionId) as { user_id: string } | undefined;
  return action?.user_id === user.id;
}

export function verifyFollowUpAccess(followUpId: string, user: User): boolean {
  if (user.role === 'ADMIN') return true;
  const db = getDb();
  const followUp = db.prepare('SELECT user_id FROM follow_ups WHERE id = ?').get(followUpId) as { user_id: string } | undefined;
  if (!followUp) return false;
  if (user.role === 'FARMER') return followUp.user_id === user.id;
  if (user.role === 'EXPERT') return true;
  return false;
}

export function verifyReviewAccess(reviewId: string, user: User): boolean {
  if (user.role === 'ADMIN' || user.role === 'EXPERT') return true;
  const db = getDb();
  const review = db.prepare(`
    SELECT r.id, o.user_id as farmer_id 
    FROM expert_reviews r
    JOIN observations o ON r.observation_id = o.id
    WHERE r.id = ?
  `).get(reviewId) as { id: string; farmer_id: string } | undefined;
  return review?.farmer_id === user.id;
}

export function verifyNotificationAccess(notificationId: string, user: User): boolean {
  if (user.role === 'ADMIN') return true;
  const db = getDb();
  const notif = db.prepare('SELECT user_id FROM notifications WHERE id = ?').get(notificationId) as { user_id: string } | undefined;
  return notif?.user_id === user.id;
}

