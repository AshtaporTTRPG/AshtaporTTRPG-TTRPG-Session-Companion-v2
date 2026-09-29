import { HealthStatus } from '../types/ttrpg';

export interface HealthThresholdInfo {
  status: HealthStatus;
  badgeClass: string;
  badgeLabel: string;
  percentage: number;
  textColor: string;
}

/**
 * Calculates dynamic health threshold status based on Homebrew rules:
 * - Hurt: 51% - 75% HP
 * - Bloodied: 21% - 50% HP
 * - Critical: 1% - 20% HP
 * - Unconscious / Defeated: 0 HP
 * - Healthy: > 75% HP
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

  if (hpCurrent <= 0) {
    return {
      status: 'Unconscious / Defeated',
      badgeClass: 'bg-red-950 text-rose-300 border-rose-800 animate-pulse font-bold',
      badgeLabel: '💀 Defeated',
      percentage: 0,
      textColor: 'text-rose-500',
    };
  }

  if (percentage <= 20) {
    return {
      status: 'Critical',
      badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-700 font-bold animate-pulse',
      badgeLabel: 'Critical',
      percentage,
      textColor: 'text-rose-400',
    };
  }

  if (percentage <= 50) {
    return {
      status: 'Bloodied',
      badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-700/90 font-semibold',
      badgeLabel: 'Bloodied',
      percentage,
      textColor: 'text-amber-400',
    };
  }

  if (percentage <= 75) {
    return {
      status: 'Hurt',
      badgeClass: 'bg-yellow-950/80 text-yellow-300 border-yellow-700/80',
      badgeLabel: 'Hurt',
      percentage,
      textColor: 'text-yellow-400',
    };
  }

  return {
    status: 'Healthy',
    badgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60',
    badgeLabel: 'Healthy',
    percentage,
    textColor: 'text-emerald-400',
  };
}
