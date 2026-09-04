/**
 * CropFix - Observation Recording & Image Capture Modal (Phase 4)
 * SIH26131: Early detection and management of crop diseases and pest infestations
 */

import React, { useState } from 'react';
import { X, Camera, Upload, AlertTriangle, Check, Image as ImageIcon, Sparkles } from 'lucide-react';
import type { Farm, Plot, PlantPart, SeverityEstimate, Observation } from '../types/index.js';

interface ObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  farms: Farm[];
  plots: Plot[];
  onObservationCreated: (obs: Observation) => void;
}

// Demo SVG data-URIs for prototype testing without requiring immediate camera permissions
const SAMPLE_CROP_IMAGES: { label: string; crop: string; symptoms: string[]; base64: string }[] = [
  {
    label: 'Tomato: Early Blight (Target Spots)',
    crop: 'Tomato',
    symptoms: ['dark spots with concentric rings', 'yellowing'],
    // 1x1 green/brown sample data url for demonstration
    base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  },
  {
    label: 'Cotton: Powdery Mildew (White Patches)',
    crop: 'Cotton',
    symptoms: ['white powdery coating', 'leaf curling'],
    base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  },
  {
    label: 'Chilli: Leaf Curl Virus (Puckered Foliage)',
    crop: 'Chilli',
    symptoms: ['leaf curling', 'yellowing'],
    base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  },
  {
    label: 'Maize: Pest Defoliation (Chewed Whorl)',
    crop: 'Maize',
    symptoms: ['holes in leaves', 'visible insects / larvae'],
    base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  }
];

const AVAILABLE_SYMPTOMS = [
  'dark spots with concentric rings',
  'yellowing',
  'wilting',
  'white powdery coating',
  'water-soaked lesions',
  'holes in leaves',
  'leaf curling',
  'visible insects / larvae',
  'stunted growth',
  'fruit rotting / spots',
];

export const ObservationModal: React.FC<ObservationModalProps> = ({
  isOpen,
  onClose,
  farms,
  plots,
  onObservationCreated,
}) => {
  const [selectedFarmId, setSelectedFarmId] = useState(farms[0]?.id ?? '');
  const farmPlots = plots.filter(p => p.farmId === selectedFarmId);
  const [selectedPlotId, setSelectedPlotId] = useState(farmPlots[0]?.id ?? (plots[0]?.id ?? ''));

  const activePlot = plots.find(p => p.id === selectedPlotId);

  const [plantPart, setPlantPart] = useState<PlantPart>('Leaf');
  const [severityEstimate, setSeverityEstimate] = useState<SeverityEstimate>('Moderate (multiple leaves)');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([
    'dark spots with concentric rings',
    'yellowing',
  ]);
  const [symptomDescription, setSymptomDescription] = useState(
    'Target-board concentric ring lesions on lower leaves with yellow halo. Upper leaves look healthy for now.'
  );
  const [imageData, setImageData] = useState<string>(SAMPLE_CROP_IMAGES[0].base64);
  const [imagePreviewName, setImagePreviewName] = useState<string>('Tomato Early Blight Sample Image');
  const [farmerNotes, setFarmerNotes] = useState('Observed after 2 days of intermittent evening rains.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPEG, PNG, WEBP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image size exceeds 10MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageData(reader.result as string);
      setImagePreviewName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = (sample: typeof SAMPLE_CROP_IMAGES[0]) => {
    setImageData(sample.base64);
    setImagePreviewName(sample.label);
    setSelectedSymptoms(sample.symptoms);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId || !selectedPlotId || !activePlot) {
      setError('Please select a valid farm and plot context');
      return;
    }

    if (!imageData) {
      setError('Please capture or select an image of the affected plant');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmId: selectedFarmId,
          plotId: selectedPlotId,
          cropName: activePlot.cropName,
          growthStage: activePlot.cropStage,
          plantPart,
          severityEstimate,
          symptomTags: selectedSymptoms,
          symptomDescription,
          imageData,
          farmerNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit observation');
      }

      onObservationCreated(data.data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error submitting observation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-[#E0E0E0]">
        <div className="bg-[#1B3022] px-6 py-4 text-white flex items-center justify-between border-b-4 border-[#2D5A27]">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-[#4CAF50]" />
            <div>
              <h3 className="font-bold text-base tracking-tight">Record Crop Observation (Phase 4)</h3>
              <p className="text-xs text-emerald-200/90 font-mono">
                GROUND EVIDENCE • CONTEXTUAL CROP PHENOLOGY
              </p>
            </div>
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

          {/* Farm & Plot Context */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Farm *
              </label>
              <select
                value={selectedFarmId}
                onChange={(e) => {
                  setSelectedFarmId(e.target.value);
                  const matchingPlots = plots.filter(p => p.farmId === e.target.value);
                  if (matchingPlots[0]) setSelectedPlotId(matchingPlots[0].id);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.district})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Plot *
              </label>
              <select
                value={selectedPlotId}
                onChange={(e) => setSelectedPlotId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {farmPlots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.cropName} • {p.cropStage})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Auto-extracted Crop Info Banner */}
          {activePlot && (
            <div className="text-xs bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="font-semibold">Crop:</span> {activePlot.cropName} ({activePlot.variety || 'Standard'})
              </div>
              <div>
                <span className="font-semibold">Stage:</span> {activePlot.cropStage}
              </div>
              <div>
                <span className="font-semibold">Season:</span> {activePlot.season}
              </div>
            </div>
          )}

          {/* Image Capture & Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Foliar Image Evidence *
            </label>
            
            {/* Quick Demo Sample Picker */}
            <div className="mb-2">
              <span className="text-[11px] text-slate-500 flex items-center gap-1 mb-1">
                <Sparkles className="w-3 h-3 text-emerald-600" /> Quick test sample images:
              </span>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {SAMPLE_CROP_IMAGES.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSample(sample)}
                    className="text-left p-1.5 rounded text-[11px] border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors"
                  >
                    <div className="font-medium text-slate-800 truncate">{sample.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors bg-slate-50/50">
              {imageData ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-semibold text-slate-800">{imagePreviewName}</div>
                      <div className="text-[11px] text-emerald-600 font-medium">Image attached & validated</div>
                    </div>
                  </div>
                  <label className="cursor-pointer text-xs text-emerald-700 hover:text-emerald-900 font-semibold px-3 py-1.5 border border-emerald-300 rounded-lg bg-white">
                    Change Image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                  <div className="text-xs font-semibold text-slate-700">
                    Upload foliage photo or drag and drop
                  </div>
                  <div className="text-[11px] text-slate-500">
                    JPG, PNG or WEBP up to 10MB
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Plant Part & Severity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Affected Plant Part *
              </label>
              <select
                value={plantPart}
                onChange={(e) => setPlantPart(e.target.value as PlantPart)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="Leaf">Leaf / Foliage</option>
                <option value="Stem">Stem / Vine</option>
                <option value="Fruit / Pod / Earhead">Fruit / Pod / Earhead</option>
                <option value="Root / Crown">Root / Crown</option>
                <option value="Whole Plant">Whole Plant</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Severity Estimate *
              </label>
              <select
                value={severityEstimate}
                onChange={(e) => setSeverityEstimate(e.target.value as SeverityEstimate)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="Mild (isolated spots)">Mild (isolated spots on few plants)</option>
                <option value="Moderate (multiple leaves)">Moderate (multiple leaves / clustered)</option>
                <option value="Severe (widespread)">Severe (widespread foliar defoliation)</option>
              </select>
            </div>
          </div>

          {/* Observable Symptoms Tag Chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Observed Symptoms (Tags)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_SYMPTOMS.map((sym) => {
                const isSelected = selectedSymptoms.includes(sym);
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => toggleSymptom(sym)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sym}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description & Farmer Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Symptom Description & Location Details
            </label>
            <textarea
              rows={2}
              value={symptomDescription}
              onChange={(e) => setSymptomDescription(e.target.value)}
              placeholder="Describe where spots appear, halo colors, time of day..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
              {loading ? 'Submitting...' : 'Record Observation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
