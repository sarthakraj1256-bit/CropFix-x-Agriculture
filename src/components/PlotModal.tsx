/**
 * CropFix - Add Plot & Crop Context Modal (Phase 3)
 * SIH26131: Early detection and management of crop diseases and pest infestations
 */

import React, { useState } from 'react';
import { X, Sprout, Check, Calendar, Layers } from 'lucide-react';
import type { Farm, Plot, CropStage, CropSeason } from '../types/index.js';

interface PlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  farms: Farm[];
  selectedFarmId?: string;
  onPlotCreated: (plot: Plot) => void;
}

export const PlotModal: React.FC<PlotModalProps> = ({
  isOpen,
  onClose,
  farms,
  selectedFarmId,
  onPlotCreated,
}) => {
  const [farmId, setFarmId] = useState(selectedFarmId || (farms[0]?.id ?? ''));
  const [name, setName] = useState('');
  const [area, setArea] = useState('2.0');
  const [areaUnit, setAreaUnit] = useState<'acres' | 'hectares' | 'bighas'>('acres');
  const [cropName, setCropName] = useState('Tomato');
  const [variety, setVariety] = useState('Abhinav F1 Hybrid');
  const [cropStage, setCropStage] = useState<CropStage>('Flowering');
  const [season, setSeason] = useState<CropSeason>('Kharif');
  const [plantingDate, setPlantingDate] = useState('2026-06-15');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) {
      setError('Please select a farm');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/farms/${farmId}/plots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          area: Number(area),
          areaUnit,
          cropName,
          variety,
          cropStage,
          season,
          plantingDate,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create plot');
      }

      onPlotCreated(data.data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating plot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-[#E0E0E0]">
        <div className="bg-[#1B3022] px-6 py-4 text-white flex items-center justify-between border-b-4 border-[#2D5A27]">
          <div className="flex items-center space-x-2">
            <Sprout className="w-5 h-5 text-[#4CAF50]" />
            <h3 className="font-bold text-base tracking-tight">Add Plot & Crop Context</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-[#2D5A27] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Farm *
            </label>
            <select
              value={farmId}
              onChange={(e) => setFarmId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.district}, {f.state})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Plot Name / Identifier *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. North Plot - Tomato Section"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Crop Type *
              </label>
              <select
                value={cropName}
                onChange={(e) => setCropName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="Tomato">Tomato (Solanum lycopersicum)</option>
                <option value="Chilli">Chilli / Pepper (Capsicum)</option>
                <option value="Cotton">Cotton (Gossypium hirsutum)</option>
                <option value="Rice / Paddy">Rice / Paddy (Oryza sativa)</option>
                <option value="Wheat">Wheat (Triticum aestivum)</option>
                <option value="Maize">Maize / Corn (Zea mays)</option>
                <option value="Potato">Potato (Solanum tuberosum)</option>
                <option value="Brinjal">Brinjal / Eggplant</option>
                <option value="Soybean">Soybean (Glycine max)</option>
                <option value="Sugarcane">Sugarcane</option>
                <option value="Onion">Onion</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Variety / Hybrid
              </label>
              <input
                type="text"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder="e.g. Abhinav F1"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Plot Area *
              </label>
              <input
                type="number"
                step="0.1"
                required
                min="0.1"
                value={area}
                onChange={(e) => setArea(e.target.value)}
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
                Current Growth Stage *
              </label>
              <select
                value={cropStage}
                onChange={(e) => setCropStage(e.target.value as CropStage)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="Germination / Seedling">Germination / Seedling</option>
                <option value="Vegetative">Vegetative</option>
                <option value="Flowering">Flowering</option>
                <option value="Fruit / Grain Formation">Fruit / Grain Formation</option>
                <option value="Maturation / Harvest">Maturation / Harvest</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cropping Season *
              </label>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value as CropSeason)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="Kharif">Kharif (Monsoon)</option>
                <option value="Rabi">Rabi (Winter)</option>
                <option value="Zaid / Summer">Zaid / Summer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sowing / Transplanting Date
            </label>
            <input
              type="date"
              value={plantingDate}
              onChange={(e) => setPlantingDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Plot Notes / Past History
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Previous crop was chickpea. Treated with neem cake at bed preparation."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
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
              {loading ? 'Creating...' : 'Save Plot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
