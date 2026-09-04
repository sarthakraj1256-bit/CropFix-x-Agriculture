/**
 * CropFix - Notification & Alert Engine
 * SIH26131: Early detection and management of crop diseases and pest infestations
 * Phase 12 Implementation
 */

import crypto from 'node:crypto';
import { getDb } from './db.js';
import type { AppNotification, NotificationType, NotificationPriority } from '../types/index.js';

interface DbNotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: number;
  created_at: string;
  read_at: string | null;
}

function mapRowToNotification(row: DbNotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as NotificationType,
    title: row.title,
    message: row.message,
    priority: row.priority as NotificationPriority,
    relatedEntityType: (row.related_entity_type as any) || undefined,
    relatedEntityId: row.related_entity_id || undefined,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    readAt: row.read_at || undefined,
  };
}

export class NotificationService {
  /**
   * Creates a notification with automatic duplicate suppression for unread alerts.
   */
  static createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    relatedEntityType?: 'case' | 'observation' | 'action' | 'follow_up' | 'review';
    relatedEntityId?: string;
  }): AppNotification | null {
    const db = getDb();

    // Duplicate prevention: If an unread notification with the same type and entity exists for this user, avoid spam
    if (params.relatedEntityId) {
      const existing = db.prepare(`
        SELECT id FROM notifications 
        WHERE user_id = ? AND type = ? AND related_entity_id = ? AND is_read = 0
      `).get(params.userId, params.type, params.relatedEntityId);

      if (existing) {
        return null;
      }
    }

    const id = `notif-${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const priority = params.priority || 'NORMAL';

    db.prepare(`
      INSERT INTO notifications (
        id, user_id, type, title, message, priority,
        related_entity_type, related_entity_id, is_read, created_at, read_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL)
    `).run(
      id,
      params.userId,
      params.type,
      params.title.trim(),
      params.message.trim(),
      priority,
      params.relatedEntityType || null,
      params.relatedEntityId || null,
      now
    );

    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as unknown as DbNotificationRow;
    return mapRowToNotification(row);
  }

  /**
   * Retrieves notifications for a given user with total and unread counts.
   */
  static getUserNotifications(userId: string, unreadOnly: boolean = false): { notifications: AppNotification[]; unreadCount: number } {
    const db = getDb();
    
    // Automatically trigger fresh reminder checks for follow-ups and actions
    try {
      this.checkAndGenerateReminders(userId);
    } catch (err) {
      console.warn('Reminder generation check non-fatal notice:', err);
    }

    const countRow = db.prepare(`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
    `).get(userId) as { count: number };
    const unreadCount = countRow?.count || 0;

    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const queryParams: any[] = [userId];

    if (unreadOnly) {
      query += ' AND is_read = 0';
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const rows = db.prepare(query).all(...queryParams) as unknown as DbNotificationRow[];
    return {
      notifications: rows.map(mapRowToNotification),
      unreadCount,
    };
  }

  /**
   * Marks a single notification as read, ensuring strict user ownership (IDOR defense).
   */
  static markAsRead(notificationId: string, userId: string): AppNotification | null {
    const db = getDb();
    const existing = db.prepare('SELECT user_id FROM notifications WHERE id = ?').get(notificationId) as { user_id: string } | undefined;
    
    if (!existing || existing.user_id !== userId) {
      return null;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ?').run(now, notificationId);

    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId) as unknown as DbNotificationRow;
    return mapRowToNotification(row);
  }

  /**
   * Marks all notifications for a user as read.
   */
  static markAllAsRead(userId: string): number {
    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare('UPDATE notifications SET is_read = 1, read_at = ? WHERE user_id = ? AND is_read = 0').run(now, userId);
    return Number(result.changes);
  }

  /**
   * Scans due/overdue follow-ups and pending actions to generate reminders.
   */
  static checkAndGenerateReminders(targetUserId?: string): void {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);

    // 1. Follow-ups scheduled on or before today
    let followUpQuery = `
      SELECT f.id, f.user_id, f.observation_id, f.case_id, f.scheduled_date, o.crop_name 
      FROM follow_ups f
      JOIN observations o ON f.observation_id = o.id
      WHERE f.status = 'SCHEDULED' AND f.scheduled_date <= ?
    `;
    const followUpParams: any[] = [today];
    if (targetUserId) {
      followUpQuery += ' AND f.user_id = ?';
      followUpParams.push(targetUserId);
    }

    const dueFollowUps = db.prepare(followUpQuery).all(...followUpParams) as any[];
    for (const fu of dueFollowUps) {
      const isPast = fu.scheduled_date < today;
      this.createNotification({
        userId: fu.user_id,
        type: isPast ? 'FOLLOWUP_OVERDUE' : 'FOLLOWUP_DUE',
        title: isPast ? `Overdue Follow-up: ${fu.crop_name}` : `Follow-up Due: ${fu.crop_name}`,
        message: `Field inspection was scheduled for ${fu.scheduled_date}. Verify whether symptoms stabilized.`,
        priority: isPast ? 'HIGH' : 'NORMAL',
        relatedEntityType: 'follow_up',
        relatedEntityId: fu.id,
      });
    }

    // 2. Action items due on or before today
    let actionQuery = `
      SELECT a.id, a.user_id, a.title, a.due_date, a.priority, a.case_id
      FROM action_items a
      WHERE a.status = 'PENDING' AND a.due_date IS NOT NULL AND a.due_date <= ?
    `;
    const actionParams: any[] = [today];
    if (targetUserId) {
      actionQuery += ' AND a.user_id = ?';
      actionParams.push(targetUserId);
    }

    const dueActions = db.prepare(actionQuery).all(...actionParams) as any[];
    for (const act of dueActions) {
      const isPast = act.due_date < today;
      this.createNotification({
        userId: act.user_id,
        type: isPast ? 'ACTION_OVERDUE' : 'ACTION_DUE',
        title: isPast ? `Task Overdue: ${act.title}` : `Task Due Today: ${act.title}`,
        message: `Agronomic action item "${act.title}" is ${isPast ? 'past due' : 'due today'}.`,
        priority: isPast ? 'HIGH' : 'NORMAL',
        relatedEntityType: 'action',
        relatedEntityId: act.id,
      });
    }
  }
}
