/**
 * Rhubarb Lip Sync to Ready Player Me Viseme Mapping
 */

export interface VisemeFrame {
  time: number;
  viseme: string;
  duration: number;
}

export interface MorphTargetValues {
  [key: string]: number;
}

/**
 * Rhubarb shape → RPM viseme morph target mapping
 */
export const RHUBARB_TO_RPM: Record<string, MorphTargetValues> = {
  'A': { 'viseme_PP': 1.0 },
  'B': { 'viseme_kk': 0.5, 'viseme_nn': 0.3 },
  'C': { 'viseme_I': 0.7, 'viseme_E': 0.5 },
  'D': { 'viseme_aa': 1.0 },
  'E': { 'viseme_O': 0.8, 'viseme_aa': 0.3 },
  'F': { 'viseme_U': 1.0 },
  'G': { 'viseme_FF': 1.0 },
  'H': { 'viseme_TH': 0.6, 'viseme_nn': 0.4 },
  'X': { 'viseme_sil': 1.0 },
};
