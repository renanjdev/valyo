import { SCORE_VALUES, TEMPERATURE_THRESHOLDS } from '@mensageira/shared';

export function calculateTemperature(score: number): 'cold' | 'warm' | 'hot' {
  if (score > TEMPERATURE_THRESHOLDS.WARM_MAX) return 'hot';
  if (score > TEMPERATURE_THRESHOLDS.COLD_MAX) return 'warm';
  return 'cold';
}

export function isHotLead(score: number): boolean {
  return score > TEMPERATURE_THRESHOLDS.WARM_MAX;
}
