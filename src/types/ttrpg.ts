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

export interface CustomCondition {
  id: string;
  name: string;
  isSecret: boolean;
  turnsLeft?: number;
}

export interface Combatant {
  id: string;
  name: string;
  type: CombatantType;
  customRoleLabel?: string; // DM free-text label for custom initiatives (e.g. Lair Action, Mass Combat)
  initiative: number;
  armorClass: number;
  ac?: number; // Armor Class field (default 10)
  hpCurrent: number;
  hpMax: number;
  hpTemp: number;
  tempHp?: number;
  conditions: CustomCondition[];
  deathSaves?: {
    successes: number;
    failures: number;
  };
  notes?: string;
  hidden?: boolean; // Per-combatant DM visibility toggle (completely hidden from initiative)
  fogOfWar?: boolean; // Fog of War toggle (conceals active conditions, status badges, exact HP, and damage numbers)
  isSecret?: boolean; // Secret Boss / NPC marker (completely hidden from player initiative until revealed)
  sortOrder?: number; // GM manual sorting priority order
  updatedAt?: number; // State modification timestamp to prevent desync
  tokenId?: string; // Linked Owlbear Rodeo scene token ID for lightweight token focus
}

/**
 * Calculates effective AC dynamically accounting for temporary AC conditions:
 * - +2 AC (Half Cover / Shield of Faith)
 * - +5 AC (Shield Spell / Three-Quarters Cover)
 */
export function getEffectiveAc(combatant: Combatant): { effectiveAc: number; bonus: number; baseAc: number } {
  const baseAc = combatant.ac ?? combatant.armorClass ?? 10;
  let bonus = 0;
  for (const c of combatant.conditions || []) {
    const name = typeof c === 'string' ? c : c.name;
    if (
      name.includes('+2 AC') ||
      name.toLowerCase().includes('half cover') ||
      name.toLowerCase().includes('shield of faith')
    ) {
      bonus += 2;
    } else if (
      name.includes('+5 AC') ||
      name.toLowerCase().includes('shield spell') ||
      name.toLowerCase().includes('three-quarters cover')
    ) {
      bonus += 5;
    }
  }
  return { effectiveAc: baseAc + bonus, bonus, baseAc };
}

/**
 * Returns true if a combatant is considered under Fog of War.
 * - If fogOfWar is explicitly set, it respects that boolean.
 * - If hidden or isSecret is true, it is under Fog of War.
 * - Otherwise, monsters, bosses, and custom environmental entities default to Fog of War.
 */
export function isCombatantFoW(combatant: Combatant): boolean {
  if (combatant.fogOfWar !== undefined) return combatant.fogOfWar;
  if (combatant.hidden || combatant.isSecret) return true;
  return combatant.type === 'monster' || combatant.type === 'boss' || combatant.type === 'custom';
}

/**
 * Deterministic sort:
 * sorted = [...combatants].sort((a, b) => b.initiative - a.initiative || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id))
 */
export function sortInitiativeStrictDescending(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort(
    (a, b) => b.initiative - a.initiative || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id)
  );
}

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export type RollVisibility = 'public' | 'gm_only' | 'self' | 'dm';

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
  advantageMode?: 'normal' | 'advantage' | 'disadvantage';
  modifier?: number;
}

export type RollDisplayMode = 'sum' | 'individual';

export interface PairedD20Roll {
  pairIndex: number; // 1-based (Pair 1, Pair 2, ...)
  die1: number;
  die2: number;
  selected: number;
  discarded: number;
  modifier?: number;
  totalWithModifier?: number;
  lineItem?: string; // e.g. "Roll 1: [18, ~~6~~] + 4 = 22"
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
  rollerName?: string;
  rollerId?: string;
  isDm: boolean;
  isSecret?: boolean;
  visibility?: RollVisibility;
  rollType?: RollTypeCategory;
  diceType: DieType;
  count: number;
  modifier: number;
  rolls: number[]; // winning/resolved dice values for all dice (length = count)
  breakdown?: string[];
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
  individualLineItems?: string[];
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
