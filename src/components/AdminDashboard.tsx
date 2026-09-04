/**
 * CropFix - System Administration & Audit Telemetry (Bento Grid Theme)
 * SIH26131: Early detection and management of crop diseases and pest infestations
 * Phase 13-15 Implementation
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  Server, 
  Database, 
  Activity, 
  Clock, 
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  Lock
} from 'lucide-react';
import type { User } from '../types/index.js';

interface AdminMetrics {
  usersByRole: Record<string, number>;
  activeSessionsCount: number;
  totalObservations: number;
  totalCases: number;
  totalReviews: number;
  pendingReviewsCount: number;
  totalAuditLogs: number;
  recentAudits: {
    id: string;
    action: string;
    resource_type: string;
    resource_id: string;
    created_at: string;
    user_name?: string;
    user_role?: string;
  }[];
  systemStatus: string;
  databaseEngine: string;
  nodeVersion: string;
  uptimeSeconds: number;
}

interface AdminDashboardProps {
  currentUser: User;
  token?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  token = '',
}) => {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/metrics', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (err) {
      console.error('Failed to load admin metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Top Banner */}
      <div className="bg-[#1B3022] rounded-xl p-6 text-white shadow-sm border-b-4 border-[#2D5A27] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">CropFix Operational Telemetry</h1>
            <span className="bg-[#2D5A27] text-white font-mono text-[10px] px-2 py-0.5 rounded border border-[#4CAF50]/30 font-bold uppercase">
              ADMINISTRATOR: {currentUser.name.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-emerald-200/90 mt-1 max-w-xl">
            SIH26131 Core Infrastructure Console: Database runtime integrity, RBAC security verification, and tamper-evident audit logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="bg-[#142419] hover:bg-[#2D5A27] text-white px-3.5 py-2 rounded-lg border border-[#2D5A27] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#4CAF50] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh State</span>
          </button>
        </div>
      </div>

      {loading && !metrics && (
        <div className="p-16 text-center text-xs text-[#888]">
          Connecting to system telemetry...
        </div>
      )}

      {metrics && (
        <>
          {/* System Status Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs border-l-4 border-l-[#4CAF50]">
              <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">System State</span>
              <div className="text-xl font-bold font-mono text-[#2E7D32] mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#4CAF50]" />
                <span>{metrics.systemStatus}</span>
              </div>
              <div className="text-[11px] text-[#888] mt-0.5 font-mono">Uptime: {metrics.uptimeSeconds}s</div>
            </div>

            <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Database Engine</span>
              <div className="text-sm font-bold font-mono text-[#1B3022] mt-2 truncate">
                {metrics.databaseEngine}
              </div>
              <div className="text-[11px] text-[#888] mt-0.5 font-mono">Node: {metrics.nodeVersion}</div>
            </div>

            <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs border-l-4 border-l-[#F27D26]">
              <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Review Queue</span>
              <div className="text-2xl font-bold font-mono text-[#F27D26] mt-2">
                {metrics.pendingReviewsCount}
              </div>
              <div className="text-[11px] text-[#888] mt-0.5">Pending agronomist action</div>
            </div>

            <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Active Sessions</span>
              <div className="text-2xl font-bold font-mono text-[#1B3022] mt-2">
                {metrics.activeSessionsCount}
              </div>
              <div className="text-[11px] text-[#888] mt-0.5">Authenticated tokens</div>
            </div>
          </div>

          {/* User Roles & Database Entity Totals Bento */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* RBAC Breakdown (6 cols) */}
            <div className="md:col-span-6 bg-white rounded-xl shadow-xs border border-[#E0E0E0] p-5">
              <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-3 mb-3">
                <h2 className="text-xs font-bold text-[#1B3022] uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#4CAF50]" />
                  Active Users by Persona Role (RBAC Enforced)
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { role: 'FARMER', label: 'Producers / Farmers', count: metrics.usersByRole.FARMER || 0, color: 'text-[#2E7D32] bg-[#E8F5E9] border-[#C5E1A5]' },
                  { role: 'EXPERT', label: 'Agronomists / KVK', count: metrics.usersByRole.EXPERT || 0, color: 'text-purple-700 bg-purple-50 border-purple-200' },
                  { role: 'INSTITUTIONAL', label: 'Govt Agriculture Dept', count: metrics.usersByRole.INSTITUTIONAL || 0, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                  { role: 'ADMIN', label: 'System Admins', count: metrics.usersByRole.ADMIN || 0, color: 'text-stone-700 bg-stone-100 border-stone-200' },
                ].map((item) => (
                  <div key={item.role} className={`p-3 rounded-xl border ${item.color} flex flex-col justify-between`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                    <span className="text-2xl font-bold font-mono mt-2">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Core Entity Totals (6 cols) */}
            <div className="md:col-span-6 bg-white rounded-xl shadow-xs border border-[#E0E0E0] p-5">
              <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-3 mb-3">
                <h2 className="text-xs font-bold text-[#1B3022] uppercase tracking-widest flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-[#2E7D32]" />
                  Persistent Relational Records
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                  <span className="text-[10px] font-bold text-[#666] uppercase">Observations</span>
                  <div className="text-xl font-bold font-mono text-[#1B3022] mt-1">{metrics.totalObservations}</div>
                </div>
                <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                  <span className="text-[10px] font-bold text-[#666] uppercase">Cases</span>
                  <div className="text-xl font-bold font-mono text-[#1B3022] mt-1">{metrics.totalCases}</div>
                </div>
                <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                  <span className="text-[10px] font-bold text-[#666] uppercase">Expert Reviews</span>
                  <div className="text-xl font-bold font-mono text-[#1B3022] mt-1">{metrics.totalReviews}</div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-[#F1F8E9] rounded-xl border border-[#C5E1A5] text-xs flex items-center justify-between">
                <span className="text-[#2E7D32] font-semibold">Total Audit Log Entries:</span>
                <span className="font-mono font-bold text-[#1B3022]">{metrics.totalAuditLogs} events recorded</span>
              </div>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white rounded-xl shadow-xs border border-[#E0E0E0] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#F0F0F0] flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-[#1B3022] uppercase tracking-widest flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-[#4CAF50]" />
                  Tamper-Evident System Audit Trail (Recent Activity)
                </h2>
                <p className="text-xs text-[#888] mt-0.5">
                  Chronological record of privileged security events, diagnostic assessments, and human validations
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] border-b border-[#E0E0E0] text-[10px] font-bold text-[#666] uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">User & Role</th>
                    <th className="p-3">Resource Type</th>
                    <th className="p-3">Resource ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {metrics.recentAudits.map((a) => (
                    <tr key={a.id} className="hover:bg-[#F8F9FA]">
                      <td className="p-3 font-mono text-[11px] text-[#777] whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                      </td>
                      <td className="p-3 font-mono font-bold text-[#1B3022]">
                        {a.action}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-800">{a.user_name || 'System'}</span>
                        {a.user_role && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-600 uppercase">
                            {a.user_role}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-[#666] capitalize">
                        {a.resource_type}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-[#888] truncate max-w-[150px]">
                        {a.resource_id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
