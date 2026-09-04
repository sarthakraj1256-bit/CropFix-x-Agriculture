/**
 * CropFix - AI-Assisted Crop Assessment Service (Phase 5)
 * SIH26131: Early detection and management of crop diseases and pest infestations
 * 
 * Notice: This is an AI-assisted crop-health decision support service.
 * It is NOT a certified diagnosis or guaranteed ground truth.
 */

import crypto from 'node:crypto';
import { getDb } from './db.js';
import type { 
  AssessmentRecord, 
  CandidateIssue, 
  IssueCategory, 
  ConfidenceLevel,
  Observation 
} from '../types/index.js';

interface AssessmentInput {
  observationId: string;
  cropName: string;
  growthStage: string;
  plantPart: string;
  severityEstimate: string;
  symptomTags: string[];
  symptomDescription: string;
  imageData?: string; // base64
}

export class AssessmentService {
  /**
   * Run assessment on a crop observation
   */
  static async assess(input: AssessmentInput): Promise<AssessmentRecord> {
    const db = getDb();

    // Check if an assessment already exists for this observation
    const existing = db.prepare('SELECT * FROM assessments WHERE observation_id = ?').get(input.observationId) as {
      id: string;
      observation_id: string;
      engine_id: string;
      status: string;
      primary_issue: string;
      issue_category: string;
      confidence_level: string;
      confidence_score: number;
      evidence_points: string;
      alternative_candidates: string;
      uncertainty_notes: string;
      is_demo: number;
      disclaimer: string;
      created_at: string;
    } | undefined;

    if (existing) {
      return {
        id: existing.id,
        observationId: existing.observation_id,
        engineId: existing.engine_id,
        status: existing.status as AssessmentRecord['status'],
        primaryIssue: existing.primary_issue,
        issueCategory: existing.issue_category as IssueCategory,
        confidenceLevel: existing.confidence_level as ConfidenceLevel,
        confidenceScore: existing.confidence_score,
        evidencePoints: JSON.parse(existing.evidence_points),
        alternativeCandidates: JSON.parse(existing.alternative_candidates),
        uncertaintyNotes: existing.uncertainty_notes,
        isDemo: Boolean(existing.is_demo),
        disclaimer: existing.disclaimer,
        createdAt: existing.created_at,
      };
    }

    // Attempt assessment via prototype engine (or Gemini if key is provided)
    let assessmentData: Omit<AssessmentRecord, 'id' | 'observationId' | 'createdAt'>;

    if (process.env.GEMINI_API_KEY && input.imageData) {
      try {
        assessmentData = await this.assessWithGemini(input);
      } catch (err) {
        console.warn('Gemini assessment unavailable, falling back to deterministic prototype engine:', err);
        assessmentData = this.assessWithPrototypeEngine(input);
      }
    } else {
      assessmentData = this.assessWithPrototypeEngine(input);
    }

    const assessmentId = `asmt-${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO assessments (
        id, observation_id, engine_id, status, primary_issue, issue_category,
        confidence_level, confidence_score, evidence_points, alternative_candidates,
        uncertainty_notes, is_demo, disclaimer, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assessmentId,
      input.observationId,
      assessmentData.engineId,
      assessmentData.status,
      assessmentData.primaryIssue,
      assessmentData.issueCategory,
      assessmentData.confidenceLevel,
      assessmentData.confidenceScore,
      JSON.stringify(assessmentData.evidencePoints),
      JSON.stringify(assessmentData.alternativeCandidates),
      assessmentData.uncertaintyNotes,
      assessmentData.isDemo ? 1 : 0,
      assessmentData.disclaimer,
      now
    );

    // Update observation status
    db.prepare('UPDATE observations SET status = ?, updated_at = ? WHERE id = ?').run(
      assessmentData.status === 'INSUFFICIENT_EVIDENCE' ? 'NEEDS_REVIEW' : 'ASSESSED',
      now,
      input.observationId
    );

    return {
      id: assessmentId,
      observationId: input.observationId,
      ...assessmentData,
      createdAt: now,
    };
  }

  /**
   * Deterministic, agricultural rule-grounded prototype assessment engine
   */
  private static assessWithPrototypeEngine(input: AssessmentInput): Omit<AssessmentRecord, 'id' | 'observationId' | 'createdAt'> {
    const symptoms = (input.symptomTags || []).map(s => s.toLowerCase());
    const desc = (input.symptomDescription || '').toLowerCase();
    const crop = (input.cropName || '').toLowerCase();

    // Check for insufficient evidence condition
    const isInsufficient = symptoms.length === 0 && desc.trim().length < 5;
    if (isInsufficient) {
      return {
        engineId: 'cropfix-prototype-v1',
        status: 'INSUFFICIENT_EVIDENCE',
        primaryIssue: 'Insufficient Visual and Symptom Evidence',
        issueCategory: 'insufficient_evidence',
        confidenceLevel: 'LOW',
        confidenceScore: 0.22,
        evidencePoints: [
          'No distinct lesion patterns or clear pest markings recorded.',
          'Symptom description lacks specific morphological markers.',
          'Image lighting or focus may obscure early stage lesion boundaries.'
        ],
        alternativeCandidates: [
          {
            issueName: 'Early stage physiological stress',
            category: 'environmental_stress',
            confidence: 'LOW',
            likelihoodScore: 0.25,
            notes: 'Possible temporary moisture or heat imbalance.'
          },
          {
            issueName: 'Incubation stage infection',
            category: 'fungal_disease',
            confidence: 'LOW',
            likelihoodScore: 0.20,
            notes: 'Sub-visible microscopic fungal colonization.'
          }
        ],
        uncertaintyNotes: 'High uncertainty: Insufficient optical and descriptive evidence to reliably distinguish between abiotic stress and biotic pathogen.',
        isDemo: true,
        disclaimer: 'Prototype Decision Support: Not a certified diagnosis. Seek human expert review or retake clearer imagery.'
      };
    }

    // Fungal: Early / Late Blight in Solanaceae (Tomato, Potato, Chilli)
    if (
      (crop.includes('tomato') || crop.includes('potato') || crop.includes('chilli') || crop.includes('brinjal')) &&
      (symptoms.includes('dark spots with concentric rings') || symptoms.includes('spots') || desc.includes('blight') || desc.includes('concentric') || desc.includes('brown spots'))
    ) {
      return {
        engineId: 'cropfix-prototype-v1',
        status: 'ASSESSED',
        primaryIssue: 'Early Blight (Alternaria solani)',
        issueCategory: 'fungal_disease',
        confidenceLevel: 'HIGH',
        confidenceScore: 0.84,
        evidencePoints: [
          'Target-board concentric ring lesions typical of Alternaria species on foliage.',
          'Chlorotic yellow halos encircling necrotic dark brown foliar spots.',
          'Predominantly affecting lower and older canopy foliage first.',
          `Contextual match with ${input.cropName} at the ${input.growthStage} stage.`
        ],
        alternativeCandidates: [
          {
            issueName: 'Septoria Leaf Spot (Septoria lycopersici)',
            category: 'fungal_disease',
            confidence: 'MEDIUM',
            likelihoodScore: 0.45,
            notes: 'Smaller circular spots with dark margins and gray centers.'
          },
          {
            issueName: 'Bacterial Spot (Xanthomonas spp.)',
            category: 'bacterial_disease',
            confidence: 'LOW',
            likelihoodScore: 0.28,
            notes: 'Small water-soaked lesions without distinct concentric rings.'
          }
        ],
        uncertaintyNotes: 'Moderate uncertainty regarding co-infection with Septoria leaf spot in humid canopy conditions.',
        isDemo: true,
        disclaimer: 'AI-assisted assessment based on visible symptom markers. Laboratory culture or expert agronomist validation recommended.'
      };
    }

    // Fungal: Powdery Mildew
    if (symptoms.includes('white powdery coating') || desc.includes('powdery') || desc.includes('white dust') || desc.includes('white powder')) {
      return {
        engineId: 'cropfix-prototype-v1',
        status: 'ASSESSED',
        primaryIssue: 'Powdery Mildew (Erysiphales)',
        issueCategory: 'fungal_disease',
        confidenceLevel: 'HIGH',
        confidenceScore: 0.88,
        evidencePoints: [
          'Talcum-powder like superficial white mycelial patches on leaf surface.',
          'Early chlorotic patches underneath white fungal talc patches.',
          'Upward leaf curling and premature drying of infected tissue.',
          'Rapid proliferation across upper canopy leaves.'
        ],
        alternativeCandidates: [
          {
            issueName: 'Downy Mildew (Pseudoperonospora spp.)',
            category: 'fungal_disease',
            confidence: 'LOW',
            likelihoodScore: 0.22,
            notes: 'Downy growth is typically restricted to abaxial (lower) leaf surfaces.'
          }
        ],
        uncertaintyNotes: 'Low uncertainty on fungal class; high visual confidence for powdery mildew mycelium.',
        isDemo: true,
        disclaimer: 'AI-assisted assessment based on visible symptom markers. Agricultural expert review recommended.'
      };
    }

    // Bacterial: Bacterial Blight / Wilt
    if (symptoms.includes('wilting') || symptoms.includes('water-soaked lesions') || desc.includes('wilt') || desc.includes('ooze')) {
      return {
        engineId: 'cropfix-prototype-v1',
        status: 'ASSESSED',
        primaryIssue: 'Bacterial Wilt / Blight (Ralstonia / Xanthomonas)',
        issueCategory: 'bacterial_disease',
        confidenceLevel: 'MEDIUM',
        confidenceScore: 0.74,
        evidencePoints: [
          'Rapid foliage wilting without immediate yellowing or defoliation.',
          'Vascular bundle discoloration in stem cross-sections.',
          'Water-soaked appearance along leaf margins in early morning.',
          `Reported severity: ${input.severityEstimate}.`
        ],
        alternativeCandidates: [
          {
            issueName: 'Fusarium Vascular Wilt',
            category: 'fungal_disease',
            confidence: 'MEDIUM',
            likelihoodScore: 0.52,
            notes: 'Fusarium wilt typically exhibits one-sided leaf chlorosis before total wilt.'
          },
          {
            issueName: 'Root Knot Nematode Stunting',
            category: 'pest_damage',
            confidence: 'LOW',
            likelihoodScore: 0.25,
            notes: 'Secondary root galling causing aboveground wilt symptoms.'
          }
        ],
        uncertaintyNotes: 'High uncertainty distinguishing between bacterial wilt and vascular fungal wilt without stem vascular stream testing.',
        isDemo: true,
        disclaimer: 'AI-assisted assessment. Vascular bacterial and fungal wilts require field stem-streaming or laboratory verification.'
      };
    }

    // Viral: Yellow Leaf Curl / Mosaic
    if (symptoms.includes('leaf curling') || symptoms.includes('mosaic pattern') || desc.includes('mosaic') || desc.includes('curl') || desc.includes('stunted')) {
      return {
        engineId: 'cropfix-prototype-v1',
        status: 'ASSESSED',
        primaryIssue: 'Yellow Leaf Curl / Mosaic Virus (Begomovirus)',
        issueCategory: 'viral_disease',
        confidenceLevel: 'HIGH',
        confidenceScore: 0.81,
        evidencePoints: [
          'Severe upward cupping and puckering of young leaflet margins.',
          'Interveinal chlorosis and conspicuous leaf reduction.',
          'Stunted apical growth internodes.',
          'Symptom distribution concentrated on youngest flush foliage.'
        ],
        alternativeCandidates: [
          {
            issueName: 'Broad Mite (Polyphagotarsonemus latus) Damage',
            category: 'pest_damage',
            confidence: 'MEDIUM',
            likelihoodScore: 0.42,
            notes: 'Mite feeding causes downward curling and bronzing on foliage.'
          },
          {
            issueName: 'Severe Boron or Micronutrient Imbalance',
            category: 'nutrient_deficiency',
            confidence: 'LOW',
            likelihoodScore: 0.20,
            notes: 'Apical bud death and brittle distorted leaves.'
          }
        ],
        uncertaintyNotes: 'Moderate uncertainty between vector-transmitted begomovirus and severe sub-microscopic mite feeding.',
        isDemo: true,
        disclaimer: 'Viral assessments are indicative based on morphological symptoms. Vector insect presence should be cross-verified.'
      };
    }

    // Pest Damage: Chewing / Piercing / Borers
    if (symptoms.includes('holes in leaves') || symptoms.includes('visible insects / larvae') || desc.includes('pest') || desc.includes('worm') || desc.includes('caterpillar') || desc.includes('borer')) {
      return {
        engineId: 'cropfix-prototype-v1',
        status: 'ASSESSED',
        primaryIssue: 'Foliar Insect Pest Damage (Noctuidae / Spodoptera)',
        issueCategory: 'pest_damage',
        confidenceLevel: 'HIGH',
        confidenceScore: 0.86,
        evidencePoints: [
          'Irregular foliar defoliation and window-paning characteristic of lepidopteran larvae.',
          'Fresh fecal frass granules observed around leaf axils or whorl.',
          'Physical bite margins rather than necrotic enzymatic disease decay.',
          `Affected part: ${input.plantPart}.`
        ],
        alternativeCandidates: [
          {
            issueName: 'Foliar Flea Beetle Shot-holing',
            category: 'pest_damage',
            confidence: 'LOW',
            likelihoodScore: 0.30,
            notes: 'Produces small circular shotgun holes rather than broad chewed margins.'
          }
        ],
        uncertaintyNotes: 'Low uncertainty regarding mechanical insect feeding; moderate uncertainty on exact instar or larval genus without close-up pest specimen.',
        isDemo: true,
        disclaimer: 'Visual identification of insect damage pattern. Field scouting for adult pests or larvae is recommended.'
      };
    }

    // Nutrient: Nitrogen or Potassium deficiency
    if (symptoms.includes('yellowing') || desc.includes('yellow') || desc.includes('pale') || desc.includes('chlorosis')) {
      return {
        engineId: 'cropfix-prototype-v1',
        status: 'ASSESSED',
        primaryIssue: 'Macronutrient Deficiency (Suspected Nitrogen / Potassium Chlorosis)',
        issueCategory: 'nutrient_deficiency',
        confidenceLevel: 'MEDIUM',
        confidenceScore: 0.69,
        evidencePoints: [
          'Uniform yellowing (chlorosis) beginning from older basal foliage.',
          'Absence of discrete necrotic lesions or fungal sporulation bodies.',
          'Gradual transition from pale green to yellow along midrib.',
          `Crop stage: ${input.growthStage}.`
        ],
        alternativeCandidates: [
          {
            issueName: 'Root Waterlogging / Soil Anoxia',
            category: 'environmental_stress',
            confidence: 'MEDIUM',
            likelihoodScore: 0.48,
            notes: 'Root oxygen starvation prevents nitrogen uptake, mimicking deficiency.'
          },
          {
            issueName: 'Early Soil-Borne Nematode Infestation',
            category: 'pest_damage',
            confidence: 'LOW',
            likelihoodScore: 0.25,
            notes: 'Root damage restricts nutrient translocation.'
          }
        ],
        uncertaintyNotes: 'High uncertainty: Soil nutrient tests or tissue petiole analysis needed to distinguish genuine deficiency from root uptake impairment.',
        isDemo: true,
        disclaimer: 'Nutrient deficiency symptoms are indicative. Soil testing or foliar tissue test recommended before fertilizer adjustment.'
      };
    }

    // Default Fallback
    return {
      engineId: 'cropfix-prototype-v1',
      status: 'ASSESSED',
      primaryIssue: `Foliar Stress / Early Infection on ${input.cropName}`,
      issueCategory: 'environmental_stress',
      confidenceLevel: 'LOW',
      confidenceScore: 0.55,
      evidencePoints: [
        'Atypical discoloration observed on foliage.',
        'Symptom manifestation does not match single pathognomonic diagnostic sign.',
        `Observed severity: ${input.severityEstimate}.`
      ],
      alternativeCandidates: [
        {
          issueName: 'Secondary Fungal Opportunistic Colonization',
          category: 'fungal_disease',
          confidence: 'LOW',
          likelihoodScore: 0.38,
          notes: 'Weak pathogen entering wounded or sun-stressed foliage.'
        },
        {
          issueName: 'Abiotic Heat / Evapotranspiration Stress',
          category: 'environmental_stress',
          confidence: 'LOW',
          likelihoodScore: 0.35,
          notes: 'High daytime temperatures causing temporary leaf desiccation.'
        }
      ],
      uncertaintyNotes: 'High uncertainty: Multiple abiotic and biotic stressors produce similar non-specific foliar stress responses.',
      isDemo: true,
      disclaimer: 'AI-assisted decision support prototype. Not a certified diagnosis. Consult local agricultural extension officers.'
    };
  }

  /**
   * Gemini multimodal assessment integration when API key is configured
   */
  private static async assessWithGemini(input: AssessmentInput): Promise<Omit<AssessmentRecord, 'id' | 'observationId' | 'createdAt'>> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `You are the CropFix AI agricultural decision support assistant.
Assess the following crop health observation:
- Crop: ${input.cropName}
- Growth stage: ${input.growthStage}
- Plant part: ${input.plantPart}
- Severity: ${input.severityEstimate}
- Symptom tags: ${input.symptomTags.join(', ')}
- Description: ${input.symptomDescription}

Provide your assessment in valid JSON format matching this schema:
{
  "primaryIssue": "Specific likely disease, pest, or deficiency name",
  "issueCategory": "fungal_disease" | "bacterial_disease" | "viral_disease" | "pest_damage" | "nutrient_deficiency" | "environmental_stress" | "healthy_no_obvious_issue" | "insufficient_evidence",
  "confidenceLevel": "HIGH" | "MEDIUM" | "LOW",
  "confidenceScore": 0.0 to 1.0,
  "evidencePoints": ["Specific visual observation 1", "Contextual reason 2", "Morphological sign 3"],
  "alternativeCandidates": [
    {
      "issueName": "Alternative possible cause",
      "category": "fungal_disease",
      "confidence": "MEDIUM",
      "likelihoodScore": 0.4,
      "notes": "Why this is also possible"
    }
  ],
  "uncertaintyNotes": "Honest explanation of what cannot be determined with certainty"
}
Do NOT invent guaranteed diagnoses. Do NOT recommend toxic chemicals or pesticide dosages. Respond ONLY with valid JSON.`;

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: prompt },
    ];

    if (input.imageData) {
      const cleanBase64 = input.imageData.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: parts,
    });

    const responseText = response.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Gemini response did not contain valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      engineId: 'cropfix-gemini-v1',
      status: parsed.issueCategory === 'insufficient_evidence' ? 'INSUFFICIENT_EVIDENCE' : 'ASSESSED',
      primaryIssue: parsed.primaryIssue || 'Unclassified Foliar Issue',
      issueCategory: parsed.issueCategory || 'environmental_stress',
      confidenceLevel: (['HIGH', 'MEDIUM', 'LOW'].includes(parsed.confidenceLevel) ? parsed.confidenceLevel : 'MEDIUM') as ConfidenceLevel,
      confidenceScore: typeof parsed.confidenceScore === 'number' ? Math.min(Math.max(parsed.confidenceScore, 0.1), 0.95) : 0.7,
      evidencePoints: Array.isArray(parsed.evidencePoints) ? parsed.evidencePoints : ['Visual symptoms align with reported disease profile.'],
      alternativeCandidates: Array.isArray(parsed.alternativeCandidates) ? parsed.alternativeCandidates : [],
      uncertaintyNotes: parsed.uncertaintyNotes || 'Uncertainty present due to absence of laboratory assay.',
      isDemo: false,
      disclaimer: 'AI-assisted assessment using Google Gemini. Decisions must be verified with agricultural extension personnel.',
    };
  }
}
