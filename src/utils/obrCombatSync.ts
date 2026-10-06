import OBR from '@owlbear-rodeo/sdk';
import { Combatant } from '../types/ttrpg';

export const COMBAT_STATE_KEY = 'com.ashtapor.companion/combat-state';

export interface CombatState {
  combatants: Combatant[];
  activeCombatantId: string | null;
  activeTurnIndex: number;
  round: number;
  combatStatus: 'setup' | 'active';
  lastTurnChangeTime?: number;
  lastUpdated?: number;
}

export async function fetchObrCombatState(): Promise<CombatState | null> {
  if (!OBR.isReady) return null;
  try {
    const metadata = await OBR.room.getMetadata();
    const state = metadata[COMBAT_STATE_KEY] as CombatState | undefined;
    return state || null;
  } catch (e) {
    console.error('Failed to get OBR room metadata:', e);
    return null;
  }
}

export async function saveObrCombatState(state: CombatState): Promise<void> {
  if (!OBR.isReady) return;
  try {
    await OBR.room.setMetadata({
      [COMBAT_STATE_KEY]: state,
    });
  } catch (e) {
    console.error('Failed to set OBR combat metadata:', e);
  }
}
