/**
 * CropFix - Add Farm Modal (Phase 3)
 * SIH26131: Early detection and management of crop diseases and pest infestations
 */

import React, { useState } from 'react';
import { X, Building2, MapPin, Layers, Droplets, Check } from 'lucide-react';
import type { Farm } from '../types/index.js';

interface FarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFarmCreated: (farm: Farm) => void;
}

export const FarmModal: React.FC<FarmModalProps> = ({ isOpen, onClose, onFarmCreated }) => {
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('Pune');
  const [state, setState] = useState('Maharashtra');
  const [totalArea, setTotalArea] = useState('5.5');
  const [areaUnit, setAreaUnit] = useState<'acres' | 'hectares' | 'bighas'>('acres');
  const [soilType, setSoilType] = useState('Black Cotton Soil');
  const [irrigationType, setIrrigationType] = useState('Drip Irrigation');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/farms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          district,
          state,
          totalArea: Number(totalArea),
          areaUnit,
          soilType,
          irrigationType,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create farm');
      }

      onFarmCreated(data.data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating farm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-[#E0E0E0]">
        <div className="bg-[#1B3022] px-6 py-4 text-white flex items-center justify-between border-b-4 border-[#2D5A27]">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-[#4CAF50]" />
            <h3 className="font-bold text-base tracking-tight">Register New Farm</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-[#2D5A27] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Farm Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kisan Seva Organic Farm"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                District *
              </label>
              <input
                type="text"
                required
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                State *
              </label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total Land Area *
              </label>
              <input
                type="number"
                step="0.1"
                required
                min="0.1"
                value={totalArea}
                onChange={(e) => setTotalArea(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit *
              </label>
              <select
                value={areaUnit}
                onChange={(e) => setAreaUnit(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="acres">Acres</option>
                <option value="hectares">Hectares</option>
                <option value="bighas">Bighas</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Soil Type
              </label>
              <select
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="Black Cotton Soil">Black Cotton Soil</option>
                <option value="Alluvial Soil">Alluvial Soil</option>
                <option value="Red Loam">Red Loam</option>
                <option value="Sandy Loam">Sandy Loam</option>
                <option value="Clayey Soil">Clayey Soil</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Irrigation
              </label>
              <select
                value={irrigationType}
                onChange={(e) => setIrrigationType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="Drip Irrigation">Drip Irrigation</option>
                <option value="Sprinkler">Sprinkler</option>
                <option value="Canal Irrigation">Canal Irrigation</option>
                <option value="Borewell / Tube well">Borewell / Tube well</option>
                <option value="Rainfed">Rainfed</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#1B3022] hover:bg-[#2D5A27] text-white rounded-lg transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              <Check className="w-4 h-4 text-[#4CAF50]" />
              {loading ? 'Creating...' : 'Save Farm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
