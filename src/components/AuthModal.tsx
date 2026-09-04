/**
 * CropFix - Authentication & Account Management
 * Professional Agricultural Technology Platform
 */

import React, { useState } from 'react';
import { X, Lock, Mail, User, ArrowRight, AlertCircle, Sprout } from 'lucide-react';
import type { UserRole, AuthSession } from '../types/index.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (session: AuthSession) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('FARMER');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister
        ? { email, password, name, role, phone, district, state, preferredLanguage }
        : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed. Please check your credentials.');
      }

      onAuthSuccess(data.data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="bg-[#1B3022] px-6 py-5 text-white flex items-center justify-between border-b-4 border-[#2D5A27]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#2E7D32] flex items-center justify-center text-white border border-emerald-400/30">
              <Sprout className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">
                {isRegister ? 'Create CropFix Account' : 'Sign In to CropFix'}
              </h3>
              <p className="text-xs text-emerald-200/90 font-medium">
                Access your crop health workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-[#2D5A27] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('FARMER')}
                    className={`p-2 text-xs rounded-lg border font-medium text-center transition-colors cursor-pointer ${
                      role === 'FARMER'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Farmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('EXPERT')}
                    className={`p-2 text-xs rounded-lg border font-medium text-center transition-colors cursor-pointer ${
                      role === 'EXPERT'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Agronomist
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('INSTITUTIONAL')}
                    className={`p-2 text-xs rounded-lg border font-medium text-center transition-colors cursor-pointer ${
                      role === 'INSTITUTIONAL'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Institution
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    District
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Nashik"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Maharashtra"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            {isRegister && (
              <p className="text-[11px] text-slate-500 mt-1">Minimum 6 characters</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1B3022] hover:bg-[#2D5A27] text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-60"
          >
            {loading ? 'Processing...' : isRegister ? 'Register Account' : 'Sign In'}
            <ArrowRight className="w-4 h-4 text-emerald-400" />
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-medium cursor-pointer"
            >
              {isRegister
                ? 'Already have an account? Sign In'
                : "Don't have an account yet? Register here"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
