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

/**
 * Legacy Room Metadata Keys
 */
export const COMBAT_STATE_KEY = 'com.ashtapor.companion/combat-state';
export const ROOM_METADATA_KEY = COMBAT_STATE_KEY;

/**
 * v2.0.15 Partitioned Room Metadata Payloads
 * Isolated namespaces to permanently eliminate cross-feature overwrites
 */
export const ROSTER_METADATA_KEY = 'ashtapor/roster';
export const TURN_METADATA_KEY = 'ashtapor/turn';
export const FEED_METADATA_KEY = 'ashtapor/feed';

export interface RosterMetadataPayload {
  encounterId: string; // Timestamped encounter epoch
  combatants: import('./ttrpg').Combatant[];
}

export interface TurnMetadataPayload {
  encounterId: string;
  currentTurnIndex: number;
  currentRound: number;
  activeCombatantId?: string | null;
}

export interface CombatFeedItem {
  id: string;
  encounterId?: string;
  message: string;
  playerMessage?: string;
  sender: string;
  timestamp: number;
  isSecret?: boolean;
  type?: 'combat' | 'turn' | 'dice' | 'chat';
}

export interface FeedMetadataPayload {
  items: CombatFeedItem[]; // Append-only, capped at 25 items
}
