import { Combatant } from '../types/ttrpg';

/**
 * Utility functions for 5e Concentration Checks.
 */

/**
 * Checks whether a combatant has an active concentration condition.
 * Case-insensitive, matching both standard condition tags and custom user-entered condition tags
 * (e.g. "Concentration", "concentrating", "CONCENTRATION").
 */
export function isConcentrating(combatant: Combatant): boolean {
  if (!combatant || !Array.isArray(combatant.conditions)) return false;
  return combatant.conditions.some((c) => {
    const name = (c.name || '').trim().toLowerCase();
    return name === 'concentration' || name === 'concentrating';
  });
}

/**
 * Calculates the standard 5e Concentration Saving Throw Difficulty Class (DC):
 * DC = Math.max(10, Math.floor(damageTaken / 2))
 *
 * Rules:
 * - Baseline DC is always at least 10.
 * - If half the damage taken exceeds 10, the DC equals half the damage taken rounded down.
 * - e.g. 4 damage -> DC 10
 * - e.g. 15 damage -> DC 10
 * - e.g. 25 damage -> DC 12
 * - e.g. 44 damage -> DC 22
 */
export function calculateConcentrationDC(damageTaken: number): number {
  if (damageTaken <= 0) return 10;
  return Math.max(10, Math.floor(damageTaken / 2));
}

export interface ConcentrationAlert {
  id: string;
  combatantId: string;
  combatantName: string;
  damageTaken: number;
  dc: number;
  timestamp: number;
}

/**
 * Formats the live room feed system broadcast message.
 */
export function formatConcentrationFeedMessage(
  combatantName: string,
  damageTaken: number,
  dc: number
): string {
  return `⚡ ${combatantName} took ${damageTaken} damage while concentrating! DC ${dc} Constitution saving throw required.`;
}
