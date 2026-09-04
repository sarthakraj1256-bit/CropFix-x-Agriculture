/**
 * CropFix - In-App Notification Center
 * SIH26131: Early detection and management of crop diseases and pest infestations
 * Phase 12 Implementation
 */

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Calendar, 
  X, 
  ExternalLink 
} from 'lucide-react';
import type { AppNotification } from '../types/index.js';

interface NotificationCenterProps {
  token?: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToEntity?: (type: string, id: string) => void;
  onNotificationsUpdated?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  token = '',
  isOpen,
  onClose,
  onNavigateToEntity,
  onNotificationsUpdated,
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterUnread, setFilterUnread] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, filterUnread]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?unread=${filterUnread}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        if (onNotificationsUpdated) onNotificationsUpdated();
      }
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        if (onNotificationsUpdated) onNotificationsUpdated();
      }
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div 
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-[#E0E0E0]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#1B3022] text-white flex items-center justify-between border-b border-[#2D5A27]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#2D5A27] rounded-lg">
              <Bell className="w-4 h-4 text-[#A5D6A7]" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Notification Center</h2>
              <p className="text-[11px] text-emerald-200/80">Field alerts, reminders & agronomic updates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-200 hover:text-white rounded-lg hover:bg-[#2D5A27] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter / Actions Bar */}
        <div className="p-3 bg-[#F8F9FA] border-b border-[#E0E0E0] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterUnread(false)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                !filterUnread
                  ? 'bg-white text-[#1B3022] font-bold shadow-xs border border-[#E0E0E0]'
                  : 'text-[#666] hover:text-[#1B3022]'
              }`}
            >
              All Alerts
            </button>
            <button
              onClick={() => setFilterUnread(true)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                filterUnread
                  ? 'bg-white text-[#1B3022] font-bold shadow-xs border border-[#E0E0E0]'
                  : 'text-[#666] hover:text-[#1B3022]'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#F27D26] text-white text-[10px] font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[#2D5A27] hover:text-[#1B3022] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F0F0F0]">
          {loading && (
            <div className="p-8 text-center text-xs text-[#888]">
              Loading alerts...
            </div>
          )}

          {!loading && notifications.length === 0 && (
            <div className="p-12 text-center text-xs text-[#888] space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#4CAF50] mx-auto opacity-70" />
              <div className="font-semibold text-slate-700">No notifications</div>
              <p className="text-[11px] text-[#888]">
                {filterUnread ? 'You have caught up on all unread notifications.' : 'No alerts have been posted yet.'}
              </p>
            </div>
          )}

          {!loading &&
            notifications.map((n) => {
              const isUnread = !n.isRead;
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (isUnread) handleMarkAsRead(n.id);
                    if (onNavigateToEntity && n.relatedEntityType && n.relatedEntityId) {
                      onNavigateToEntity(n.relatedEntityType, n.relatedEntityId);
                      onClose();
                    }
                  }}
                  className={`p-4 transition-colors cursor-pointer flex items-start gap-3 ${
                    isUnread ? 'bg-[#F1F8E9]/40 hover:bg-[#F1F8E9]/70' : 'hover:bg-[#F8F9FA]'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {n.priority === 'URGENT' || n.priority === 'HIGH' ? (
                      <div className="p-1.5 bg-red-100 text-red-700 rounded-lg">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    ) : n.type.includes('EXPERT') ? (
                      <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="p-1.5 bg-[#E8F5E9] text-[#2E7D32] rounded-lg">
                        <Clock className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-xs truncate ${isUnread ? 'font-bold text-[#1B3022]' : 'font-medium text-slate-700'}`}>
                        {n.title}
                      </h3>
                      <span className="text-[10px] text-[#888] shrink-0">
                        {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <p className="text-xs text-[#555] mt-1 leading-relaxed">
                      {n.message}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#F0F0F0]/60">
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        n.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                        n.priority === 'HIGH' ? 'bg-[#FFF3E0] text-[#F27D26]' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {n.priority}
                      </span>

                      {isUnread && (
                        <button
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          className="text-[11px] text-[#2D5A27] font-semibold hover:underline cursor-pointer"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
