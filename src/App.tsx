/**
 * CropFix - AI-Assisted Crop Health Decision Support Platform
 * Smart India Hackathon: SIH26131
 * Early detection and management of crop diseases and pest infestations
 */

import React, { useState, useEffect } from 'react';
import type { User, UserRole, Observation, AuthSession } from './types/index.js';
import { Navbar } from './components/Navbar.js';
import { AuthModal } from './components/AuthModal.js';
import { FarmerDashboard } from './components/FarmerDashboard.js';
import { ExpertDashboard } from './components/ExpertDashboard.js';
import { InstitutionalDashboard } from './components/InstitutionalDashboard.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { NotificationCenter } from './components/NotificationCenter.js';
import { AssessmentView } from './components/AssessmentView.js';
import { CaseDetailView } from './components/CaseDetailView.js';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string>(() => localStorage.getItem('cropfix_token') || '');
  const [activeTab, setActiveTab] = useState<string>('farms');
  const [selectedObservation, setSelectedObservation] = useState<Observation | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Initialize session on mount
  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (sessionToken && currentUser) {
      fetchUnreadNotificationsCount();
    }
  }, [sessionToken, currentUser]);

  const fetchUnreadNotificationsCount = async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch('/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUnreadNotificationsCount(data.data.unreadCount || 0);
        }
      }
    } catch {
      // Benign fallback
    }
  };

  const initAuth = async () => {
    try {
      const headers = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined;
      const res = await fetch('/api/auth/me', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setCurrentUser(data.data);
          if (data.data.role === 'ADMIN') setActiveTab('admin-metrics');
          else if (data.data.role === 'EXPERT') setActiveTab('expert-queue');
          else if (data.data.role === 'INSTITUTIONAL') setActiveTab('institutional-analytics');
          else setActiveTab('farms');
          setLoading(false);
          return;
        }
      }

      // Default to demo farmer on first load so preview is instantly active
      const demoRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'farmer@cropfix.org', password: 'Farmer@123' }),
      });
      if (demoRes.ok) {
        const demoData = await demoRes.json();
        if (demoData.success && demoData.data?.user) {
          setCurrentUser(demoData.data.user);
          if (demoData.data.token) {
            setSessionToken(demoData.data.token);
            localStorage.setItem('cropfix_token', demoData.data.token);
          }
          setActiveTab('farms');
        }
      }
    } catch (err) {
      console.warn('Initial session initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSwitch = async (targetRole: UserRole) => {
    const roleCredentials: Record<UserRole, { email: string; pass: string }> = {
      FARMER: { email: 'farmer@cropfix.org', pass: 'Farmer@123' },
      EXPERT: { email: 'expert@cropfix.org', pass: 'Expert@123' },
      INSTITUTIONAL: { email: 'institutional@cropfix.org', pass: 'Official@123' },
      ADMIN: { email: 'admin@cropfix.org', pass: 'Admin@123' },
    };

    const creds = roleCredentials[targetRole];
    if (!creds) return;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: creds.email, password: creds.pass }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setCurrentUser(data.data.user);
        if (data.data.token) {
          setSessionToken(data.data.token);
          localStorage.setItem('cropfix_token', data.data.token);
        }
        setSelectedObservation(null);
        setSelectedCaseId(null);
        if (targetRole === 'ADMIN') setActiveTab('admin-metrics');
        else if (targetRole === 'EXPERT') setActiveTab('expert-queue');
        else if (targetRole === 'INSTITUTIONAL') setActiveTab('institutional-analytics');
        else setActiveTab('farms');
      }
    } catch (err) {
      console.error('Role switch failed:', err);
    }
  };

  const handleLogout = async () => {
    try {
      const headers = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined;
      await fetch('/api/auth/logout', { method: 'POST', headers });
    } catch (err) {
      console.warn('Logout failed:', err);
    }
    setCurrentUser(null);
    setSessionToken('');
    localStorage.removeItem('cropfix_token');
    setSelectedObservation(null);
    setSelectedCaseId(null);
    setIsAuthOpen(true);
  };

  const handleAuthSuccess = (session: AuthSession) => {
    setCurrentUser(session.user);
    if (session.token) {
      setSessionToken(session.token);
      localStorage.setItem('cropfix_token', session.token);
    }
    setSelectedObservation(null);
    setSelectedCaseId(null);
    if (session.user.role === 'ADMIN') setActiveTab('admin-metrics');
    else if (session.user.role === 'EXPERT') setActiveTab('expert-queue');
    else if (session.user.role === 'INSTITUTIONAL') setActiveTab('institutional-analytics');
    else setActiveTab('farms');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-600">Initializing CropFix Decision Support Platform...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] flex flex-col font-sans">
      {/* Global Application Shell Header */}
      <Navbar
        currentUser={currentUser}
        activeRole={currentUser?.role || 'FARMER'}
        onSelectRole={handleRoleSwitch}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadNotificationsCount={unreadNotificationsCount}
        onToggleNotifications={() => setIsNotificationCenterOpen(prev => !prev)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-8">
        {selectedObservation ? (
          <AssessmentView
            observation={selectedObservation}
            currentUser={currentUser || undefined}
            token={sessionToken}
            onBack={() => setSelectedObservation(null)}
            onViewCase={(caseId) => setSelectedCaseId(caseId)}
            onRefreshObservation={async () => {
              const headers = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined;
              const res = await fetch(`/api/observations/${selectedObservation.id}`, { headers });
              const data = await res.json();
              if (data.success) setSelectedObservation(data.data);
            }}
          />
        ) : selectedCaseId ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            <CaseDetailView
              caseId={selectedCaseId}
              token={sessionToken}
              onBack={() => setSelectedCaseId(null)}
              onSelectObservation={async (obsId) => {
                const headers = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined;
                const res = await fetch(`/api/observations/${obsId}`, { headers });
                const data = await res.json();
                if (data.success) {
                  setSelectedCaseId(null);
                  setSelectedObservation(data.data);
                }
              }}
            />
          </div>
        ) : activeTab === 'admin-metrics' && currentUser ? (
          <AdminDashboard
            currentUser={currentUser}
            token={sessionToken}
          />
        ) : activeTab === 'expert-queue' && currentUser ? (
          <ExpertDashboard
            currentUser={currentUser}
            token={sessionToken}
            onSelectObservation={(obs) => setSelectedObservation(obs)}
          />
        ) : activeTab === 'institutional-analytics' && currentUser ? (
          <InstitutionalDashboard
            currentUser={currentUser}
            token={sessionToken}
          />
        ) : currentUser ? (
          <FarmerDashboard
            currentUser={currentUser}
            activeTab={activeTab}
            token={sessionToken}
            onSelectObservation={(obs) => setSelectedObservation(obs)}
            onSelectCase={(caseId) => setSelectedCaseId(caseId)}
          />
        ) : (
          <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-xl border border-[#E0E0E0] shadow-sm text-center">
            <h2 className="text-base font-bold text-[#1B3022] mb-2">Welcome to CropFix</h2>
            <p className="text-xs text-[#666] mb-6">
              SIH26131: Early detection and management of crop diseases and pest infestations. Please sign in to access your farm decision desk.
            </p>
            <button
              onClick={() => setIsAuthOpen(true)}
              className="w-full bg-[#1B3022] hover:bg-[#2D5A27] text-white font-bold text-xs uppercase tracking-wider py-2.5 px-4 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              Sign In to CropFix
            </button>
          </div>
        )}
      </main>

      {/* BENTO GRID SYSTEM FOOTER */}
      <footer className="bg-[#F8F9FA] border-t border-[#E0E0E0] px-6 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-mono text-[#888]">
          <div className="flex items-center gap-4">
            <span>PLATFORM: CROPFIX_v1.0.8</span>
            <span>NODE_STATUS: STABLE</span>
            <span>ENCRYPTION: AES-256</span>
            <span className="hidden md:inline">JURISDICTION: MH-PUNE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#444] uppercase tracking-wider">
              Institutional Access Protected
            </span>
            <div className="w-2 h-2 bg-[#4CAF50] rounded-full animate-pulse"></div>
          </div>
        </div>
      </footer>

      {/* Notification Center Slide-Over Drawer */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        token={sessionToken}
        onClose={() => setIsNotificationCenterOpen(false)}
        onNotificationRead={fetchUnreadNotificationsCount}
        onSelectNotification={async (notif) => {
          setIsNotificationCenterOpen(false);
          if (notif.related_entity_type === 'observation' && notif.related_entity_id) {
            try {
              const headers = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined;
              const res = await fetch(`/api/observations/${notif.related_entity_id}`, { headers });
              const data = await res.json();
              if (data.success && data.data) {
                setSelectedObservation(data.data);
              }
            } catch {
              // Benign
            }
          } else if (notif.related_entity_type === 'case' && notif.related_entity_id) {
            setSelectedCaseId(notif.related_entity_id);
          }
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
