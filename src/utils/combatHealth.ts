import { HealthStatus } from '../types/ttrpg';

export interface HealthThresholdInfo {
  status: HealthStatus;
  badgeClass: string;
  badgeLabel: string;
  percentage: number;
  textColor: string;
}

/**
 * Dynamic health status calculations based on current HP:
 * - Unconscious: Current HP === 0 (Dark red badge).
 * - Critical: Current HP between 1 and 9 inclusive (Red badge).
 * - Bloodied: Current HP > 9 and <= 50% of Max HP (Orange badge).
 * - Hurt: Current HP > 50% of Max HP (Yellow/Amber badge).
 */
export function getHealthThreshold(hpCurrent: number, hpMax: number): HealthThresholdInfo {
  if (hpMax <= 0) {
    return {
      status: 'Healthy',
      badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80',
      badgeLabel: 'Healthy',
      percentage: 100,
      textColor: 'text-emerald-400',
    };
  }

  const percentage = Math.max(0, Math.round((hpCurrent / hpMax) * 100));

  // Unconscious: Current HP === 0 (Dark red badge)
  if (hpCurrent <= 0) {
    return {
      status: 'Unconscious / Defeated',
      badgeClass: 'bg-red-950 text-red-200 border-red-800 font-bold',
      badgeLabel: '💀 Unconscious',
      percentage: 0,
      textColor: 'text-red-500',
    };
  }

  // Critical: Current HP between 1 and 9 inclusive (Red badge)
  if (hpCurrent >= 1 && hpCurrent <= 9) {
    return {
      status: 'Critical',
      badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-700 font-bold animate-pulse',
      badgeLabel: 'Critical',
      percentage,
      textColor: 'text-rose-400',
    };
  }

  // Bloodied: Current HP > 9 and <= 50% of Max HP (Orange badge)
  if (hpCurrent > 9 && hpCurrent <= Math.floor(hpMax * 0.5)) {
    return {
      status: 'Bloodied',
      badgeClass: 'bg-orange-950/90 text-orange-300 border-orange-700 font-semibold',
      badgeLabel: 'Bloodied',
      percentage,
      textColor: 'text-orange-400',
    };
  }

  // Hurt: Current HP > 50% of Max HP (Yellow/Amber badge)
  if (hpCurrent < hpMax) {
    return {
      status: 'Hurt',
      badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-700/80 font-semibold',
      badgeLabel: 'Hurt',
      percentage,
      textColor: 'text-amber-400',
    };
  }

  // Full HP: Healthy
  return {
    status: 'Healthy',
    badgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60',
    badgeLabel: 'Healthy',
    percentage: 100,
    textColor: 'text-emerald-400',
  };
}
