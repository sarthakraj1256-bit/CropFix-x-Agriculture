/**
 * CropFix - Header & Navigation Bar
 * Professional Agricultural Technology Platform
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sprout, LogOut, User as UserIcon, Bell, ChevronDown, Check, Briefcase } from 'lucide-react';
import type { User, UserRole } from '../types/index.js';

interface NavbarProps {
  currentUser: User | null;
  activeRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unreadNotificationsCount?: number;
  onToggleNotifications?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeRole,
  onSelectRole,
  onOpenAuth,
  onLogout,
  activeTab,
  setActiveTab,
  unreadNotificationsCount = 0,
  onToggleNotifications,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleWorkspaces: { role: UserRole; label: string; workspaceName: string }[] = [
    { role: 'FARMER', label: 'Farmer', workspaceName: 'Crop Health Dashboard' },
    { role: 'EXPERT', label: 'Agronomist', workspaceName: 'Expert Review' },
    { role: 'INSTITUTIONAL', label: 'Institution', workspaceName: 'Crop Health Intelligence' },
    { role: 'ADMIN', label: 'Administrator', workspaceName: 'System Administration' },
  ];

  return (
    <header className="bg-[#1B3022] text-white border-b border-[#2D5A27] shadow-sm sticky top-0 z-30">
      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand Identity */}
          <div
            className="flex items-center space-x-3 cursor-pointer select-none"
            onClick={() => setActiveTab(currentUser?.role === 'ADMIN' ? 'admin-metrics' : currentUser?.role === 'EXPERT' ? 'expert-queue' : currentUser?.role === 'INSTITUTIONAL' ? 'institutional-analytics' : 'farms')}
          >
            <div className="w-9 h-9 bg-[#2E7D32] rounded-lg flex items-center justify-center text-white shadow-sm border border-emerald-400/30">
              <Sprout className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xl tracking-tight text-white font-sans">CROPFIX</span>
              </div>
              <p className="text-[11px] text-emerald-200/90 hidden sm:block font-medium">
                AI-Assisted Crop Health & Risk Intelligence
              </p>
            </div>
          </div>

          {/* User Account & Actions */}
          <div className="flex items-center space-x-3">
            {currentUser ? (
              <div className="flex items-center space-x-2 sm:space-x-3">
                {/* Notification Center Trigger */}
                <button
                  id="nav-notifications-btn"
                  onClick={onToggleNotifications}
                  className="relative p-2 text-emerald-200 hover:text-white hover:bg-[#2D5A27] rounded-lg transition-colors cursor-pointer"
                  title="Notifications & Alerts"
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotificationsCount > 0 && (
                    <span
                      id="badge-unread-notifications-count"
                      className="absolute top-1 right-1 bg-[#D32F2F] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#1B3022]"
                    >
                      {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {/* Account / Profile Dropdown Menu */}
                <div className="relative" ref={profileRef}>
                  <button
                    id="nav-user-menu-btn"
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center space-x-2.5 bg-[#142419] hover:bg-[#243f2c] border border-[#2D5A27] px-3 py-1.5 rounded-lg transition-colors cursor-pointer text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#2D5A27] flex items-center justify-center text-xs font-bold text-emerald-100 border border-emerald-500/30">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-xs font-semibold text-white leading-tight">{currentUser.name}</div>
                      <div className="text-[10px] text-emerald-300/80 leading-tight capitalize">
                        {currentUser.role.toLowerCase()}
                      </div>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-emerald-300 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu Box */}
                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 text-slate-800 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      {/* User Info Header */}
                      <div className="px-4 py-2.5 border-b border-slate-100">
                        <div className="font-bold text-sm text-[#1B3022]">{currentUser.name}</div>
                        <div className="text-xs text-slate-500">{currentUser.email}</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded w-fit">
                          <span>{currentUser.role}</span>
                          {currentUser.district && <span>• {currentUser.district}</span>}
                        </div>
                      </div>

                      {/* Workspace Selector (Account -> Switch Workspace) */}
                      <div className="px-3 py-2 border-b border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1 flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          <span>Switch Workspace</span>
                        </div>
                        <div className="space-y-0.5">
                          {roleWorkspaces.map((ws) => {
                            const isCurrent = currentUser.role === ws.role;
                            return (
                              <button
                                key={ws.role}
                                id={`role-switch-${ws.role.toLowerCase()}`}
                                onClick={() => {
                                  onSelectRole(ws.role);
                                  setIsProfileOpen(false);
                                }}
                                className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors ${
                                  isCurrent
                                    ? 'bg-emerald-50 text-emerald-800 font-semibold'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                              >
                                <span>{ws.workspaceName}</span>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Logout Action */}
                      <div className="px-2 pt-1">
                        <button
                          id="nav-logout-btn"
                          onClick={() => {
                            setIsProfileOpen(false);
                            onLogout();
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md font-medium flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                id="nav-login-btn"
                onClick={onOpenAuth}
                className="bg-[#2E7D32] hover:bg-[#256629] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Role Navigation Tabs */}
      {currentUser && (
        <div className="bg-[#142419] border-t border-[#2D5A27]/60 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex space-x-1 sm:space-x-2 overflow-x-auto py-1.5 scrollbar-none">
            {currentUser.role === 'FARMER' && (
              <>
                <button
                  id="tab-farmer-farms"
                  onClick={() => setActiveTab('farms')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'farms'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  My Farms
                </button>
                <button
                  id="tab-farmer-observations"
                  onClick={() => setActiveTab('observations')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'observations'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Observations
                </button>
                <button
                  id="tab-farmer-cases"
                  onClick={() => setActiveTab('cases')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'cases'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Crop Health Cases
                </button>
                <button
                  id="tab-farmer-actions"
                  onClick={() => setActiveTab('actions')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'actions'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Tasks
                </button>
                <button
                  id="tab-farmer-followups"
                  onClick={() => setActiveTab('followups')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'followups'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Follow-ups
                </button>
              </>
            )}

            {currentUser.role === 'EXPERT' && (
              <>
                <button
                  id="tab-expert-queue"
                  onClick={() => setActiveTab('expert-queue')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'expert-queue'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Review Queue
                </button>
                <button
                  id="tab-expert-history"
                  onClick={() => setActiveTab('observations')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'observations'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Field Cases
                </button>
                <button
                  id="tab-expert-cases"
                  onClick={() => setActiveTab('cases')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'cases'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Case Timelines
                </button>
                <button
                  id="tab-expert-surveillance"
                  onClick={() => setActiveTab('institutional-analytics')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'institutional-analytics'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Surveillance Map
                </button>
              </>
            )}

            {currentUser.role === 'INSTITUTIONAL' && (
              <>
                <button
                  id="tab-institutional-analytics"
                  onClick={() => setActiveTab('institutional-analytics')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'institutional-analytics'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Crop Health Intelligence
                </button>
              </>
            )}

            {currentUser.role === 'ADMIN' && (
              <>
                <button
                  id="tab-admin-metrics"
                  onClick={() => setActiveTab('admin-metrics')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'admin-metrics'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Administration
                </button>
                <button
                  id="tab-admin-expert-queue"
                  onClick={() => setActiveTab('expert-queue')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'expert-queue'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Review Queue
                </button>
                <button
                  id="tab-admin-surveillance"
                  onClick={() => setActiveTab('institutional-analytics')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'institutional-analytics'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Surveillance
                </button>
                <button
                  id="tab-admin-farms"
                  onClick={() => setActiveTab('farms')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'farms'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Farms & Plots
                </button>
                <button
                  id="tab-admin-observations"
                  onClick={() => setActiveTab('observations')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'observations'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Observations
                </button>
                <button
                  id="tab-admin-cases"
                  onClick={() => setActiveTab('cases')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'cases'
                      ? 'bg-[#2D5A27] text-white shadow-xs'
                      : 'text-[#A5D6A7] hover:text-white hover:bg-[#1B3022]'
                  }`}
                >
                  Cases
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
