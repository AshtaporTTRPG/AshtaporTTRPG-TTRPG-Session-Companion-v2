export type CombatantType = 'player' | 'ally' | 'monster' | 'boss' | 'custom';

export type HealthStatus = 'Healthy' | 'Hurt' | 'Bloodied' | 'Critical' | 'Unconscious / Defeated';

export type Condition =
  | 'Blinded'
  | 'Charmed'
  | 'Deafened'
  | 'Frightened'
  | 'Grappled'
  | 'Incapacitated'
  | 'Invisible'
  | 'Paralyzed'
  | 'Petrified'
  | 'Poisoned'
  | 'Prone'
  | 'Restrained'
  | 'Stunned'
  | 'Unconscious'
  | 'Concentration'
  | 'Exhaustion';

export interface Combatant {
  id: string;
  name: string;
  type: CombatantType;
  customRoleLabel?: string; // DM free-text label for custom initiatives (e.g. Lair Action, Mass Combat)
  initiative: number;
  armorClass: number;
  hpCurrent: number;
  hpMax: number;
  hpTemp: number;
  conditions: { name: string; turnsLeft?: number }[];
  deathSaves?: {
    successes: number;
    failures: number;
  };
  notes?: string;
  hidden?: boolean; // Per-combatant DM visibility toggle (completely hidden from initiative)
  fogOfWar?: boolean; // Fog of War toggle (conceals active conditions, status badges, exact HP, and damage numbers)
}

/**
 * Returns true if a combatant is considered under Fog of War.
 * - If fogOfWar is explicitly set, it respects that boolean.
 * - If hidden is true, it is under Fog of War.
 * - Otherwise, monsters, bosses, and custom environmental entities default to Fog of War.
 */
export function isCombatantFoW(combatant: Combatant): boolean {
  if (combatant.fogOfWar !== undefined) return combatant.fogOfWar;
  if (combatant.hidden) return true;
  return combatant.type === 'monster' || combatant.type === 'boss' || combatant.type === 'custom';
}

/**
 * Strict descending initiative sort (b.initiative - a.initiative).
 * Enforces highest total initiative score at index 0.
 * Maintains stable insertion order as tie-breaker.
 */
export function sortInitiativeStrictDescending(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => {
    if (b.initiative !== a.initiative) {
      return b.initiative - a.initiative;
    }
    return 0; // Stable tie-breaker: preserves existing insertion order
  });
}

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export type RollVisibility = 'public' | 'dm' | 'self';

export type RollTypeCategory =
  | 'Straight roll'
  | 'Attack roll'
  | 'Skill check'
  | 'Saving Throw'
  | 'Damage'
  | 'Fate';

export interface CustomMacro {
  id: string;
  name: string;
  formula: string;
  rollType?: RollTypeCategory;
}

export type RollDisplayMode = 'sum' | 'individual';

export interface PairedD20Roll {
  pairIndex: number; // 1-based (Pair 1, Pair 2, ...)
  die1: number;
  die2: number;
  selected: number;
  discarded: number;
}

export interface DieGroupRoll {
  dieType: DieType;
  rolls: number[]; // winning/resolved values
  pairedRolls?: PairedD20Roll[]; // present for d20 rolls when advantageMode is advantage or disadvantage
  rawRolls?: number[]; // raw rolls including discarded
}

export interface DiceRollResult {
  id: string;
  timestamp: number;
  sender: string;
  isDm: boolean;
  isSecret?: boolean;
  visibility?: RollVisibility;
  rollType?: RollTypeCategory;
  diceType: DieType;
  count: number;
  modifier: number;
  rolls: number[]; // winning/resolved dice values for all dice (length = count)
  rawRolls?: number[]; // raw rolls including discarded
  pairedRolls?: PairedD20Roll[]; // for d20 rolls with advantage/disadvantage
  total: number;
  advantageMode: 'normal' | 'advantage' | 'disadvantage';
  label?: string;
  isCrit?: boolean;
  isFumble?: boolean;
  displayMode?: RollDisplayMode;
  poolBreakdown?: DieGroupRoll[];
  formula?: string;
  individualSummary?: string;
}

export type PinCategory = 'general' | 'npc' | 'quest' | 'loot' | 'secret' | 'landmark' | 'tavern' | 'settlement';

export type PinPrivacy = 'shared' | 'personal' | 'dm';

export interface MapPin {
  id: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  title: string;
  category: PinCategory;
  description: string;
  privacy: PinPrivacy;
  author: string;
  isDmOnly?: boolean; // legacy compat
  dmNotes?: string; // DM private secret notes
  personalNotes?: string; // personal player notes
  isRevealed?: boolean; // When DM reveals a private note to all players
  color?: string;
  linkedEncounter?: string;
}

export interface MapData {
  id: string;
  title: string;
  url: string;
  type: 'world' | 'tactical';
  scaleUnit: 'miles' | 'feet';
  scaleRatio: number; // e.g. 50 px = 10 miles or 1 square = 5 feet
  pins: MapPin[];
}

export type ShapeType = 'sphere' | 'cone' | 'cylinder' | 'cube' | 'line';

export interface GeometryCalculation {
  shape: ShapeType;
  size: number; // radius, length, or width in feet
  height?: number; // for cylinder
  sourceElevation: number; // feet
  targetElevation: number; // feet
  horizontalDistance: number; // feet
  diagonalRule: 'euclidean' | '5-10-5' | 'standard-5e';
}

export type NoteCategory = 'general' | 'npc' | 'quest' | 'loot' | 'clue' | 'lore' | 'tactic';

export interface SessionNote {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  isPinned?: boolean;
  createdAt?: number;
  updatedAt: number;
}
