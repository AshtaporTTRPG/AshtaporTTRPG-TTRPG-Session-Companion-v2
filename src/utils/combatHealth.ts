import { HealthStatus } from '../types/ttrpg';

export interface HealthThresholdInfo {
  status: HealthStatus | 'Full' | 'Hurt' | 'Bloodied' | 'Critical' | 'Downed';
  badgeClass: string;
  badgeLabel: string;
  percentage: number;
  textColor: string;
}

/**
 * Automated HP Status Pill calculation based on current HP vs max HP:
 * - Full: 100% HP (Neutral/Slate)
 * - Hurt: < 100% and > 50% HP (Muted Yellow/Amber-400)
 * - Bloodied: <= 50% and > 15% HP (Orange-500)
 * - Critical / Downed: <= 15% or 0 HP (Crimson/Rose-600)
 */
export function getHealthThreshold(hpCurrent: number, hpMax: number): HealthThresholdInfo {
  if (hpMax <= 0) {
    return {
      status: 'Full',
      badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
      badgeLabel: 'Full',
      percentage: 100,
      textColor: 'text-slate-300',
    };
  }

  const percentage = Math.max(0, Math.round((hpCurrent / hpMax) * 100));

  // 0 HP: Downed (Crimson/Rose-600)
  if (hpCurrent <= 0) {
    return {
      status: 'Downed',
      badgeClass: 'bg-rose-950 text-rose-200 border-rose-800 font-bold',
      badgeLabel: '💀 Downed',
      percentage: 0,
      textColor: 'text-rose-500',
    };
  }

  // Critical: <= 15% HP (Crimson/Rose-600)
  if (percentage <= 15) {
    return {
      status: 'Critical',
      badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-700 font-bold animate-pulse',
      badgeLabel: 'Critical',
      percentage,
      textColor: 'text-rose-400',
    };
  }

  // Bloodied: <= 50% and > 15% HP (Orange-500)
  if (percentage <= 50) {
    return {
      status: 'Bloodied',
      badgeClass: 'bg-orange-950/90 text-orange-400 border-orange-600/80 font-semibold',
      badgeLabel: 'Bloodied',
      percentage,
      textColor: 'text-orange-400',
    };
  }

  // Hurt: < 100% and > 50% HP (Muted Yellow/Amber-400)
  if (percentage < 100) {
    return {
      status: 'Hurt',
      badgeClass: 'bg-amber-950/80 text-amber-400 border-amber-700/80 font-medium',
      badgeLabel: 'Hurt',
      percentage,
      textColor: 'text-amber-400',
    };
  }

  // Full: 100% HP (Neutral/Slate)
  return {
    status: 'Full',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    badgeLabel: 'Full',
    percentage: 100,
    textColor: 'text-slate-300',
  };
}
