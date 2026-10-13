export type {
  CombatantType,
  HealthStatus,
  Condition,
  CustomCondition,
  Combatant,
} from './ttrpg';

export {
  getEffectiveAc,
  isCombatantFoW,
  sortInitiativeStrictDescending,
  getClonedCombatantName,
} from './ttrpg';

export interface ConcentrationAlertState {
  dc: number;
  expiresAt: number;
}

export type HpThresholdTier = 'Full' | 'Hurt' | 'Bloodied' | 'Critical' | 'Downed';

export interface HpStatusPillConfig {
  tier: HpThresholdTier;
  label: string;
  badgeClass: string;
  percentage: number;
  textColor: string;
}

export interface TokenFocusEvent {
  tokenId: string;
  combatantId: string;
  combatantName: string;
}

export type RosterRole = 'PC' | 'Ally' | 'Monster' | 'Boss' | 'Custom';

export interface RosterMember {
  id: string;
  name: string;
  role: RosterRole;
  ac: number;
  maxHp: number;
  initiativeMod: number;
}
