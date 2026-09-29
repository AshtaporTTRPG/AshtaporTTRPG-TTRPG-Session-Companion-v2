/**
 * Standardized Quick Range Presets for 3D Geometry & Spatial Mechanics
 * Arranged in ascending order of range with items in strict alphabetical order.
 */

export interface WeaponRangePreset {
  id: string;
  category: 'weapon';
  rangeLabel: string;
  classification: string;
  normalRange: number;
  longRange?: number;
  items: string[];
}

export interface SpellRangePreset {
  id: string;
  category: 'spell';
  rangeLabel: string;
  classification: string;
  range: number;
  items: string[];
}

export type RangePreset = WeaponRangePreset | SpellRangePreset;

/**
 * Category A: Weapons & Attacks
 * 1. Presets arranged in strictly ascending order of range.
 * 2. All items within each range bracket sorted in strict alphabetical order.
 */
export const WEAPON_RANGE_PRESETS: WeaponRangePreset[] = [
  {
    id: 'wpn-5ft-melee',
    category: 'weapon',
    rangeLabel: '5 ft',
    classification: 'Melee (Standard)',
    normalRange: 5,
    items: ['Dagger', 'Longsword', 'Mace', 'Rapier'],
  },
  {
    id: 'wpn-10ft-reach',
    category: 'weapon',
    rangeLabel: '10 ft',
    classification: 'Melee (Reach)',
    normalRange: 10,
    items: ['Glaive', 'Halberd', 'Pike', 'Quarterstaff', 'Spear', 'Whip'],
  },
  {
    id: 'wpn-20-60ft-thrown',
    category: 'weapon',
    rangeLabel: '20 / 60 ft',
    classification: 'Thrown',
    normalRange: 20,
    longRange: 60,
    items: ['Dagger', 'Handaxe', 'Spear'],
  },
  {
    id: 'wpn-30-120ft-ranged-thrown',
    category: 'weapon',
    rangeLabel: '30 / 120 ft',
    classification: 'Ranged / Thrown',
    normalRange: 30,
    longRange: 120,
    items: ['Hand Crossbow', 'Javelin', 'Sling'],
  },
  {
    id: 'wpn-80-320ft-ranged',
    category: 'weapon',
    rangeLabel: '80 / 320 ft',
    classification: 'Ranged',
    normalRange: 80,
    longRange: 320,
    items: ['Light Crossbow', 'Shortbow'],
  },
  {
    id: 'wpn-100-400ft-ranged',
    category: 'weapon',
    rangeLabel: '100 / 400 ft',
    classification: 'Ranged',
    normalRange: 100,
    longRange: 400,
    items: ['Heavy Crossbow'],
  },
  {
    id: 'wpn-150-600ft-ranged',
    category: 'weapon',
    rangeLabel: '150 / 600 ft',
    classification: 'Ranged',
    normalRange: 150,
    longRange: 600,
    items: ['Longbow'],
  },
];

/**
 * Category B: Spells & Magical Effects
 * 1. Presets arranged in strictly ascending order of range.
 * 2. All items within each range bracket sorted in strict alphabetical order.
 * 3. 5e standard nomenclature strictly adhered to (e.g. Forcecage as single word).
 */
export const SPELL_RANGE_PRESETS: SpellRangePreset[] = [
  {
    id: 'spell-30ft',
    category: 'spell',
    rangeLabel: '30 ft',
    classification: 'Spell',
    range: 30,
    items: ['Bless', 'Faerie Fire', 'Misty Step'],
  },
  {
    id: 'spell-60ft',
    category: 'spell',
    rangeLabel: '60 ft',
    classification: 'Spell',
    range: 60,
    items: ['Healing Word', 'Toll the Dead'],
  },
  {
    id: 'spell-90ft',
    category: 'spell',
    rangeLabel: '90 ft',
    classification: 'Spell',
    range: 90,
    items: ['Blade Barrier', 'Catapult'],
  },
  {
    id: 'spell-100ft',
    category: 'spell',
    rangeLabel: '100 ft',
    classification: 'Spell',
    range: 100,
    items: ['Forcecage', 'Lightning Bolt'],
  },
  {
    id: 'spell-120ft',
    category: 'spell',
    rangeLabel: '120 ft',
    classification: 'Spell',
    range: 120,
    items: ['Eldritch Blast', 'Fire Bolt', 'Guiding Bolt', 'Magic Missile'],
  },
  {
    id: 'spell-150ft',
    category: 'spell',
    rangeLabel: '150 ft',
    classification: 'Spell',
    range: 150,
    items: ['Fireball'],
  },
  {
    id: 'spell-300ft',
    category: 'spell',
    rangeLabel: '300 ft',
    classification: 'Spell',
    range: 300,
    items: ['Earthbind'],
  },
  {
    id: 'spell-500ft',
    category: 'spell',
    rangeLabel: '500 ft',
    classification: 'Spell',
    range: 500,
    items: ['Arcane Gate'],
  },
];
